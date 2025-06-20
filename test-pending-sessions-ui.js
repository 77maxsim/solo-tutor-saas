import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function createMultiplePendingSessions() {
  try {
    const tutorId = '7bf25f7b-f16e-4d75-9847-087276da4e0b';
    const today = new Date();
    
    // Create multiple pending sessions for testing the UI
    const testSessions = [];
    
    // Tomorrow at different times
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    
    // Day after tomorrow
    const dayAfter = new Date(today);
    dayAfter.setDate(dayAfter.getDate() + 2);
    
    // Update existing confirmed sessions to pending for demo
    const { data: existingSessions } = await supabase
      .from('sessions')
      .select('id')
      .eq('tutor_id', tutorId)
      .eq('status', 'confirmed')
      .limit(3);
    
    if (existingSessions && existingSessions.length > 0) {
      // Update the first few sessions to pending status
      const pendingUpdates = [
        { id: existingSessions[0].id, name: 'Emma Thompson', notes: 'Math tutoring for calculus' },
        { id: existingSessions[1]?.id, name: 'David Martinez', notes: 'Physics homework help' },
        { id: existingSessions[2]?.id, name: 'Sophie Chen', notes: 'Chemistry lab preparation' }
      ].filter(item => item.id);
      
      for (const update of pendingUpdates) {
        const { error } = await supabase
          .from('sessions')
          .update({
            status: 'pending',
            unassigned_name: update.name,
            notes: update.notes
          })
          .eq('id', update.id);
        
        if (error) {
          console.log('Error updating session:', error.message);
        } else {
          console.log(`✅ Created pending session for ${update.name}`);
        }
      }
      
      console.log('📅 Visit calendar to see the pending sessions section');
      console.log('🔔 Check sidebar for notification badge');
    } else {
      console.log('No existing sessions found to convert');
    }

  } catch (error) {
    console.log('Error:', error.message);
  }
}

createMultiplePendingSessions();