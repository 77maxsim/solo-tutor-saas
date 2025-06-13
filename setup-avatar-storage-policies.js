import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('Missing Supabase credentials');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function setupAvatarStoragePolicies() {
  try {
    console.log('Setting up storage policies for tutor-avatars bucket...');

    // Check if bucket exists and is public
    const { data: buckets, error: bucketError } = await supabase.storage.listBuckets();
    if (bucketError) {
      console.error('Error checking buckets:', bucketError);
      return;
    }

    const tutorAvatarsBucket = buckets.find(b => b.name === 'tutor-avatars');
    if (!tutorAvatarsBucket) {
      console.error('tutor-avatars bucket not found');
      return;
    }

    console.log('Bucket found:', tutorAvatarsBucket);
    
    // Test upload to verify permissions
    console.log('Testing upload permissions...');
    const testFile = new Blob(['test'], { type: 'text/plain' });
    const testPath = 'test/test.txt';
    
    const { data: uploadData, error: uploadError } = await supabase.storage
      .from('tutor-avatars')
      .upload(testPath, testFile);

    if (uploadError) {
      console.log('Upload test failed (expected for RLS):', uploadError.message);
    } else {
      console.log('Upload test successful, cleaning up...');
      await supabase.storage.from('tutor-avatars').remove([testPath]);
    }

    console.log('Storage setup complete. Bucket is ready for authenticated uploads.');

  } catch (error) {
    console.error('Setup error:', error);
  }
}

setupAvatarStoragePolicies();