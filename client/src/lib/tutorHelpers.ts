import { supabase } from "./supabaseClient";

export async function getCurrentTutorId(): Promise<string | null> {
  try {
    console.log("🧪 [getCurrentTutorId] Starting user ID lookup");
    // Get current user
    const { data: { user } } = await supabase.auth.getUser();
    console.log("🧪 [getCurrentTutorId] Auth user found:", user?.id);
    if (!user) {
      console.log("🧪 [getCurrentTutorId] No authenticated user");
      return null;
    }

    // Look up user record in users table
    console.log("🧪 [getCurrentTutorId] Looking up user record with id:", user.id);
    const { data: userRecord, error } = await supabase
      .from('users')
      .select('id')
      .eq('id', user.id)
      .single();

    if (error) {
      console.log("🧪 [getCurrentTutorId] User lookup error:", error.code, error.message);
      // If user doesn't exist in users table, create one
      if (error.code === 'PGRST116') { // No rows returned
        console.log("🧪 [getCurrentTutorId] No user record found, creating new record");
        const { data: newUser, error: createError } = await supabase
          .from('users')
          .insert([{
            id: user.id,
            username: user.email?.split('@')[0] || 'user',
            email: user.email,
            full_name: user.email?.split('@')[0] || 'User',
            created_at: new Date().toISOString(),
          }])
          .select('id')
          .single();

        if (createError) {
          console.error('🧪 [getCurrentTutorId] Error creating user record:', createError);
          return null;
        }

        console.log("🧪 [getCurrentTutorId] Created new user with ID:", newUser.id);
        return newUser.id;
      }
      
      console.error('🧪 [getCurrentTutorId] Error fetching user:', error);
      return null;
    }

    console.log("🧪 [getCurrentTutorId] Found existing user with ID:", userRecord.id);
    return userRecord.id;
  } catch (error) {
    console.error('Error getting current tutor ID:', error);
    return null;
  }
}