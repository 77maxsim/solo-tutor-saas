import { supabase } from "./supabaseClient";

export async function getCurrentTutorId(): Promise<string | null> {
  try {
    console.log("🧪 [getCurrentTutorId] Getting authenticated user ID directly");
    // Get current user and return their ID directly
    const { data: { user } } = await supabase.auth.getUser();
    console.log("🧪 [getCurrentTutorId] Auth user found:", user?.id);
    
    if (!user) {
      console.log("🧪 [getCurrentTutorId] No authenticated user");
      return null;
    }

    console.log("🧪 [getCurrentTutorId] Returning user ID directly:", user.id);
    return user.id;
  } catch (error) {
    console.error('Error getting current tutor ID:', error);
    return null;
  }
}