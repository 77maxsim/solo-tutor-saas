import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function setupStoragePermissions() {
  try {
    console.log('Setting up storage permissions for tutor-avatars bucket...');

    // First, let's try to make the bucket completely public for now
    const { data: updateData, error: updateError } = await supabase.storage.updateBucket('tutor-avatars', {
      public: true,
      allowedMimeTypes: ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp'],
      fileSizeLimit: 5242880 // 5MB
    });

    if (updateError) {
      console.error('Bucket update failed:', updateError);
    } else {
      console.log('Bucket updated successfully:', updateData);
    }

    // Test upload with service role to verify bucket works
    const testContent = 'test avatar';
    const testFile = new Blob([testContent], { type: 'text/plain' });
    const testPath = 'test-upload/avatar.txt';

    const { data: uploadData, error: uploadError } = await supabase.storage
      .from('tutor-avatars')
      .upload(testPath, testFile, { upsert: true });

    if (uploadError) {
      console.error('Test upload failed:', uploadError);
      
      // Try to delete the bucket and recreate it
      console.log('Attempting to recreate bucket...');
      
      const { error: deleteError } = await supabase.storage.deleteBucket('tutor-avatars');
      if (deleteError && !deleteError.message.includes('not found')) {
        console.error('Bucket deletion failed:', deleteError);
      }

      const { data: createData, error: createError } = await supabase.storage.createBucket('tutor-avatars', {
        public: true,
        allowedMimeTypes: ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp'],
        fileSizeLimit: 5242880,
        // Disable RLS for simplicity in development
        avoidFileSizeLimit: false
      });

      if (createError) {
        console.error('Bucket creation failed:', createError);
      } else {
        console.log('Bucket recreated successfully');
      }
    } else {
      console.log('Test upload successful:', uploadData);
      
      // Clean up test file
      await supabase.storage.from('tutor-avatars').remove([testPath]);
      console.log('Test cleanup completed');
    }

  } catch (error) {
    console.error('Setup error:', error);
  }
}

setupStoragePermissions();