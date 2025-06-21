// Check actual session data from the application
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.log('Supabase credentials not found in environment');
  console.log('Available env vars:', Object.keys(process.env).filter(k => k.includes('SUPABASE')));
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkSessionData() {
  console.log('=== ACTUAL SESSION DATA CHECK ===\n');
  
  try {
    // Get a few sample sessions
    const { data: sessions, error } = await supabase
      .from('sessions')
      .select('*')
      .order('id', { ascending: false })
      .limit(3);

    if (error) {
      console.error('Error fetching sessions:', error);
      return;
    }

    if (!sessions || sessions.length === 0) {
      console.log('No sessions found in database');
      return;
    }

    console.log(`Found ${sessions.length} sample sessions:\n`);

    sessions.forEach((session, index) => {
      console.log(`--- Session ${index + 1} (ID: ${session.id}) ---`);
      console.log('Raw database values:');
      console.log(`  date: "${session.date}" (${typeof session.date})`);
      console.log(`  time: "${session.time}" (${typeof session.time})`);
      console.log(`  duration: ${session.duration} minutes`);
      console.log(`  status: ${session.status}`);
      console.log(`  created_at: ${session.created_at}`);
      
      // Show how this gets interpreted
      if (session.date && session.time) {
        const combined = `${session.date}T${session.time}`;
        const jsDate = new Date(combined);
        
        console.log('\nInterpretation:');
        console.log(`  Combined: "${combined}"`);
        console.log(`  JS Date: ${jsDate.toString()}`);
        console.log(`  UTC: ${jsDate.toISOString()}`);
        console.log(`  Local: ${jsDate.toLocaleString()}`);
        
        // Calculate end time
        const endTime = new Date(jsDate.getTime() + session.duration * 60 * 1000);
        console.log(`  End time: ${endTime.toLocaleString()}`);
      }
      
      console.log('');
    });

    // Check table structure
    console.log('=== VERIFYING TABLE STRUCTURE ===');
    
    // Try to access columns that might not exist
    const { data: structureTest, error: structError } = await supabase
      .from('sessions')
      .select('id, date, time, start_time, end_time, session_start, session_end')
      .limit(1);
      
    if (structError) {
      console.log('Structure test error (expected if columns don\'t exist):');
      console.log(structError.message);
    } else {
      console.log('Available time-related columns detected:');
      if (structureTest && structureTest[0]) {
        const sample = structureTest[0];
        Object.keys(sample).forEach(key => {
          if (key.includes('time') || key.includes('date') || key.includes('start') || key.includes('end')) {
            console.log(`  ${key}: ${sample[key]}`);
          }
        });
      }
    }

  } catch (error) {
    console.error('Check failed:', error);
  }
}

checkSessionData();