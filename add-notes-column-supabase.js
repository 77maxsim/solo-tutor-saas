import { supabase } from './client/src/lib/supabaseClient.js';

async function addNotesColumn() {
  try {
    // Add notes column to sessions table
    const { error } = await supabase.rpc('exec_sql', {
      sql: 'ALTER TABLE sessions ADD COLUMN IF NOT EXISTS notes TEXT;'
    });
    
    if (error) {
      console.error('Error adding notes column:', error);
      return false;
    }
    
    console.log('Notes column added successfully to sessions table');
    return true;
  } catch (err) {
    console.error('Failed to add notes column:', err.message);
    return false;
  }
}

// Execute the function
addNotesColumn().then(success => {
  if (success) {
    console.log('Database migration completed successfully');
  } else {
    console.log('Database migration failed');
  }
  process.exit(success ? 0 : 1);
});