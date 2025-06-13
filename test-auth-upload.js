import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseAnonKey = process.env.SUPABASE_ANON_KEY;

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function testAuthenticatedUpload() {
  try {
    console.log('Testing authenticated upload...');

    // First sign in with a test user (if exists) or test without auth
    // Create a test image file
    const pngData = Buffer.from([
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

    const testFile = new Blob([pngData], { type: 'image/png' });
    const testPath = 'test-user-upload/avatar.png';

    // Test upload with anon key (should work with open policy)
    const { data: uploadData, error: uploadError } = await supabase.storage
      .from('tutor-avatars')
      .upload(testPath, testFile, {
        cacheControl: '3600',
        upsert: true
      });

    if (uploadError) {
      console.error('Upload still failing:', uploadError);
    } else {
      console.log('Upload successful!', uploadData);
      
      // Get public URL
      const { data } = supabase.storage
        .from('tutor-avatars')
        .getPublicUrl(testPath);
      
      console.log('Public URL:', data?.publicUrl);
      
      // Clean up
      await supabase.storage.from('tutor-avatars').remove([testPath]);
      console.log('Test cleanup completed');
    }

  } catch (error) {
    console.error('Test error:', error);
  }
}

testAuthenticatedUpload();