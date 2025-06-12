import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('Missing Supabase environment variables');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function addDashboardCardOrderColumn() {
  try {
    console.log('Adding dashboard_card_order column to tutors table...');
    
    // Add the column using raw SQL
    const { data, error } = await supabase.rpc('exec_sql', {
      sql: `
        ALTER TABLE tutors ADD COLUMN IF NOT EXISTS dashboard_card_order JSONB;
        COMMENT ON COLUMN tutors.dashboard_card_order IS 'Stores the order of dashboard cards as a JSON array of card objects with id and title';
      `
    });

    if (error) {
      console.error('Error adding column:', error);
      return;
    }

    console.log('Successfully added dashboard_card_order column');
    
    // Verify the column was added
    const { data: columns, error: checkError } = await supabase
      .from('information_schema.columns')
      .select('column_name, data_type')
      .eq('table_name', 'tutors')
      .eq('column_name', 'dashboard_card_order');

    if (checkError) {
      console.error('Error checking column:', checkError);
    } else {
      console.log('Column verification:', columns);
    }

  } catch (error) {
    console.error('Unexpected error:', error);
  }
}

addDashboardCardOrderColumn();