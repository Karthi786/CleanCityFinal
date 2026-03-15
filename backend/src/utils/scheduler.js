const { supabaseAdmin } = require('../config/supabase');
const { createNotification } = require('../routes/notifications');

/**
 * Checks for issues that have been PENDING for too long (e.g., > 48 hours)
 * and sends reminder notifications to the relevant Department and District Collector.
 */
async function checkStaleIssues() {
    console.log('[Scheduler] Checking for stale issues...');
    try {
        const thresholdDate = new Date();
        thresholdDate.setHours(thresholdDate.getHours() - 48); // 48 hours ago

        const { data: staleIssues, error } = await supabaseAdmin
            .from('issues')
            .select('*')
            .eq('status', 'PENDING')
            .lt('created_at', thresholdDate.toISOString());

        if (error) throw error;

        if (!staleIssues || staleIssues.length === 0) {
            console.log('[Scheduler] No stale issues found.');
            return;
        }

        console.log(`[Scheduler] Found ${staleIssues.length} stale issues. Sending reminders...`);

        // Get Collector user
        const { data: collectorUser } = await supabaseAdmin
            .from('users')
            .select('id')
            .eq('role', 'COLLECTOR')
            .limit(1)
            .single();

        for (const issue of staleIssues) {
            // Send to Department
            const { data: deptUser } = await supabaseAdmin
                .from('users')
                .select('id')
                .eq('role', issue.department)
                .limit(1)
                .single();

            if (deptUser) {
                await createNotification({
                    userId: deptUser.id,
                    title: 'Reminder: Issue Pending',
                    message: `The report "${issue.title}" is still not done yet. Please prioritize this.`,
                    type: 'report',
                    relatedId: issue.id
                });
            }

            // Send to Collector
            if (collectorUser) {
                await createNotification({
                    userId: collectorUser.id,
                    title: 'System Alert: Unprocessed Report',
                    message: `The report "${issue.title}" assigned to ${issue.department} is still not done yet.`,
                    type: 'report',
                    relatedId: issue.id
                });
            }
        }
    } catch (err) {
        console.error('[Scheduler] Error checking stale issues:', err);
    }
}

/**
 * Automatically deletes notifications older than 48 hours.
 */
async function cleanupOldNotifications() {
    console.log('[Scheduler] Cleaning up old notifications...');
    try {
        const thresholdDate = new Date();
        thresholdDate.setHours(thresholdDate.getHours() - 48); // 48 hours ago

        const { data, error } = await supabaseAdmin
            .from('notifications')
            .delete()
            .lt('created_at', thresholdDate.toISOString());

        if (error) throw error;
        console.log('[Scheduler] Notification cleanup completed.');
    } catch (err) {
        console.error('[Scheduler] Notification cleanup error:', err);
    }
}

/**
 * Helper to start the scheduler
 */
function startScheduler() {
    // Run once on start
    checkStaleIssues();
    cleanupOldNotifications();

    // Run every 12 hours
    setInterval(() => {
        checkStaleIssues();
        cleanupOldNotifications();
    }, 12 * 60 * 60 * 1000);
}

module.exports = { startScheduler };
