const { createClient } = require('@supabase/supabase-js');

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

    // SQL to create storage policies
    const policies = `
      -- Enable RLS on storage.objects table
      ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY;

      -- Policy for authenticated users to upload their own avatars
      CREATE POLICY "Users can upload their own avatar" 
      ON storage.objects 
      FOR INSERT 
      TO authenticated 
      WITH CHECK (
        bucket_id = 'tutor-avatars' 
        AND (storage.foldername(name))[1] = auth.uid()::text
      );

      -- Policy for authenticated users to update their own avatars
      CREATE POLICY "Users can update their own avatar" 
      ON storage.objects 
      FOR UPDATE 
      TO authenticated 
      USING (
        bucket_id = 'tutor-avatars' 
        AND (storage.foldername(name))[1] = auth.uid()::text
      );

      -- Policy for authenticated users to delete their own avatars
      CREATE POLICY "Users can delete their own avatar" 
      ON storage.objects 
      FOR DELETE 
      TO authenticated 
      USING (
        bucket_id = 'tutor-avatars' 
        AND (storage.foldername(name))[1] = auth.uid()::text
      );

      -- Policy for public read access to all avatars (for display purposes)
      CREATE POLICY "Public can view all avatars" 
      ON storage.objects 
      FOR SELECT 
      TO public 
      USING (bucket_id = 'tutor-avatars');
    `;

    // Execute the policies
    const { error } = await supabase.rpc('exec', { sql: policies });
    
    if (error) {
      console.error('Error setting up storage policies:', error);
    } else {
      console.log('Storage policies created successfully!');
    }

  } catch (error) {
    console.error('Setup error:', error);
  }
}

setupAvatarStoragePolicies();