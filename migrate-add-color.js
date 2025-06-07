
import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

// Load environment variables
dotenv.config();

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY; // You'll need this for admin operations

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('Missing Supabase environment variables');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function addColorColumn() {
  try {
    console.log('Adding color column to sessions table...');
    
    // Add the color column
    const { error } = await supabase.rpc('sql', {
      query: `
        ALTER TABLE sessions ADD COLUMN IF NOT EXISTS color TEXT DEFAULT '#3B82F6';
        
        -- Update existing sessions to have a default color
        UPDATE sessions SET color = '#3B82F6' WHERE color IS NULL;
      `
    });

    if (error) {
      console.error('Error adding color column:', error);
      return;
    }

    console.log('Successfully added color column to sessions table!');
  } catch (error) {
    console.error('Error:', error);
  }
}

addColorColumn();
