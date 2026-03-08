const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabaseAdmin = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_KEY
);

async function test() {
    console.log("Testing issue_reviews query...");
    const { data, error } = await supabaseAdmin
        .from('issue_reviews')
        .select('*, issues(title)')
        .limit(1);

    if (error) {
        console.error("ERROR:", error);
    } else {
        console.log("DATA:", data);
    }
}
test();
