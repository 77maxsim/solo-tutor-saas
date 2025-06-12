import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('Missing Supabase environment variables');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function addEarningsCardOrderColumn() {
  try {
    console.log('Checking earnings_card_order column in tutors table...');
    
    // Try to query the tutors table to see if the column exists
    const { data: existingTutors, error: queryError } = await supabase
      .from('tutors')
      .select('earnings_card_order')
      .limit(1);

    if (queryError && queryError.code === 'PGRST116') {
      console.log('Column does not exist, need to add it manually through Supabase dashboard.');
      console.log('Please run this SQL in your Supabase SQL Editor:');
      console.log('ALTER TABLE tutors ADD COLUMN earnings_card_order JSONB;');
      return;
    }

    if (existingTutors) {
      console.log('Column earnings_card_order already exists!');
      return;
    }

    console.log('Successfully verified earnings_card_order column exists');

  } catch (error) {
    console.error('Unexpected error:', error);
    console.log('Please manually add the column using Supabase dashboard:');
    console.log('ALTER TABLE tutors ADD COLUMN earnings_card_order JSONB;');
  }
}

addEarningsCardOrderColumn();