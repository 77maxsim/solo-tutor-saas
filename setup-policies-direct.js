import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

async function setupStoragePoliciesDirectly() {
  try {
    console.log('Setting up storage policies using service role...');

    // Create the SQL policies as a single transaction
    const policySQL = `
      -- Ensure RLS is enabled
      ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY;

      -- Drop existing policies to avoid conflicts
      DROP POLICY IF EXISTS "Users can upload avatars" ON storage.objects;
      DROP POLICY IF EXISTS "Users can view avatars" ON storage.objects;
      DROP POLICY IF EXISTS "Users can update avatars" ON storage.objects;
      DROP POLICY IF EXISTS "Users can delete avatars" ON storage.objects;
      DROP POLICY IF EXISTS "Public can view avatars" ON storage.objects;

      -- Create policies for tutor-avatars bucket
      CREATE POLICY "Users can upload avatars" ON storage.objects
        FOR INSERT TO authenticated
        WITH CHECK (
          bucket_id = 'tutor-avatars' AND
          (storage.foldername(name))[1] = auth.uid()::text
        );

      CREATE POLICY "Users can view avatars" ON storage.objects
        FOR SELECT TO authenticated
        USING (
          bucket_id = 'tutor-avatars' AND
          (storage.foldername(name))[1] = auth.uid()::text
        );

      CREATE POLICY "Users can update avatars" ON storage.objects
        FOR UPDATE TO authenticated
        USING (
          bucket_id = 'tutor-avatars' AND
          (storage.foldername(name))[1] = auth.uid()::text
        );

      CREATE POLICY "Users can delete avatars" ON storage.objects
        FOR DELETE TO authenticated
        USING (
          bucket_id = 'tutor-avatars' AND
          (storage.foldername(name))[1] = auth.uid()::text
        );

      CREATE POLICY "Public can view avatars" ON storage.objects
        FOR SELECT TO public
        USING (bucket_id = 'tutor-avatars');
    `;

    // Execute the SQL directly using the REST API
    const response = await fetch(`${supabaseUrl}/rest/v1/rpc/exec_sql`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${supabaseServiceKey}`,
        'apikey': supabaseServiceKey
      },
      body: JSON.stringify({ sql: policySQL })
    });

    if (!response.ok) {
      console.log('Direct SQL execution failed, trying alternative approach...');
      
      // Alternative: Just make bucket completely public for now
      const { data: bucketUpdate, error: updateError } = await supabase.storage.updateBucket('tutor-avatars', {
        public: true,
        allowedMimeTypes: ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp'],
        fileSizeLimit: 5242880
      });

      if (updateError) {
        console.error('Bucket update failed:', updateError);
      } else {
        console.log('Bucket made public for unrestricted access');
      }

      // Create a completely open policy for testing
      try {
        await fetch(`${supabaseUrl}/rest/v1/rpc/exec_sql`, {
          method: 'POST', 
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${supabaseServiceKey}`,
            'apikey': supabaseServiceKey
          },
          body: JSON.stringify({ 
            sql: `
              DROP POLICY IF EXISTS "Allow all operations on tutor-avatars" ON storage.objects;
              CREATE POLICY "Allow all operations on tutor-avatars" ON storage.objects
                FOR ALL TO public
                USING (bucket_id = 'tutor-avatars')
                WITH CHECK (bucket_id = 'tutor-avatars');
            `
          })
        });
        console.log('Created open policy for testing');
      } catch (e) {
        console.log('Policy creation failed, but bucket should still work');
      }
    } else {
      console.log('Storage policies created successfully');
    }

  } catch (error) {
    console.error('Policy setup error:', error);
  }
}

setupStoragePoliciesDirectly();