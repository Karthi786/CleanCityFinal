const express = require('express');
const { supabaseAdmin } = require('../config/supabase');
const { verifyToken, requireApproved } = require('../middleware/auth');

const router = express.Router();

// Roles that are permitted to use the chat system
const CHAT_ROLES = ['MLA', 'COLLECTOR', 'TAMILNADU_CORPORATION', 'TNEB', 'POLICE'];
const DEPT_ROLES = ['TAMILNADU_CORPORATION', 'TNEB', 'POLICE'];
const AUTHORITY_ROLES = ['MLA', 'COLLECTOR'];

const ROLE_LABELS = {
    MLA: 'MLA',
    COLLECTOR: 'Collector',
    TAMILNADU_CORPORATION: 'Tamilnadu Corporation',
    TNEB: 'TNEB (Electrical)',
    POLICE: 'Tamilnadu Police',
};

// All chat routes require valid auth + approved status
router.use(verifyToken, requireApproved);

// Middleware: restrict to chat-enabled roles only
router.use((req, res, next) => {
    if (!CHAT_ROLES.includes(req.user.role)) {
        return res.status(403).json({ error: 'Chat is not available for your role.' });
    }
    next();
});

/**
 * Generate a consistent conversation ID from two user UUIDs.
 * Sorts alphabetically so the ID is the same regardless of who initiates.
 */
function makeConvId(id1, id2) {
    return [id1, id2].sort().join('_');
}

/**
 * GET /api/chat/contacts
 * Returns the list of users this user is allowed to message.
 * MLA/Collector → department staff in same district
 * Department → MLA + Collector in same district
 */
router.get('/contacts', async (req, res) => {
    try {
        const { role, district } = req.user;

        if (!district) {
            return res.json({ contacts: [] });
        }

        let targetRoles = [];
        if (AUTHORITY_ROLES.includes(role)) {
            targetRoles = DEPT_ROLES;
        } else if (DEPT_ROLES.includes(role)) {
            targetRoles = AUTHORITY_ROLES;
        }

        const { data, error } = await supabaseAdmin
            .from('users')
            .select('id, name, role, department, district, verification_status')
            .in('role', targetRoles)
            .eq('district', district)
            .eq('verification_status', 'approved')
            .order('name', { ascending: true });

        if (error) throw error;

        return res.json({
            contacts: (data || []).map(u => ({
                ...u,
                roleLabel: ROLE_LABELS[u.role] || u.role,
            })),
        });
    } catch (err) {
        console.error('[Chat] contacts error:', err);
        return res.status(500).json({ error: 'Failed to fetch contacts.' });
    }
});

/**
 * GET /api/chat/conversations
 * Returns all conversations for the current user, sorted by most recent.
 * Includes last message preview and unread count per conversation.
 */
router.get('/conversations', async (req, res) => {
    try {
        const userId = req.userId;

        const { data: messages, error } = await supabaseAdmin
            .from('messages')
            .select('id, sender_id, receiver_id, conversation_id, message, is_read, created_at')
            .or(`sender_id.eq.${userId},receiver_id.eq.${userId}`)
            .order('created_at', { ascending: false });

        if (error) throw error;

        // Group by conversation_id, keeping the most recent message
        const convMap = {};
        for (const msg of messages || []) {
            if (!convMap[msg.conversation_id]) {
                const contactId = msg.sender_id === userId ? msg.receiver_id : msg.sender_id;
                convMap[msg.conversation_id] = {
                    conversationId: msg.conversation_id,
                    lastMessage: msg,
                    contactId,
                    unreadCount: 0,
                };
            }
            // Count only unread messages received by current user
            if (!msg.is_read && msg.receiver_id === userId) {
                convMap[msg.conversation_id].unreadCount++;
            }
        }

        const conversations = Object.values(convMap);

        // Resolve contact names in a single batch query
        const contactIds = [...new Set(conversations.map(c => c.contactId))].filter(Boolean);
        const contactMap = {};
        if (contactIds.length > 0) {
            const { data: contacts } = await supabaseAdmin
                .from('users')
                .select('id, name, role, department')
                .in('id', contactIds);
            for (const c of contacts || []) {
                contactMap[c.id] = { ...c, roleLabel: ROLE_LABELS[c.role] || c.role };
            }
        }

        const result = conversations
            .map(conv => ({ ...conv, contact: contactMap[conv.contactId] || null }))
            .sort((a, b) => new Date(b.lastMessage.created_at) - new Date(a.lastMessage.created_at));

        return res.json({ conversations: result });
    } catch (err) {
        console.error('[Chat] conversations error:', err);
        return res.status(500).json({ error: 'Failed to fetch conversations.' });
    }
});

