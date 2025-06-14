import { supabase } from "./supabaseClient";

export async function getCurrentTutorId(): Promise<string | null> {
  try {
    // Get current user
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return null;
    }

    // Check if tutor record exists
    const { data: tutor, error } = await supabase
      .from('tutors')
      .select('id')
      .eq('id', user.id)
      .single();

    if (error) {
      // If tutor doesn't exist, create one
      if (error.code === 'PGRST116') { // No rows returned
        const { data: newTutor, error: createError } = await supabase
          .from('tutors')
          .insert([{
            id: user.id,
            email: user.email,
            full_name: user.email?.split('@')[0] || 'Tutor',
            created_at: new Date().toISOString(),
          }])
          .select('id')
          .single();

        if (createError) {
          console.error('Error creating tutor record:', createError);
          return null;
        }

        return newTutor.id;
      }
      
      console.error('Error fetching tutor:', error);
      return null;
    }

    return tutor.id;
  } catch (error) {
    console.error('Error getting current tutor ID:', error);
    return null;
  }
}