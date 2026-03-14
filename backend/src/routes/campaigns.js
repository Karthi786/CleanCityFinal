const express = require('express');
const { supabaseAdmin } = require('../config/supabase');
const { verifyToken, requireRole, requireApproved } = require('../middleware/auth');

const router = express.Router();

/**
 * GET /api/campaigns
 * Returns all campaigns ordered by start_date asc.
 * Optional query: ?status=UPCOMING|ACTIVE|COMPLETED
 */
router.get('/', verifyToken, requireApproved, async (req, res) => {
    try {
        let query = supabaseAdmin
            .from('campaigns')
            .select('*')
            .order('start_date', { ascending: true })
            .order('start_time', { ascending: true });

        // Regular users only see approved campaigns. 
        // Creators see their own pending campaigns.
        // Admins/Collectors see all.
        if (!['ADMIN', 'COLLECTOR'].includes(req.user.role)) {
            query = query.or(`verification_status.eq.approved,created_by_id.eq.${req.userId}`);
        }

        if (req.query.status) {
            query = query.eq('status', req.query.status);
        }

        const { data, error } = await query;
        if (error) throw error;

        return res.json({ campaigns: data });
    } catch (err) {
        console.error('Get campaigns error:', err);
        return res.status(500).json({ error: err.message || 'Failed to fetch campaigns.' });
    }
});

/**
 * POST /api/campaigns
 * Create a new campaign (USER role only)
 */
router.post('/', verifyToken, requireApproved, requireRole('USER'), async (req, res) => {
    const {
        title, description, locationName, latitude, longitude,
        startDate, startTime, endDate, endTime,
        volunteersNeeded, imageUrl
    } = req.body;

    if (!title || !description || !startDate || !startTime || !endDate || !endTime || !volunteersNeeded) {
        return res.status(400).json({
            error: 'title, description, startDate, startTime, endDate, endTime, and volunteersNeeded are required.'
        });
    }

    if (parseInt(volunteersNeeded, 10) < 1) {
        return res.status(400).json({ error: 'volunteersNeeded must be at least 1.' });
    }

    // Validate end is after start
    const startDT = new Date(`${startDate}T${startTime}`);
    const endDT = new Date(`${endDate}T${endTime}`);
    if (endDT <= startDT) {
        return res.status(400).json({ error: 'End date/time must be after start date/time.' });
    }

    try {
        const { data, error } = await supabaseAdmin
            .from('campaigns')
            .insert({
                title,
                description,
                location_name: locationName || null,
                latitude: latitude || null,
                longitude: longitude || null,
                start_date: startDate,
                start_time: startTime,
                end_date: endDate,
                end_time: endTime,
                volunteers_needed: parseInt(volunteersNeeded, 10),
                registered_count: 0,
                image_url: imageUrl || null,
                status: 'UPCOMING',
                verification_status: 'pending',
                created_by_id: req.userId,
                created_by_name: req.user.name,
            })
            .select()
            .single();

        if (error) throw error;

        return res.status(201).json({ message: 'Campaign created successfully.', campaign: data });
    } catch (err) {
        console.error('Create campaign error:', err);
        return res.status(500).json({ error: err.message || 'Failed to create campaign.' });
    }
});

/**
 * POST /api/campaigns/:id/register
 * Toggle registration as a volunteer.
 * Blocks registration if the campaign start time has passed.
 */
