const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_ANON_KEY;

const supabase = createClient(supabaseUrl, supabaseKey);

async function updateTutorTimezone() {
  try {
    // Update timezone directly using known user ID
    const userId = '7bf25f7b-6b36-43c7-9e0c-5f5b0b5a8e9a';
    console.log('Updating timezone for user:', userId);

    // Update tutor timezone
    const { data, error } = await supabase
      .from('tutors')
      .update({ timezone: 'Europe/Kyiv' })
      .eq('user_id', userId)
      .select();

    if (error) {
      console.error('Error updating timezone:', error);
    } else {
      console.log('Timezone updated successfully:', data);
    }
  } catch (error) {
    console.error('Script error:', error);
  }
}

updateTutorTimezone();