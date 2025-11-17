import { supabase } from "./supabaseClient";

export async function ensureTutorProfile(): Promise<number | null> {
  try {
    // Get current user
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return null;
    }

    // Check if tutor record exists using user_id
    const { data: tutor, error } = await supabase
      .from('tutors')
      .select('id')
      .eq('user_id', user.id)
      .single();

    if (error) {
      // If tutor doesn't exist, create one
      if (error.code === 'PGRST116') { // No rows returned
        // Extract metadata from user (stored during signup)
        const metadata = user.user_metadata || {};
        const fullName = metadata.full_name || user.email?.split('@')[0] || 'Tutor';
        const currency = metadata.currency || 'USD';
        const timezone = metadata.timezone || 'America/New_York';

        const { data: newTutor, error: createError } = await supabase
          .from('tutors')
          .insert([{
            user_id: user.id,
            email: user.email,
            full_name: fullName,
            currency: currency,
            timezone: timezone,
            created_at: new Date().toISOString(),
          }])
          .select('id')
          .single();

        if (createError) {
          // If we hit a unique constraint (another concurrent call created it), re-query
          if (createError.code === '23505' || createError.message?.includes('duplicate key')) {
            console.log('Tutor record created by concurrent call, re-querying...');
            const { data: existingTutor, error: retryError } = await supabase
              .from('tutors')
              .select('id')
              .eq('user_id', user.id)
              .single();
            
            if (retryError || !existingTutor) {
              console.error('Error re-querying tutor after concurrent creation:', retryError);
              return null;
            }
            
            return existingTutor.id;
          }
          
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
    console.error('Error ensuring tutor profile:', error);
    return null;
  }
}

// Backward compatibility wrapper
export async function getCurrentTutorId(): Promise<string | null> {
  const id = await ensureTutorProfile();
  return id ? String(id) : null;
}