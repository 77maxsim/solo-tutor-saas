/**
 * Test script for Google Calendar connection reset migration
 * Run this in development to verify the migration works correctly
 */

import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Missing Supabase credentials');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function testMigration() {
  console.log('🧪 Testing Google Calendar connection reset migration\n');

  try {
    // Step 1: Check current state
    console.log('1️⃣ Checking current state...');
    const { data: beforeData, error: beforeError } = await supabase
      .from('tutors')
      .select('id, full_name, google_calendar_connected, sync_google_calendar, google_access_token')
      .or('google_calendar_connected.eq.true,sync_google_calendar.eq.true,google_access_token.not.is.null');

    if (beforeError) {
      console.error('❌ Error fetching initial state:', beforeError);
      return;
    }

    console.log(`   Found ${beforeData?.length || 0} tutors with Google Calendar connections\n`);
    
    if (beforeData && beforeData.length > 0) {
      console.log('   Affected tutors:');
      beforeData.forEach(tutor => {
        console.log(`   - ${tutor.full_name} (ID: ${tutor.id})`);
        console.log(`     Connected: ${tutor.google_calendar_connected}, Sync: ${tutor.sync_google_calendar}, Has token: ${!!tutor.google_access_token}`);
      });
      console.log();
    }

    // Step 2: Run the migration
    console.log('2️⃣ Running migration...');
    const { data: updateData, error: updateError } = await supabase
      .from('tutors')
      .update({
        google_calendar_connected: false,
        sync_google_calendar: false,
        google_access_token: null,
        google_refresh_token: null,
        google_token_expires_at: null
      })
      .or('google_calendar_connected.eq.true,sync_google_calendar.eq.true,google_access_token.not.is.null')
      .select();

    if (updateError) {
      console.error('❌ Migration failed:', updateError);
      return;
    }

    console.log(`   ✅ Successfully updated ${updateData?.length || 0} tutor(s)\n`);

    // Step 3: Verify the changes
    console.log('3️⃣ Verifying changes...');
    const { data: afterData, error: afterError } = await supabase
      .from('tutors')
      .select('id, full_name, google_calendar_connected, sync_google_calendar, google_access_token')
      .or('google_calendar_connected.eq.true,sync_google_calendar.eq.true,google_access_token.not.is.null');

    if (afterError) {
      console.error('❌ Error verifying changes:', afterError);
      return;
    }

    if (!afterData || afterData.length === 0) {
      console.log('   ✅ All Google Calendar connections have been reset');
      console.log('   ✅ All tutors will need to reconnect their calendars\n');
    } else {
      console.log(`   ⚠️  Warning: ${afterData.length} tutor(s) still have connections:`);
      afterData.forEach(tutor => {
        console.log(`   - ${tutor.full_name} (ID: ${tutor.id})`);
      });
      console.log();
    }

    // Step 4: Summary
    console.log('📊 Migration Test Summary:');
    console.log(`   - Tutors affected: ${beforeData?.length || 0}`);
    console.log(`   - Tutors updated: ${updateData?.length || 0}`);
    console.log(`   - Remaining connections: ${afterData?.length || 0}`);
    console.log(`   - Status: ${afterData?.length === 0 ? '✅ SUCCESS' : '⚠️  NEEDS REVIEW'}\n`);

    if (afterData?.length === 0) {
      console.log('✅ Migration test completed successfully!');
      console.log('   You can now run this migration in production.\n');
    }

  } catch (error) {
    console.error('❌ Unexpected error:', error);
    process.exit(1);
  }
}

// Run the test
testMigration();
