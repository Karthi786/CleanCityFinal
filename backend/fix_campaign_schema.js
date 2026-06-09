require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);

async function run() {
    const { error } = await supabase.rpc('execute_sql', {
        sql_query: `
            ALTER TABLE public.campaigns DROP CONSTRAINT IF EXISTS campaigns_verification_status_check;
            ALTER TABLE public.campaigns ADD CONSTRAINT campaigns_verification_status_check 
                CHECK (verification_status IN ('pending', 'pending_collector', 'pending_mla', 'approved', 'rejected'));
            
            -- I'll also add district and constituency directly to campaigns if they don't exist to make querying much easier
            ALTER TABLE public.campaigns ADD COLUMN IF NOT EXISTS district TEXT;
            ALTER TABLE public.campaigns ADD COLUMN IF NOT EXISTS constituency TEXT;
        `
    });

    if (error) {
        console.error('Migration failed:', error);
    } else {
        console.log('Migration successful.');
    }
}

run();
