import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function addStatusColumn() {
  try {
    // Add status column if it doesn't exist
    await supabase.rpc('exec_sql', {
      sql: `
        ALTER TABLE sessions ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'confirmed';
        UPDATE sessions SET status = 'confirmed' WHERE status IS NULL;
        CREATE INDEX IF NOT EXISTS idx_sessions_status ON sessions(status);
        CREATE INDEX IF NOT EXISTS idx_sessions_tutor_status ON sessions(tutor_id, status);
      `
    });

    console.log('✅ Status column added successfully');

    // Create some test pending sessions
    const tutorId = '7bf25f7b-f16e-4d75-9847-087276da4e0b';
    const today = new Date();
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    const testPendingSessions = [
      {
        tutor_id: tutorId,
        student_id: null,
        date: tomorrow.toISOString().split('T')[0],
        time: '10:00',
        duration: 60,
        rate: 0,
        paid: false,
        status: 'pending',
        unassigned_name: 'Emma Johnson',
        notes: 'Math tutoring request from public booking'
      },
      {
        tutor_id: tutorId,
        student_id: null,
        date: tomorrow.toISOString().split('T')[0],
        time: '14:00',
        duration: 90,
        rate: 0,
        paid: false,
        status: 'pending',
        unassigned_name: 'Alex Chen',
        notes: 'Physics help needed'
      }
    ];

    const { data, error } = await supabase
      .from('sessions')
      .insert(testPendingSessions)
      .select();

    if (error) {
      console.log('Error creating test sessions:', error.message);
    } else {
      console.log('✅ Created', data?.length || 0, 'test pending sessions');
    }

  } catch (error) {
    console.log('Error:', error.message);
  }
}

addStatusColumn();