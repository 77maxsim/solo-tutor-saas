import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseAnonKey = process.env.SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  console.error('Missing Supabase credentials');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function testStorageUpload() {
  try {
    console.log('Testing storage upload without authentication...');

    // Create a test file
    const testContent = 'test avatar content';
    const testFile = new Blob([testContent], { type: 'text/plain' });
    const testPath = 'test-user-id/avatar.txt';

    // Test upload to tutor-avatars bucket
    const { data: uploadData, error: uploadError } = await supabase.storage
      .from('tutor-avatars')
      .upload(testPath, testFile, { upsert: true });

    if (uploadError) {
      console.error('Upload failed:', uploadError);
    } else {
      console.log('Upload successful:', uploadData);
      
      // Get public URL
      const { data: { publicUrl } } = supabase.storage
        .from('tutor-avatars')
        .getPublicUrl(testPath);
      
      console.log('Public URL:', publicUrl);
      
      // Clean up
      const { error: deleteError } = await supabase.storage
        .from('tutor-avatars')
        .remove([testPath]);
        
      if (deleteError) {
        console.error('Cleanup failed:', deleteError);
      } else {
        console.log('Cleanup successful');
      }
    }

  } catch (error) {
    console.error('Test error:', error);
  }
}

testStorageUpload();