const express = require('express');
const { supabaseAdmin } = require('../config/supabase');
const { verifyToken, requireApproved } = require('../middleware/auth');

const router = express.Router();

/**
 * GET /api/notifications
 * Fetch latest notifications for the logged-in user
 */
router.get('/', verifyToken, requireApproved, async (req, res) => {
    try {
        const { data, error } = await supabaseAdmin
            .from('notifications')
            .select('*')
            .eq('user_id', req.userId)
            .order('created_at', { ascending: false })
            .limit(50);

        if (error) throw error;

        return res.json({ notifications: data });
    } catch (err) {
        console.error('Get notifications error:', err);
        return res.status(500).json({ error: 'Failed to fetch notifications.' });
    }
});

/**
 * PUT /api/notifications/:id/read
 * Mark a notification as read
 */
router.put('/:id/read', verifyToken, requireApproved, async (req, res) => {
    try {
        const { id } = req.params;
        const { error } = await supabaseAdmin
            .from('notifications')
            .update({ is_read: true })
            .eq('id', id)
            .eq('user_id', req.userId);

        if (error) throw error;

        return res.json({ message: 'Notification marked as read.' });
    } catch (err) {
        console.error('Update notification error:', err);
        return res.status(500).json({ error: 'Failed to update notification.' });
    }
});

/**
 * POST /api/notifications/read-all
 * Mark all notifications as read for the current user
 */
router.post('/read-all', verifyToken, requireApproved, async (req, res) => {
    try {
        const { error } = await supabaseAdmin
            .from('notifications')
            .update({ is_read: true })
            .eq('user_id', req.userId)
            .eq('is_read', false);

        if (error) throw error;
 
         return res.json({ message: 'All notifications marked as read.' });
     } catch (err) {
         console.error('Read all notifications error:', err);
         return res.status(500).json({ error: 'Failed to update notifications.' });
     }
 });
 
 /**
  * DELETE /api/notifications/:id
  * Delete a specific notification
  */
 router.delete('/:id', verifyToken, requireApproved, async (req, res) => {
     try {
         const { id } = req.params;
         const { error } = await supabaseAdmin
             .from('notifications')
             .delete()
             .eq('id', id)
             .eq('user_id', req.userId);
 
         if (error) throw error;
 
         return res.json({ message: 'Notification deleted successfully.' });
     } catch (err) {
         console.error('Delete notification error:', err);
         return res.status(500).json({ error: 'Failed to delete notification.' });
     }
 });

// Internal helper to create notifications (not exported as a route)
async function createNotification({ userId, title, message, type, relatedId }) {
    try {
        const { error } = await supabaseAdmin
            .from('notifications')
            .insert({
                user_id: userId,
                title,
                message,
                type,
                related_id: relatedId,
                is_read: false
            });
        if (error) throw error;
        return true;
    } catch (err) {
        console.error('Internal create notification error:', err);
        return false;
    }
}

module.exports = {
    router,
    createNotification
};
