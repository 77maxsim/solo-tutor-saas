import { createClient } from '@supabase/supabase-js';
import fs from 'fs';

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function testImageUpload() {
  try {
    console.log('Testing image upload to tutor-avatars bucket...');

    // Create a simple 1x1 PNG image as a test
    const pngData = Buffer.from([
      0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A, // PNG signature
      0x00, 0x00, 0x00, 0x0D, 0x49, 0x48, 0x44, 0x52, // IHDR chunk header
      0x00, 0x00, 0x00, 0x01, 0x00, 0x00, 0x00, 0x01, // width=1, height=1
      0x08, 0x02, 0x00, 0x00, 0x00, 0x90, 0x77, 0x53, // bit depth=8, color type=2
      0xDE, 0x00, 0x00, 0x00, 0x0C, 0x49, 0x44, 0x41, // IDAT chunk
      0x54, 0x08, 0x17, 0x63, 0xF8, 0xFF, 0xFF, 0xFF, // image data
      0x00, 0x00, 0x01, 0x00, 0x01, 0x5C, 0x6D, 0xBD,
      0xB3, 0x00, 0x00, 0x00, 0x00, 0x49, 0x45, 0x4E, // IEND chunk
      0x44, 0xAE, 0x42, 0x60, 0x82
    ]);

    const testFile = new Blob([pngData], { type: 'image/png' });
    const testPath = 'test-user-id/avatar.png';

    const { data: uploadData, error: uploadError } = await supabase.storage
      .from('tutor-avatars')
      .upload(testPath, testFile, { upsert: true });

    if (uploadError) {
      console.error('Image upload failed:', uploadError);
    } else {
      console.log('Image upload successful:', uploadData);
      
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
        console.log('Test cleanup successful');
      }
    }

  } catch (error) {
    console.error('Test error:', error);
  }
}

testImageUpload();