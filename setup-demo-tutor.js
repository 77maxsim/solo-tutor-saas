import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function setupDemoTutor() {
  try {
    console.log('Setting up demo tutor and booking data...');
    
    // Create a demo tutor
    const { data: tutor, error: tutorError } = await supabase
      .from('tutors')
      .insert({
        full_name: 'Sarah Johnson',
        email: 'sarah.johnson@example.com',
        user_id: null // For demo purposes
      })
      .select()
      .single();
    
    if (tutorError) {
      console.log('Error creating tutor:', tutorError.message);
      return;
    }
    
    console.log('✅ Demo tutor created:', tutor.full_name, 'ID:', tutor.id);
    
    // Create booking slots for the next few days
    const slots = [];
    const today = new Date();
    
    for (let i = 1; i <= 3; i++) {
      const date = new Date(today);
      date.setDate(today.getDate() + i);
      
      // Morning slot: 10:00 AM - 11:00 AM
      const morningStart = new Date(date);
      morningStart.setHours(10, 0, 0, 0);
      const morningEnd = new Date(morningStart);
      morningEnd.setHours(11, 0, 0, 0);
      
      // Afternoon slot: 2:00 PM - 3:00 PM
      const afternoonStart = new Date(date);
      afternoonStart.setHours(14, 0, 0, 0);
      const afternoonEnd = new Date(afternoonStart);
      afternoonEnd.setHours(15, 0, 0, 0);
      
      slots.push(
        {
          tutor_id: tutor.id,
          start_time: morningStart.toISOString(),
          end_time: morningEnd.toISOString(),
          is_active: true
        },
        {
          tutor_id: tutor.id,
          start_time: afternoonStart.toISOString(),
          end_time: afternoonEnd.toISOString(),
          is_active: true
        }
      );
    }
    
    const { data: createdSlots, error: slotsError } = await supabase
      .from('booking_slots')
      .insert(slots)
      .select();
    
    if (slotsError) {
      console.log('Error creating booking slots:', slotsError.message);
    } else {
      console.log('✅ Created', createdSlots.length, 'booking slots');
    }
    
    console.log(`\n🎉 Demo setup complete!`);
    console.log(`📱 Test the booking page at: http://localhost:5000/booking/${tutor.id}`);
    
    return tutor.id;
    
  } catch (error) {
    console.log('Setup error:', error.message);
  }
}

setupDemoTutor();