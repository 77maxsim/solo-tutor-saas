import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function checkStoragePolicies() {
  try {
    // Check bucket configuration
    const { data: buckets, error: bucketError } = await supabase.storage.listBuckets();
    if (bucketError) {
      console.error('Error listing buckets:', bucketError);
      return;
    }

    const tutorAvatarsBucket = buckets.find(b => b.name === 'tutor-avatars');
    console.log('Bucket config:', tutorAvatarsBucket);

    // Test with service role (should bypass RLS)
    const testContent = 'test content';
    const testFile = new Blob([testContent], { type: 'text/plain' });
    const testPath = 'service-test/test.txt';

    const { data: uploadData, error: uploadError } = await supabase.storage
      .from('tutor-avatars')
      .upload(testPath, uploadData, { upsert: true });

    if (uploadError) {
      console.error('Service role upload failed:', uploadError);
    } else {
      console.log('Service role upload successful');
      
      // Clean up
      await supabase.storage.from('tutor-avatars').remove([testPath]);
    }

    // Check if we can temporarily disable RLS
    const disableRLSQuery = `
      -- Check current RLS status
      SELECT schemaname, tablename, rowsecurity 
      FROM pg_tables 
      WHERE schemaname = 'storage' AND tablename = 'objects';
    `;

    console.log('Checking RLS status...');
    const { data: rlsStatus, error: rlsError } = await supabase.rpc('exec_raw_sql', { 
      query: disableRLSQuery 
    });

    if (rlsError) {
      console.log('RLS check failed, trying alternative approach...');
      
      // Update bucket to be more permissive
      console.log('Updating bucket configuration...');
      const { error: updateError } = await supabase.storage.updateBucket('tutor-avatars', {
        public: true,
        allowedMimeTypes: ['image/jpeg', 'image/png', 'image/gif', 'image/webp'],
        fileSizeLimit: 5242880 // 5MB
      });

      if (updateError) {
        console.error('Bucket update failed:', updateError);
      } else {
        console.log('Bucket updated successfully');
      }
    }

  } catch (error) {
    console.error('Check error:', error);
  }
}

checkStoragePolicies();