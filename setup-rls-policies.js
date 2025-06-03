import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function setupRLSPolicies() {
  try {
    console.log('Setting up Row Level Security policies...');

    // Enable RLS on all tables
    const tables = ['tutors', 'students', 'sessions', 'payments'];
    
    for (const table of tables) {
      console.log(`Enabling RLS on ${table} table...`);
      const { error } = await supabase.rpc('sql', {
        query: `ALTER TABLE ${table} ENABLE ROW LEVEL SECURITY;`
      });
      
      if (error) {
        console.error(`Error enabling RLS on ${table}:`, error);
      } else {
        console.log(`✓ RLS enabled on ${table}`);
      }
    }

    // Create RLS policies
    console.log('\nCreating RLS policies...');

    // Tutors table policies
    console.log('Creating tutors table policies...');
    await supabase.rpc('sql', {
      query: `
        CREATE POLICY "Users can view own tutor record" ON tutors
        FOR SELECT USING (auth.uid() = user_id);
        
        CREATE POLICY "Users can update own tutor record" ON tutors
        FOR UPDATE USING (auth.uid() = user_id);
        
        CREATE POLICY "Users can insert own tutor record" ON tutors
        FOR INSERT WITH CHECK (auth.uid() = user_id);
      `
    });

    // Students table policies
    console.log('Creating students table policies...');
    await supabase.rpc('sql', {
      query: `
        CREATE POLICY "Users can view own students" ON students
        FOR SELECT USING (
          tutor_id IN (
            SELECT id FROM tutors WHERE user_id = auth.uid()
          )
        );
        
        CREATE POLICY "Users can insert own students" ON students
        FOR INSERT WITH CHECK (
          tutor_id IN (
            SELECT id FROM tutors WHERE user_id = auth.uid()
          )
        );
        
        CREATE POLICY "Users can update own students" ON students
        FOR UPDATE USING (
          tutor_id IN (
            SELECT id FROM tutors WHERE user_id = auth.uid()
          )
        );
        
        CREATE POLICY "Users can delete own students" ON students
        FOR DELETE USING (
          tutor_id IN (
            SELECT id FROM tutors WHERE user_id = auth.uid()
          )
        );
      `
    });

    // Sessions table policies
    console.log('Creating sessions table policies...');
    await supabase.rpc('sql', {
      query: `
        CREATE POLICY "Users can view own sessions" ON sessions
        FOR SELECT USING (
          tutor_id IN (
            SELECT id FROM tutors WHERE user_id = auth.uid()
          )
        );
        
        CREATE POLICY "Users can insert own sessions" ON sessions
        FOR INSERT WITH CHECK (
          tutor_id IN (
            SELECT id FROM tutors WHERE user_id = auth.uid()
          )
        );
        
        CREATE POLICY "Users can update own sessions" ON sessions
        FOR UPDATE USING (
          tutor_id IN (
            SELECT id FROM tutors WHERE user_id = auth.uid()
          )
        );
        
        CREATE POLICY "Users can delete own sessions" ON sessions
        FOR DELETE USING (
          tutor_id IN (
            SELECT id FROM tutors WHERE user_id = auth.uid()
          )
        );
      `
    });

    // Payments table policies
    console.log('Creating payments table policies...');
    await supabase.rpc('sql', {
      query: `
        CREATE POLICY "Users can view own payments" ON payments
        FOR SELECT USING (
          tutor_id IN (
            SELECT id FROM tutors WHERE user_id = auth.uid()
          )
        );
        
        CREATE POLICY "Users can insert own payments" ON payments
        FOR INSERT WITH CHECK (
          tutor_id IN (
            SELECT id FROM tutors WHERE user_id = auth.uid()
          )
        );
        
        CREATE POLICY "Users can update own payments" ON payments
        FOR UPDATE USING (
          tutor_id IN (
            SELECT id FROM tutors WHERE user_id = auth.uid()
          )
        );
        
        CREATE POLICY "Users can delete own payments" ON payments
        FOR DELETE USING (
          tutor_id IN (
            SELECT id FROM tutors WHERE user_id = auth.uid()
          )
        );
      `
    });

    console.log('\n✅ All RLS policies created successfully!');
    console.log('Data isolation is now properly configured.');

  } catch (error) {
    console.error('Error setting up RLS policies:', error);
  }
}

setupRLSPolicies();