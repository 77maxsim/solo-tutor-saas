import { supabase } from "./supabaseClient";

export async function getCurrentTutorId(): Promise<string | null> {
  try {
    console.log("🧪 [getCurrentTutorId] Starting tutor ID lookup");
    // Get current user
    const { data: { user } } = await supabase.auth.getUser();
    console.log("🧪 [getCurrentTutorId] Auth user found:", user?.id);
    if (!user) {
      console.log("🧪 [getCurrentTutorId] No authenticated user");
      return null;
    }

    // Check if tutor record exists
    console.log("🧪 [getCurrentTutorId] Looking up tutor with user_id:", user.id);
    const { data: tutor, error } = await supabase
      .from('tutors')
      .select('id')
      .eq('user_id', user.id)
      .single();

    if (error) {
      console.log("🧪 [getCurrentTutorId] Tutor lookup error:", error.code, error.message);
      // If tutor doesn't exist, create one
      if (error.code === 'PGRST116') { // No rows returned
        console.log("🧪 [getCurrentTutorId] No tutor found, creating new record");
        const { data: newTutor, error: createError } = await supabase
          .from('tutors')
          .insert([{
            user_id: user.id,
            email: user.email,
            full_name: user.email?.split('@')[0] || 'Tutor',
            created_at: new Date().toISOString(),
          }])
          .select('id')
          .single();

        if (createError) {
          console.error('🧪 [getCurrentTutorId] Error creating tutor record:', createError);
          return null;
        }

        console.log("🧪 [getCurrentTutorId] Created new tutor with ID:", newTutor.id);
        return newTutor.id;
      }
      
      console.error('🧪 [getCurrentTutorId] Error fetching tutor:', error);
      return null;
    }

    console.log("🧪 [getCurrentTutorId] Found existing tutor with ID:", tutor.id);
    return tutor.id;
  } catch (error) {
    console.error('Error getting current tutor ID:', error);
    return null;
  }
}