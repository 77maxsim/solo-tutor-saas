import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('Missing Supabase credentials');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function setupStorageRLS() {
  try {
    console.log('Setting up storage RLS policies...');

    // Drop existing policies if they exist
    const dropPolicies = [
      'DROP POLICY IF EXISTS "Users can upload their own avatar" ON storage.objects;',
      'DROP POLICY IF EXISTS "Users can update their own avatar" ON storage.objects;',
      'DROP POLICY IF EXISTS "Users can delete their own avatar" ON storage.objects;',
      'DROP POLICY IF EXISTS "Public can view all avatars" ON storage.objects;'
    ];

    for (const policy of dropPolicies) {
      const { error } = await supabase.rpc('exec_sql', { sql: policy });
      if (error && !error.message.includes('does not exist')) {
        console.error('Error dropping policy:', error);
      }
    }

    // Create new policies
    const policies = [
      // Policy for authenticated users to upload their own avatars
      `CREATE POLICY "Users can upload their own avatar" 
       ON storage.objects 
       FOR INSERT 
       TO authenticated 
       WITH CHECK (
         bucket_id = 'tutor-avatars' 
         AND (storage.foldername(name))[1] = auth.uid()::text
       );`,

      // Policy for authenticated users to update their own avatars
      `CREATE POLICY "Users can update their own avatar" 
       ON storage.objects 
       FOR UPDATE 
       TO authenticated 
       USING (
         bucket_id = 'tutor-avatars' 
         AND (storage.foldername(name))[1] = auth.uid()::text
       );`,

      // Policy for authenticated users to delete their own avatars
      `CREATE POLICY "Users can delete their own avatar" 
       ON storage.objects 
       FOR DELETE 
       TO authenticated 
       USING (
         bucket_id = 'tutor-avatars' 
         AND (storage.foldername(name))[1] = auth.uid()::text
       );`,

      // Policy for public read access to all avatars
      `CREATE POLICY "Public can view all avatars" 
       ON storage.objects 
       FOR SELECT 
       TO public 
       USING (bucket_id = 'tutor-avatars');`
    ];

    for (const policy of policies) {
      const { error } = await supabase.rpc('exec_sql', { sql: policy });
      if (error) {
        console.error('Error creating policy:', error);
      } else {
        console.log('Policy created successfully');
      }
    }

    console.log('Storage RLS setup complete!');

  } catch (error) {
    console.error('Setup error:', error);
  }
}

setupStorageRLS();