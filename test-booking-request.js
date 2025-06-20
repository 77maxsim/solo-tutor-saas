import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_ANON_KEY // Using anon key to simulate public access
);

async function testBookingRequest() {
  try {
    console.log('Testing public booking functionality...');
    
    // 1. Find available tutors first
    console.log('\n1. Finding available tutors...');
    const { data: tutorData, error: tutorError } = await supabase
      .from('tutors')
      .select('id, full_name, email')
      .limit(5);
    
    if (tutorError) {
      console.log('❌ Tutor fetch failed:', tutorError.message);
      return;
    }
    
    if (!tutorData || tutorData.length === 0) {
      console.log('❌ No tutors found in database');
      return;
    }
    
    console.log('✅ Found', tutorData.length, 'tutors:');
    tutorData.forEach((t, i) => {
      console.log(`   ${i + 1}. ${t.full_name} (ID: ${t.id})`);
    });
    
    const tutor = tutorData[0];
    const tutorId = tutor.id;
    
    if (tutorError) {
      console.log('❌ Tutor fetch failed:', tutorError.message);
      return;
    }
    console.log('✅ Tutor found:', tutor.full_name);
    
    // 2. Test fetching booking slots (should work with public access)
    console.log('\n2. Testing booking slots fetch...');
    const { data: slots, error: slotsError } = await supabase
      .from('booking_slots')
      .select('id, start_time, end_time, is_active, tutor_id')
      .eq('tutor_id', tutorId)
      .eq('is_active', true)
      .order('start_time', { ascending: true });
    
    if (slotsError) {
      console.log('❌ Booking slots fetch failed:', slotsError.message);
      return;
    }
    console.log('✅ Found', slots?.length || 0, 'available booking slots');
    
    if (slots && slots.length > 0) {
      console.log('   Sample slot:', {
        id: slots[0].id,
        start_time: slots[0].start_time,
        end_time: slots[0].end_time
      });
      
      // 3. Test creating a booking request (should work with public access)
      console.log('\n3. Testing booking request creation...');
      
      const slot = slots[0];
      const startTime = new Date(slot.start_time);
      const endTime = new Date(slot.end_time);
      const date = startTime.toISOString().split('T')[0];
      const time = startTime.toTimeString().slice(0, 5);
      const duration = Math.round((endTime.getTime() - startTime.getTime()) / (1000 * 60));
      
      const bookingData = {
        tutor_id: tutorId,
        student_id: null,
        date: date,
        time: time,
        duration: duration,
        rate: 0,
        paid: false,
        unassigned_name: 'Test Student',
        notes: 'Test booking request from automated test'
      };
      
      console.log('   Creating session with data:', {
        tutor_id: bookingData.tutor_id,
        date: bookingData.date,
        time: bookingData.time,
        duration: bookingData.duration,
        unassigned_name: bookingData.unassigned_name
      });
      
      const { data: session, error: sessionError } = await supabase
        .from('sessions')
        .insert(bookingData)
        .select()
        .single();
      
      if (sessionError) {
        console.log('❌ Booking request failed:', sessionError.message);
        console.log('   Full error:', sessionError);
        return;
      }
      
      console.log('✅ Booking request created successfully!');
      console.log('   Session ID:', session.id);
      console.log('   Student name:', session.unassigned_name);
      console.log('   Date/Time:', session.date, session.time);
      
      // 4. Verify the session was created
      console.log('\n4. Verifying session in database...');
      const { data: createdSession, error: verifyError } = await supabase
        .from('sessions')
        .select('*')
        .eq('id', session.id)
        .single();
      
      if (verifyError) {
        console.log('❌ Session verification failed:', verifyError.message);
      } else {
        console.log('✅ Session verified in database');
        console.log('   Full session data:', {
          id: createdSession.id,
          tutor_id: createdSession.tutor_id,
          student_id: createdSession.student_id,
          unassigned_name: createdSession.unassigned_name,
          date: createdSession.date,
          time: createdSession.time,
          duration: createdSession.duration
        });
      }
    } else {
      console.log('❌ No booking slots available for testing');
    }
    
    console.log('\n🎉 Public booking system test completed!');
    console.log(`📱 Visit the booking page at: http://localhost:5000/booking/${tutorId}`);
    
  } catch (error) {
    console.log('❌ Test failed with error:', error.message);
  }
}

testBookingRequest();