/**
 * GET /api/chat/messages/:contactId
 * Returns the full message history between the current user and a contact.
 * Also verifies that the contact is an allowed chat partner.
 */
router.get('/messages/:contactId', async (req, res) => {
    try {
        const userId = req.userId;
        const contactId = req.params.contactId;
        const { role, district } = req.user;

        // Fetch the contact and enforce access control
        const { data: contact, error: cErr } = await supabaseAdmin
            .from('users')
            .select('id, name, role, department, district, verification_status')
            .eq('id', contactId)
            .single();

        if (cErr || !contact) {
            return res.status(404).json({ error: 'Contact not found.' });
        }

        const allowedRoles = AUTHORITY_ROLES.includes(role) ? DEPT_ROLES : AUTHORITY_ROLES;
        if (!allowedRoles.includes(contact.role) || contact.district !== district) {
            return res.status(403).json({ error: 'You are not allowed to chat with this user.' });
        }

        const conversationId = makeConvId(userId, contactId);
        const { data: messages, error } = await supabaseAdmin
            .from('messages')
            .select('id, sender_id, receiver_id, message, is_read, created_at')
            .eq('conversation_id', conversationId)
            .order('created_at', { ascending: true });

        if (error) throw error;

        return res.json({
            messages: messages || [],
            contact: { ...contact, roleLabel: ROLE_LABELS[contact.role] || contact.role },
        });
    } catch (err) {
        console.error('[Chat] messages error:', err);
        return res.status(500).json({ error: 'Failed to fetch messages.' });
    }
});

/**
 * POST /api/chat/messages
 * Send a message to a contact.
 * Body: { receiverId, message }
 */
router.post('/messages', async (req, res) => {
    try {
        const userId = req.userId;
        const { receiverId, message } = req.body;
        const { role, district } = req.user;

        if (!receiverId || !message || !String(message).trim()) {
            return res.status(400).json({ error: 'receiverId and message are required.' });
        }

        // Verify receiver is a valid contact
        const { data: receiver, error: rErr } = await supabaseAdmin
            .from('users')
            .select('id, name, role, district, verification_status')
            .eq('id', receiverId)
            .single();

        if (rErr || !receiver) {
            return res.status(404).json({ error: 'Receiver not found.' });
        }

        const allowedRoles = AUTHORITY_ROLES.includes(role) ? DEPT_ROLES : AUTHORITY_ROLES;
        if (!allowedRoles.includes(receiver.role) || receiver.district !== district) {
            return res.status(403).json({ error: 'You cannot message this user.' });
        }

        const conversationId = makeConvId(userId, receiverId);
        const { data, error } = await supabaseAdmin
            .from('messages')
            .insert({
                sender_id: userId,
                receiver_id: receiverId,
                conversation_id: conversationId,
                message: String(message).trim(),
                is_read: false,
            })
            .select()
            .single();

        if (error) throw error;

        return res.status(201).json({ message: data });
    } catch (err) {
        console.error('[Chat] send error:', err);
        return res.status(500).json({ error: 'Failed to send message.' });
    }
});

/**
 * PUT /api/chat/read/:contactId
 * Mark all unread messages from a contact as read.
 */
router.put('/read/:contactId', async (req, res) => {
    try {
        const userId = req.userId;
        const contactId = req.params.contactId;
        const conversationId = makeConvId(userId, contactId);

        const { error } = await supabaseAdmin
            .from('messages')
            .update({ is_read: true })
            .eq('conversation_id', conversationId)
            .eq('receiver_id', userId)
            .eq('is_read', false);

        if (error) throw error;

        return res.json({ success: true });
    } catch (err) {
        console.error('[Chat] mark-read error:', err);
        return res.status(500).json({ error: 'Failed to mark messages as read.' });
    }
});

/**
 * GET /api/chat/unread-count
 * Returns total unread message count for the current user.
 * Used by dashboard nav badges.
 */
router.get('/unread-count', async (req, res) => {
    try {
        const userId = req.userId;

        const { count, error } = await supabaseAdmin
            .from('messages')
            .select('*', { count: 'exact', head: true })
            .eq('receiver_id', userId)
            .eq('is_read', false);

        if (error) throw error;

        return res.json({ count: count || 0 });
    } catch (err) {
        // Silently return 0 so nav badge never breaks dashboards
        return res.json({ count: 0 });
    }
});

module.exports = router;
