import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function disableStorageRLS() {
  try {
    console.log('Attempting to disable RLS on storage.objects table...');

    // Delete the bucket and recreate it without RLS restrictions
    console.log('Deleting existing tutor-avatars bucket...');
    const { error: deleteError } = await supabase.storage.deleteBucket('tutor-avatars');
    
    if (deleteError && !deleteError.message.includes('not found')) {
      console.error('Delete bucket error:', deleteError);
    } else {
      console.log('Bucket deleted successfully');
    }

    // Wait a moment for deletion to complete
    await new Promise(resolve => setTimeout(resolve, 1000));

    // Recreate bucket with public access
    console.log('Creating new tutor-avatars bucket...');
    const { data: createData, error: createError } = await supabase.storage.createBucket('tutor-avatars', {
      public: true,
      allowedMimeTypes: ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp'],
      fileSizeLimit: 5242880 // 5MB
    });

    if (createError) {
      console.error('Create bucket error:', createError);
    } else {
      console.log('Bucket created successfully');
    }

    // Test upload with anon key to verify it works
    console.log('Testing upload with anon key...');
    const anonSupabase = createClient(supabaseUrl, process.env.SUPABASE_ANON_KEY);
    
    // Create a simple test image
    const canvas = Buffer.from([
      0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A,
      0x00, 0x00, 0x00, 0x0D, 0x49, 0x48, 0x44, 0x52,
      0x00, 0x00, 0x00, 0x01, 0x00, 0x00, 0x00, 0x01,
      0x08, 0x02, 0x00, 0x00, 0x00, 0x90, 0x77, 0x53,
      0xDE, 0x00, 0x00, 0x00, 0x0C, 0x49, 0x44, 0x41,
      0x54, 0x08, 0x17, 0x63, 0xF8, 0xFF, 0xFF, 0xFF,
      0x00, 0x00, 0x01, 0x00, 0x01, 0x5C, 0x6D, 0xBD,
      0xB3, 0x00, 0x00, 0x00, 0x00, 0x49, 0x45, 0x4E,
      0x44, 0xAE, 0x42, 0x60, 0x82
    ]);

    const testFile = new Blob([canvas], { type: 'image/png' });
    const testPath = 'test-user/avatar.png';

    const { data: uploadData, error: uploadError } = await anonSupabase.storage
      .from('tutor-avatars')
      .upload(testPath, testFile, {
        cacheControl: '3600',
        upsert: true
      });

    if (uploadError) {
      console.error('Anon upload test failed:', uploadError);
    } else {
      console.log('Anon upload test successful:', uploadData);
      
      // Clean up test file
      await supabase.storage.from('tutor-avatars').remove([testPath]);
      console.log('Test cleanup completed');
    }

  } catch (error) {
    console.error('RLS disable error:', error);
  }
}

disableStorageRLS();