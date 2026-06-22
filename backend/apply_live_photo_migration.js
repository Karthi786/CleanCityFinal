require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);

async function run() {
    console.log('Running migration to add captured_image_url and captured_at to issues table...');
    const { error } = await supabase.rpc('execute_sql', {
        sql_query: `
            ALTER TABLE public.issues 
              ADD COLUMN IF NOT EXISTS captured_image_url TEXT,
              ADD COLUMN IF NOT EXISTS captured_at TIMESTAMPTZ;
        `
    });

    if (error) {
        console.error('Migration failed:', error);
    } else {
        console.log('Migration successful: captured_image_url and captured_at columns added to public.issues.');
    }
}

run();
