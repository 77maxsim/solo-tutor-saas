import { createClient } from '@supabase/supabase-js';
import { DateTime } from 'luxon';

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function fixNullTimestamps() {
  try {
    console.log('🔍 Finding sessions with null timestamps...');
    
    // Find sessions with null timestamps but valid date/time fields
    const { data: sessionsToFix, error: fetchError } = await supabase
      .from('sessions')
      .select('id, date, time, duration, tutor_id')
      .is('session_start', null)
      .is('session_end', null)
      .not('date', 'is', null)
      .not('time', 'is', null);

    if (fetchError) {
      console.error('Error fetching sessions:', fetchError);
      return;
    }

    console.log(`Found ${sessionsToFix.length} sessions to fix`);

    for (const session of sessionsToFix) {
      console.log(`Fixing session ${session.id.substring(0, 8)}...`);
      
      try {
        // Convert legacy date/time to UTC timestamps using Europe/Kyiv timezone
        const tutorTz = 'Europe/Kyiv';
        const dateTimeStr = `${session.date} ${session.time}`;
        
        console.log(`Converting: ${dateTimeStr} (${tutorTz})`);
        
        // Parse the datetime in tutor timezone
        let sessionStart = DateTime.fromFormat(dateTimeStr, 'yyyy-MM-dd HH:mm', { zone: tutorTz });
        
        if (!sessionStart.isValid) {
          // Try alternative format
          sessionStart = DateTime.fromFormat(dateTimeStr, 'yyyy-M-d H:mm', { zone: tutorTz });
        }
        
        if (!sessionStart.isValid) {
          console.error(`Failed to parse datetime: ${dateTimeStr}`);
          continue;
        }
        
        const sessionStartUTC = sessionStart.toUTC().toISO();
        const sessionEndUTC = sessionStart.plus({ minutes: session.duration || 60 }).toUTC().toISO();
        
        console.log(`UTC timestamps: ${sessionStartUTC} to ${sessionEndUTC}`);
        
        // Update the session with UTC timestamps
        const { error: updateError } = await supabase
          .from('sessions')
          .update({
            session_start: sessionStartUTC,
            session_end: sessionEndUTC
          })
          .eq('id', session.id);

        if (updateError) {
          console.error(`Error updating session ${session.id}:`, updateError);
        } else {
          console.log(`✅ Fixed session ${session.id.substring(0, 8)}`);
        }
        
      } catch (error) {
        console.error(`Error processing session ${session.id}:`, error);
      }
    }
    
    console.log('🎉 Timestamp repair completed');
    
  } catch (error) {
    console.error('Script error:', error);
  }
}

fixNullTimestamps();