router.post('/:id/register', verifyToken, requireApproved, async (req, res) => {
    const { id } = req.params;
    const userId = req.userId;

    try {
        // Fetch campaign
        const { data: campaign, error: fetchErr } = await supabaseAdmin
            .from('campaigns')
            .select('*')
            .eq('id', id)
            .single();

        if (fetchErr || !campaign) {
            return res.status(404).json({ error: 'Campaign not found.' });
        }

        // Block registration after campaign starts
        const startDT = new Date(`${campaign.start_date}T${campaign.start_time}`);
        if (new Date() >= startDT) {
            return res.status(400).json({ error: 'Registration is closed — campaign has already started.' });
        }

        // Check existing registration
        const { data: existing } = await supabaseAdmin
            .from('campaign_registrations')
            .select('campaign_id')
            .eq('campaign_id', id)
            .eq('user_id', userId)
            .maybeSingle();

        let newCount;
        let registered;

        const { volunteerName, phoneNumber } = req.body;

        if (existing) {
            // Unregister
            const { error: delErr } = await supabaseAdmin
                .from('campaign_registrations')
                .delete()
                .eq('campaign_id', id)
                .eq('user_id', userId);
            if (delErr) throw delErr;

            newCount = Math.max(0, (campaign.registered_count || 0) - 1);
            registered = false;
        } else {
            // Check capacity
            if (campaign.registered_count >= campaign.volunteers_needed) {
                return res.status(400).json({ error: 'Campaign is full — no more volunteers needed.' });
            }

            if (!volunteerName || !phoneNumber) {
                return res.status(400).json({ error: 'Name and phone number are required to register.' });
            }

            const { error: insErr } = await supabaseAdmin
                .from('campaign_registrations')
                .insert({
                    campaign_id: id,
                    user_id: userId,
                    volunteer_name: volunteerName,
                    phone_number: phoneNumber,
                });
            if (insErr) throw insErr;

            newCount = (campaign.registered_count || 0) + 1;
            registered = true;
        }

        // Update registered_count
        const { data: updated, error: updErr } = await supabaseAdmin
            .from('campaigns')
            .update({ registered_count: newCount })
            .eq('id', id)
            .select()
            .single();
        if (updErr) throw updErr;

        return res.json({
            message: registered ? 'Registered as volunteer.' : 'Registration removed.',
            registeredCount: updated.registered_count,
            registered,
        });
    } catch (err) {
        console.error('Campaign register error:', err);
        return res.status(500).json({ error: 'Failed to update registration.' });
    }
});

/**
 * GET /api/campaigns/my-registrations
 * Returns campaign IDs that the current user has registered for.
 */
router.get('/my-registrations', verifyToken, requireApproved, async (req, res) => {
    try {
        const { data, error } = await supabaseAdmin
            .from('campaign_registrations')
            .select('campaign_id')
            .eq('user_id', req.userId);
        if (error) throw error;
        return res.json({ registeredIds: (data || []).map(r => r.campaign_id) });
    } catch (err) {
        console.error('My campaign registrations error:', err);
        return res.status(500).json({ error: 'Failed to fetch registrations.' });
    }
});

/**
 * DELETE /api/campaigns/:id
 * Delete a campaign (creator, COLLECTOR, or ADMIN only)
 */
router.delete('/:id', verifyToken, requireApproved, async (req, res) => {
    const { id } = req.params;
    try {
        const { data: campaign, error: fetchErr } = await supabaseAdmin
            .from('campaigns')
            .select('created_by_id')
            .eq('id', id)
            .single();

        if (fetchErr || !campaign) {
            return res.status(404).json({ error: 'Campaign not found.' });
        }

        const canDelete = ['ADMIN', 'COLLECTOR', 'DEPARTMENT'].includes(req.user.role) || campaign.created_by_id === req.userId;
        if (!canDelete) {
            return res.status(403).json({ error: 'You do not have permission to delete this campaign.' });
        }

        const { error } = await supabaseAdmin.from('campaigns').delete().eq('id', id);
        if (error) throw error;
        return res.json({ message: 'Campaign deleted.' });
    } catch (err) {
        console.error('Delete campaign error:', err);
        return res.status(500).json({ error: 'Failed to delete campaign.' });
    }
});

/**
 * GET /api/campaigns/:id/volunteers
 * Returns list of registered volunteers
 */
router.get('/:id/volunteers', verifyToken, requireApproved, async (req, res) => {
    try {
        const { data: campaign, error: campErr } = await supabaseAdmin
            .from('campaigns')
            .select('created_by_id')
            .eq('id', req.params.id)
            .single();

        if (campErr || !campaign) {
            return res.status(404).json({ error: 'Campaign not found' });
        }

        const canView = ['COLLECTOR', 'ADMIN'].includes(req.user.role) || campaign.created_by_id === req.userId;
        if (!canView) return res.status(403).json({ error: 'Not authorized to view volunteers.' });

        const { data, error } = await supabaseAdmin
            .from('campaign_registrations')
            .select('*')
            .eq('campaign_id', req.params.id)
            .order('registered_at', { ascending: false });

        if (error) throw error;
        return res.json({ volunteers: data });
    } catch (err) {
        console.error('View volunteers error:', err);
        return res.status(500).json({ error: 'Failed to fetch volunteers' });
    }
});

/**
 * POST /api/campaigns/:id/volunteers/:volunteerId/confirm
 * Confirm participation and give 3 points
 */
