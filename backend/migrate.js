const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
    'https://yfhjzuimoemctqzlmjej.supabase.co',
    'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InlmaGp6dWltb2VtY3RxemxtamVqIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3Mjg1NTQwNywiZXhwIjoyMDg4NDMxNDA3fQ.thSeowzd4WhEs0lQu2U_eWNH4R3qm0dCr8PEsaaqZJw'
);

async function migrate() {
    // Step 1: Try to add the description column
    console.log('Step 1: Adding description column...');
    const { error: colErr } = await supabase
        .from('users')
        .update({ description: null })
        .eq('role', 'ADMIN');
    
    if (colErr && colErr.message.includes('description')) {
        console.log('  -> description column does NOT exist. You must run this SQL in Supabase Dashboard:');
        console.log('     ALTER TABLE public.users ADD COLUMN description TEXT;');
    } else {
        console.log('  -> description column exists or was accessible.');
    }

    // Step 2: Test if MLA role is allowed by the CHECK constraint
    console.log('\nStep 2: Testing MLA role constraint...');
    // Create a temporary auth user
    const testEmail = 'mla_constraint_test_' + Date.now() + '@test.com';
    const { data: authData, error: authErr } = await supabase.auth.admin.createUser({
        email: testEmail,
        password: 'TestPassword123!',
        email_confirm: true
    });

    if (authErr) {
        console.log('  -> Could not create test auth user:', authErr.message);
        return;
    }

    const testId = authData.user.id;
    
    // Try inserting with MLA role
    const { error: insertErr } = await supabase
        .from('users')
        .insert({
            id: testId,
            name: 'Test MLA',
            email: testEmail,
            role: 'MLA',
            verification_status: 'pending_verification'
        });

    if (insertErr) {
        console.log('  -> MLA role BLOCKED by constraint:', insertErr.message);
        console.log('  -> You must run this SQL in Supabase Dashboard:');
        console.log("     ALTER TABLE public.users DROP CONSTRAINT users_role_check;");
        console.log("     ALTER TABLE public.users ADD CONSTRAINT users_role_check CHECK (role IN ('USER','TAMILNADU_CORPORATION','TNEB','POLICE','FIRE_STATION','COLLECTOR','ADMIN','MLA'));");
    } else {
        console.log('  -> MLA role is ALLOWED. Cleaning up test record...');
        await supabase.from('users').delete().eq('id', testId);
    }

    // Cleanup auth user
    await supabase.auth.admin.deleteUser(testId);
    
    console.log('\nDone. Please run the SQL statements above in your Supabase Dashboard SQL Editor.');
    console.log('URL: https://supabase.com/dashboard/project/yfhjzuimoemctqzlmjej/sql/new');
}

migrate().catch(console.error);
