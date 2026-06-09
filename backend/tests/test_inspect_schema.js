require('dotenv').config();
const { supabaseAdmin } = require('../src/config/supabase');

async function inspectSchema() {
    console.log("Fetching a single user to inspect keys...");
    const { data, error } = await supabaseAdmin
        .from('users')
        .select('*')
        .limit(1);

    if (error) {
        console.error("Error fetching users:", error);
    } else {
        console.log("Users records count:", data.length);
        if (data.length > 0) {
            console.log("User record fields:", Object.keys(data[0]));
        } else {
            console.log("Users table is empty, cannot inspect columns from record.");
        }
    }
}

inspectSchema();