router.post('/:id/volunteers/:volunteerId/confirm', verifyToken, requireApproved, async (req, res) => {
    try {
        const { id, volunteerId } = req.params;

        const { data: campaign } = await supabaseAdmin
            .from('campaigns')
            .select('created_by_id, status')
            .eq('id', id)
            .single();

        if (!campaign || campaign.created_by_id !== req.userId) {
            return res.status(403).json({ error: 'Only the creator can confirm volunteers.' });
        }

        if (volunteerId === req.userId) {
            return res.status(400).json({ error: 'You cannot confirm your own participation.' });
        }

        const { data: reg, error: regErr } = await supabaseAdmin
            .from('campaign_registrations')
            .select('*')
            .eq('campaign_id', id)
            .eq('user_id', volunteerId)
            .single();

        if (regErr || !reg) return res.status(404).json({ error: 'Registration not found' });

        // Guard: use participation_status (existing column) and points_given to prevent double-award
        if (reg.participation_status === 'CONFIRMED' || reg.points_given === true) {
            return res.status(400).json({ error: 'Already confirmed and points awarded.' });
        }

        // Mark registration confirmed and points_given
        const { error: regUpdateErr } = await supabaseAdmin
            .from('campaign_registrations')
            .update({ participation_status: 'CONFIRMED', points_given: true })
            .eq('campaign_id', id)
            .eq('user_id', volunteerId);
        if (regUpdateErr) throw regUpdateErr;

        // ── Volunteer: +3 points ──────────────────────────────────────────────────
        const { data: volunteerRow } = await supabaseAdmin
            .from('users')
            .select('total_points, campaigns_participated, campaign_participated_points')
            .eq('id', volunteerId)
            .single();

        if (volunteerRow) {
            const newParticipated = (volunteerRow.campaigns_participated || 0) + 1;
            const newParticipatedPts = (volunteerRow.campaign_participated_points || 0) + 3;
            const newTotal = (volunteerRow.total_points || 0) + 3;

            await supabaseAdmin.from('users').update({
                campaigns_participated: newParticipated,
                campaign_participated_points: newParticipatedPts,
                total_points: newTotal,
            }).eq('id', volunteerId);

            console.log(JSON.stringify({
                action: 'campaign_participation',
                user_id: volunteerId,
                campaign_id: id,
                points_awarded: 3,
                new_total_points: newTotal,
                timestamp: new Date().toISOString(),
            }));
        }

        // ── Campaign Creator: +5 points (only on first confirmed volunteer) ───────
        const { data: campRow } = await supabaseAdmin
            .from('campaigns')
            .select('creator_points_awarded, created_by_id')
            .eq('id', id)
            .single();

        if (campRow && !campRow.creator_points_awarded) {
            // Atomically mark awarded to prevent race conditions
            const { error: campMarkErr } = await supabaseAdmin
                .from('campaigns')
                .update({ creator_points_awarded: true })
                .eq('id', id)
                .eq('creator_points_awarded', false); // optimistic lock
            
            if (!campMarkErr) {
                // Only award points if our optimistic lock succeeded
                const { data: creatorRow } = await supabaseAdmin
                    .from('users')
                    .select('total_points, campaigns_organized, campaign_created_points')
                    .eq('id', campRow.created_by_id)
                    .single();

                if (creatorRow) {
                    const newOrganized = (creatorRow.campaigns_organized || 0) + 1;
                    const newCreatedPts = (creatorRow.campaign_created_points || 0) + 5;
                    const newCreatorTotal = (creatorRow.total_points || 0) + 5;

                    await supabaseAdmin.from('users').update({
                        campaigns_organized: newOrganized,
                        campaign_created_points: newCreatedPts,
                        total_points: newCreatorTotal,
                    }).eq('id', campRow.created_by_id);

                    console.log(JSON.stringify({
                        action: 'campaign_creation',
                        user_id: campRow.created_by_id,
                        campaign_id: id,
                        points_awarded: 5,
                        new_total_points: newCreatorTotal,
                        timestamp: new Date().toISOString(),
                    }));
                }
            }
        }

        return res.json({ message: 'Volunteer confirmed and points awarded.' });
    } catch (err) {
        console.error('Confirm volunteer error:', err);
        return res.status(500).json({ error: 'Failed to confirm' });
    }
});

