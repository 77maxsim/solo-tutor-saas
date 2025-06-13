-- Create storage policies for tutor-avatars bucket

-- First, ensure RLS is enabled on storage.objects
ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Give users access to own folder 1oj01fe_0" ON storage.objects;
DROP POLICY IF EXISTS "Give users access to own folder 1oj01fe_1" ON storage.objects;
DROP POLICY IF EXISTS "Give users access to own folder 1oj01fe_2" ON storage.objects;
DROP POLICY IF EXISTS "Give users access to own folder 1oj01fe_3" ON storage.objects;

-- Policy 1: Allow authenticated users to upload files in their own folder
CREATE POLICY "Give users access to own folder 1oj01fe_0"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'tutor-avatars' 
  AND (storage.foldername(name))[1] = auth.uid()::text
);

-- Policy 2: Allow authenticated users to view files in their own folder
CREATE POLICY "Give users access to own folder 1oj01fe_1"
ON storage.objects FOR SELECT TO authenticated
USING (
  bucket_id = 'tutor-avatars' 
  AND (storage.foldername(name))[1] = auth.uid()::text
);

-- Policy 3: Allow authenticated users to update files in their own folder
CREATE POLICY "Give users access to own folder 1oj01fe_2"
ON storage.objects FOR UPDATE TO authenticated
USING (
  bucket_id = 'tutor-avatars' 
  AND (storage.foldername(name))[1] = auth.uid()::text
);

-- Policy 4: Allow authenticated users to delete files in their own folder
CREATE POLICY "Give users access to own folder 1oj01fe_3"
ON storage.objects FOR DELETE TO authenticated
USING (
  bucket_id = 'tutor-avatars' 
  AND (storage.foldername(name))[1] = auth.uid()::text
);

-- Policy 5: Allow public read access to all avatar files (for display)
CREATE POLICY "Allow public read access to tutor avatars"
ON storage.objects FOR SELECT TO public
USING (bucket_id = 'tutor-avatars');