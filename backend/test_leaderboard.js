require('dotenv').config({ path: './.env' });
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);

async function testLeaderboard() {
    try {
        const { data, error } = await supabase
            .from('users')
            .select('id, name, role, total_points, reports_points, campaign_participated_points, campaign_created_points, reports_resolved, campaigns_participated, campaigns_organized')
            .order('total_points', { ascending: false })
            .limit(10);
            
        console.log("Error:", error);
        console.log("Data count:", data?.length);
        data.forEach(u => console.log(`User: ${u.name}, Points: ${u.total_points}, Role: ${u.role}`));
    } catch(e) {
        console.log("Exception:", e);
    }
}

testLeaderboard();