/**
 * POST /api/campaigns/:id/complete
 * Mark a campaign as COMPLETED.
 * NOTE: Creator points (+5) are awarded automatically when the first volunteer is
 * confirmed via the confirm route. This endpoint just closes the campaign.
 */
router.post('/:id/complete', verifyToken, requireApproved, async (req, res) => {
    try {
        const { id } = req.params;
        const { data: campaign } = await supabaseAdmin
            .from('campaigns')
            .select('id, created_by_id, status')
            .eq('id', id)
            .single();

        if (!campaign || campaign.created_by_id !== req.userId) {
            return res.status(403).json({ error: 'Only the creator can complete this campaign.' });
        }

        if (campaign.status === 'COMPLETED') {
            return res.status(400).json({ error: 'Campaign is already marked as completed.' });
        }

        // Require at least 1 confirmed participant before allowing completion
        const { count, error: countErr } = await supabaseAdmin
            .from('campaign_registrations')
            .select('*', { count: 'exact', head: true })
            .eq('campaign_id', id)
            .eq('participation_status', 'CONFIRMED');

        if (countErr) throw countErr;

        if (!count || count === 0) {
            return res.status(400).json({
                error: 'No confirmed participants yet. Confirm at least one volunteer before completing the campaign.',
            });
        }

        // Mark campaign COMPLETED (creator_points_awarded was already set by confirm route)
        await supabaseAdmin
            .from('campaigns')
            .update({ status: 'COMPLETED' })
            .eq('id', id);

        console.log(JSON.stringify({
            action: 'campaign_completed',
            campaign_id: id,
            creator_id: req.userId,
            timestamp: new Date().toISOString(),
        }));

        return res.json({ message: 'Campaign marked as completed.' });
    } catch (err) {
        console.error('Complete campaign error:', err);
        return res.status(500).json({ error: 'Failed to complete campaign.' });
    }
});

/**
 * DELETE /api/campaigns/:id
 * Delete a campaign created by the user
 */
router.delete('/:id', verifyToken, requireApproved, async (req, res) => {
    try {
        const { id } = req.params;

        // Verify ownership
        const { data: campaign, error: getErr } = await supabaseAdmin
            .from('campaigns')
            .select('created_by_id')
            .eq('id', id)
            .single();

        if (getErr || !campaign) {
            return res.status(404).json({ error: 'Campaign not found.' });
        }

        if (campaign.created_by_id !== req.userId && req.user.role !== 'ADMIN') {
            return res.status(403).json({ error: 'Only the creator can delete this campaign.' });
        }

        // Delete campaign
        const { error: delErr } = await supabaseAdmin
            .from('campaigns')
            .delete()
            .eq('id', id);

        if (delErr) throw delErr;

        return res.json({ message: 'Campaign deleted successfully.' });
    } catch (err) {
        console.error('Delete campaign error:', err);
        return res.status(500).json({ error: 'Failed to delete campaign.' });
    }
});

/**
 * GET /api/campaigns/pending
 * Returns campaigns waiting for admin approval
 */
router.get('/pending', verifyToken, requireApproved, requireRole('ADMIN', 'COLLECTOR'), async (req, res) => {
    try {
        const { data, error } = await supabaseAdmin
            .from('campaigns')
            .select('*')
            .eq('verification_status', 'pending')
            .order('created_at', { ascending: false });

        if (error) throw error;
        return res.json({ campaigns: data });
    } catch (err) {
        console.error('Get pending campaigns error:', err);
        return res.status(500).json({ error: 'Failed to fetch pending campaigns.' });
    }
});

/**
 * PUT /api/campaigns/:id/verify
 * Approve or reject a campaign
 */
router.put('/:id/verify', verifyToken, requireApproved, requireRole('ADMIN', 'COLLECTOR'), async (req, res) => {
    const { id } = req.params;
    const { status } = req.body; // 'approved' or 'rejected'

    if (!['approved', 'rejected'].includes(status)) {
        return res.status(400).json({ error: "Invalid status. Must be 'approved' or 'rejected'." });
    }

    try {
        const { error } = await supabaseAdmin
            .from('campaigns')
            .update({ verification_status: status })
            .eq('id', id);

        if (error) throw error;
        return res.json({ message: `Campaign ${status} successfully.` });
    } catch (err) {
        console.error('Verify campaign error:', err);
        return res.status(500).json({ error: 'Failed to verify campaign.' });
    }
});

module.exports = router;
