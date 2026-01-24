import TelegramBot from 'node-telegram-bot-api';
import { createClient } from '@supabase/supabase-js';
import dayjs from 'dayjs';
import utc from 'dayjs/plugin/utc.js';
import timezone from 'dayjs/plugin/timezone.js';

dayjs.extend(utc);
dayjs.extend(timezone);

const botToken = process.env.TELEGRAM_BOT_TOKEN;
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!botToken || !supabaseUrl || !supabaseKey) {
  console.error("⚠️ Missing Telegram environment variables - Telegram features disabled");
}

const supabase = createClient(supabaseUrl!, supabaseKey!);

// Create bot without polling initially
let bot: TelegramBot | null = null;
let isInitializing = false;
// In-memory cache for sent notifications (fallback if database column doesn't exist)
// Primary duplicate prevention now uses database column: tutors.last_daily_notification_date
// This persists across server restarts and prevents duplicates reliably
const sentNotifications = new Set<string>();
const sentBookingNotifications = new Set<string>();

// Cleanup function to stop bot polling
export async function cleanupTelegram() {
  if (bot) {
    try {
      await bot.stopPolling({ cancel: true, reason: 'Server restart' });
      console.log("🛑 Telegram bot polling stopped");
      bot = null;
    } catch (error) {
      console.error("Error stopping bot:", error);
      bot = null;
    }
  }
}

function formatCurrency(amount: number, currency: string = 'USD'): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: currency,
  }).format(amount);
}

function formatDateTime(utcTime: string, timezone: string, timeFormat: string = '24h'): string {
  const time = dayjs(utcTime).tz(timezone);
  if (timeFormat === '12h') {
    return time.format('MMMM D, YYYY [at] h:mm A');
  }
  return time.format('MMMM D, YYYY [at] HH:mm');
}

function formatTime(utcTime: string, timezone: string, timeFormat: string = '24h'): string {
  const time = dayjs(utcTime).tz(timezone);
  if (timeFormat === '12h') {
    return time.format('h:mm A');
  }
  return time.format('HH:mm');
}

async function calculateTodayEarnings(tutorId: number, timezone: string) {
  const now = dayjs().tz(timezone);
  const startOfToday = now.startOf('day').utc().toISOString();
  const endOfToday = now.endOf('day').utc().toISOString();

  const { data: sessions, error } = await supabase
    .from('sessions')
    .select('duration, rate, paid')
    .eq('tutor_id', tutorId)
    .eq('paid', true)
    .gte('session_start', startOfToday)
    .lte('session_start', endOfToday);

  if (error) {
    console.error('Error fetching today sessions:', error);
    return { earnings: 0, count: 0 };
  }

  const earnings = sessions.reduce((total, session) => {
    return total + (session.duration / 60) * session.rate;
  }, 0);

  return { earnings, count: sessions.length };
}

async function getTomorrowSessions(tutorId: number, timezone: string) {
  const now = dayjs().tz(timezone);
  const tomorrow = now.add(1, 'day');
  const startOfTomorrow = tomorrow.startOf('day').utc().toISOString();
  const endOfTomorrow = tomorrow.endOf('day').utc().toISOString();

  const { data: sessions, error } = await supabase
    .from('sessions')
    .select(`
      session_start,
      session_end,
      duration,
      rate,
      students (
        name
      )
    `)
    .eq('tutor_id', tutorId)
    .gte('session_start', startOfTomorrow)
    .lte('session_start', endOfTomorrow)
    .order('session_start', { ascending: true });

  if (error) {
    console.error('Error fetching tomorrow sessions:', error);
    return [];
  }

  return sessions.map((session: any) => ({
    ...session,
    student_name: session.students?.name || 'Unknown Student'
  }));
}

async function getTodayUnpaidSessions(tutorId: number, timezone: string) {
  const now = dayjs().tz(timezone);
  const startOfToday = now.startOf('day').utc().toISOString();
  const endOfToday = now.endOf('day').utc().toISOString();

  const { data: sessions, error } = await supabase
    .from('sessions')
    .select(`
      session_start,
      session_end,
      duration,
      rate,
      paid,
      students (
        name
      )
    `)
    .eq('tutor_id', tutorId)
    .eq('paid', false)
    .gte('session_start', startOfToday)
    .lte('session_start', endOfToday)
    .order('session_start', { ascending: true });

  if (error) {
    console.error('Error fetching today unpaid sessions:', error);
    return [];
  }

  return sessions.map((session: any) => ({
    ...session,
    student_name: session.students?.name || 'Unknown Student'
  }));
}

async function getPastUnpaidSessions(tutorId: number, timezone: string) {
  const now = dayjs().tz(timezone);
  const startOfToday = now.startOf('day').utc().toISOString();

  const { data: sessions, error } = await supabase
    .from('sessions')
    .select('duration, rate, paid')
    .eq('tutor_id', tutorId)
    .eq('paid', false)
    .lt('session_start', startOfToday);

  if (error) {
    console.error('Error fetching past unpaid sessions:', error);
    return { count: 0, amount: 0 };
  }

  const amount = sessions.reduce((total, session) => {
    return total + (session.duration / 60) * session.rate;
  }, 0);

  return { count: sessions.length, amount };
}

async function sendDailyNotification(tutor: any) {
  if (!bot) {
    console.warn('⚠️ Cannot send daily notification - bot not initialized');
    return;
  }

  try {
    const { id, telegram_chat_id, timezone, currency, time_format, full_name, last_daily_notification_date } = tutor;
    
    const today = dayjs().tz(timezone).format('YYYY-MM-DD');
    const now = dayjs().tz(timezone);
    
    console.log(`📋 [${full_name}] Evaluating for notification:
      - Current time: ${now.format('YYYY-MM-DD HH:mm:ss')} (${timezone})
      - Today's date: ${today}
      - Last notification date: ${last_daily_notification_date || 'NULL (never sent)'}
      - Telegram chat ID: ${telegram_chat_id}`);
    
    // Check if we already sent a notification today (database-persisted check)
    if (last_daily_notification_date === today) {
      console.log(`⏭️ [${full_name}] Skipping: Already sent today (DB shows ${last_daily_notification_date})`);
      return;
    }
    
    // Fallback: Also check in-memory cache for backwards compatibility
    const notificationKey = `${id}-${today}`;
    if (sentNotifications.has(notificationKey)) {
      console.log(`⏭️ [${full_name}] Skipping: Already in memory cache for ${today}`);
      return;
    }

    console.log(`📊 [${full_name}] ✅ Preparing notification (not sent today yet)`);

    const todayData = await calculateTodayEarnings(id, timezone);
    const todayUnpaidSessions = await getTodayUnpaidSessions(id, timezone);
    const pastUnpaidData = await getPastUnpaidSessions(id, timezone);
    const tomorrowSessions = await getTomorrowSessions(id, timezone);

    let message = `📊 *Daily Summary for ${dayjs().tz(timezone).format('MMMM D, YYYY')}*\n\n`;
    
    message += `💰 *Today's Earnings*\n`;
    message += `${formatCurrency(todayData.earnings, currency)} from ${todayData.count} session${todayData.count !== 1 ? 's' : ''}\n\n`;

    // Add today's unpaid sessions
    if (todayUnpaidSessions.length > 0) {
      message += `⚠️ *Today's Unpaid Sessions*\n`;
      todayUnpaidSessions.forEach((session: any, index: number) => {
        const startTime = formatTime(session.session_start, timezone, time_format);
        const endTime = formatTime(session.session_end, timezone, time_format);
        const amount = (session.duration / 60) * session.rate;
        message += `${index + 1}. ${session.student_name} • ${startTime} - ${endTime} • ${formatCurrency(amount, currency)}\n`;
      });
      
      const totalUnpaidToday = todayUnpaidSessions.reduce((total: number, session: any) => {
        return total + (session.duration / 60) * session.rate;
      }, 0);
      message += `*Total unpaid today:* ${formatCurrency(totalUnpaidToday, currency)}\n\n`;
    }

    // Add past unpaid sessions summary
    if (pastUnpaidData.count > 0) {
      message += `📋 *Past Unpaid Sessions*\n`;
      message += `${pastUnpaidData.count} overdue session${pastUnpaidData.count !== 1 ? 's' : ''} from previous days\n`;
      message += `*Total overdue:* ${formatCurrency(pastUnpaidData.amount, currency)}\n\n`;
    }

    message += `📅 *Tomorrow's Schedule*\n`;
    if (tomorrowSessions.length === 0) {
      message += `No sessions scheduled\n`;
    } else {
      tomorrowSessions.forEach((session: any, index: number) => {
        const startTime = formatTime(session.session_start, timezone, time_format);
        const endTime = formatTime(session.session_end, timezone, time_format);
        const earnings = (session.duration / 60) * session.rate;
        message += `${index + 1}. ${session.student_name} • ${startTime} - ${endTime} • ${formatCurrency(earnings, currency)}\n`;
      });
      
      const totalTomorrow = tomorrowSessions.reduce((total: number, session: any) => {
        return total + (session.duration / 60) * session.rate;
      }, 0);
      message += `\n*Total:* ${formatCurrency(totalTomorrow, currency)} from ${tomorrowSessions.length} session${tomorrowSessions.length !== 1 ? 's' : ''}`;
    }

    console.log(`📤 [${full_name}] Sending message to Telegram...`);
    await bot.sendMessage(telegram_chat_id, message, { parse_mode: 'Markdown' });
    console.log(`✅ [${full_name}] Message sent successfully to Telegram`);
    
    // Update database with today's date to prevent duplicates (persists across server restarts)
    console.log(`💾 [${full_name}] Updating database: last_daily_notification_date = ${today}`);
    const { error: updateError } = await supabase
      .from('tutors')
      .update({ last_daily_notification_date: today })
      .eq('id', id);
    
    if (updateError) {
      // If column doesn't exist or update fails, fall back to in-memory cache only
      console.error(`⚠️ [${full_name}] Database update FAILED:`, updateError.message);
      console.log(`   Using in-memory cache as fallback (duplicates possible on restart)`);
    } else {
      console.log(`✅ [${full_name}] Database updated successfully`);
    }
    
    // Always update in-memory cache as fallback
    sentNotifications.add(notificationKey);
    console.log(`✅ [${full_name}] Notification complete. Added to memory cache.`);

  } catch (error) {
    console.error(`❌ [${tutor.full_name || `Tutor ${tutor.id}`}] Error sending notification:`, error);
  }
}

async function checkAndSendNotifications() {
  try {
    const systemTime = dayjs().format('YYYY-MM-DD HH:mm:ss UTC');
    console.log(`\n🔔 ========== NOTIFICATION CHECK CYCLE ==========`);
    console.log(`⏰ System time: ${systemTime}`);
    
    // Try to fetch with last_daily_notification_date column (post-migration)
    let { data: tutors, error } = await supabase
      .from('tutors')
      .select('id, telegram_chat_id, timezone, currency, time_format, full_name, last_daily_notification_date')
      .not('telegram_chat_id', 'is', null);

    // If column doesn't exist (pre-migration), fetch without it
    // PostgreSQL error 42703 = "column does not exist"
    if (error && (error.code === '42703' || error.code === 'PGRST116')) {
      console.log('⚠️ last_daily_notification_date column not found, using fallback mode');
      const fallbackResult = await supabase
        .from('tutors')
        .select('id, telegram_chat_id, timezone, currency, time_format, full_name')
        .not('telegram_chat_id', 'is', null);
      
      tutors = fallbackResult.data as any;
      error = fallbackResult.error;
    }

    if (error || !tutors) {
      console.error('❌ Error fetching tutors for notifications:', error);
      return;
    }

    if (tutors.length === 0) {
      console.log('ℹ️ No tutors with Telegram connected');
      return;
    }

    console.log(`📊 Found ${tutors.length} tutor(s) subscribed to Telegram notifications`);
    console.log(`🕐 Notification window: 9:00 PM - 9:59 PM (1 hour) in each tutor's timezone\n`);

    for (const tutor of tutors) {
      const now = dayjs().tz(tutor.timezone);
      const hour = now.hour();
      const minute = now.minute();
      const currentTime = now.format('HH:mm:ss');
      const currentDate = now.format('YYYY-MM-DD');

      console.log(`👤 ${tutor.full_name}:`);
      console.log(`   Local time: ${currentTime} on ${currentDate} (${tutor.timezone})`);
      console.log(`   Last notification: ${tutor.last_daily_notification_date || 'NULL (never)'}`);

      // Check if it's within the 9 PM hour (21:00-21:59) - 1 hour window
      // The database column and sentNotifications Set prevent duplicates within the same day
      if (hour === 21) {
        console.log(`   ✅ IN NOTIFICATION WINDOW (hour ${hour})`);
        console.log(`   🚀 Triggering notification for ${tutor.full_name}...`);
        await sendDailyNotification(tutor);
      } else {
        console.log(`   ⏸️  Outside window (hour ${hour}, need hour 21)`);
      }
      console.log(''); // Empty line for readability
    }
    
    console.log(`🏁 ========== CHECK CYCLE COMPLETE ==========\n`);
  } catch (error) {
    console.error('❌ Error in checkAndSendNotifications:', error);
  }
}

async function resetDailyCache() {
  // Check if any tutor is currently in their notification window (21:00-21:59)
  // to prevent clearing the cache and causing duplicate notifications
  try {
    console.log(`🔄 Daily cache reset triggered at ${dayjs().format('YYYY-MM-DD HH:mm:ss UTC')}`);
    
    const { data: tutors } = await supabase
      .from('tutors')
      .select('timezone')
      .not('telegram_chat_id', 'is', null);

    if (tutors) {
      for (const tutor of tutors) {
        const now = dayjs().tz(tutor.timezone);
        const hour = now.hour();
        
        // Check if it's during the 1-hour notification window (21:00-21:59)
        if (hour === 21) {
          console.log(`⏳ Delaying cache reset - tutor in timezone ${tutor.timezone} is in notification window (hour ${hour})`);
          console.log(`   Will retry cache reset in 5 minutes`);
          // Retry in 5 minutes
          setTimeout(resetDailyCache, 5 * 60 * 1000);
          return;
        }
      }
    }
  } catch (error) {
    console.error('❌ Error checking notification windows during cache reset:', error);
  }

  const dailyCacheSize = sentNotifications.size;
  const bookingCacheSize = sentBookingNotifications.size;
  sentNotifications.clear();
  sentBookingNotifications.clear();
  console.log(`✅ Daily cache reset complete. Cleared ${dailyCacheSize} daily notification entries and ${bookingCacheSize} booking notification entries.`);
}

async function sendBookingNotification(session: any) {
  if (!bot) {
    console.warn('⚠️ Cannot send booking notification - bot not initialized');
    return;
  }

  try {
    const notificationKey = `booking-${session.id}`;
    if (sentBookingNotifications.has(notificationKey)) {
      console.log(`⏭️ Booking notification for session ${session.id} already sent, skipping duplicate`);
      return;
    }

    const { data: tutor, error: tutorError } = await supabase
      .from('tutors')
      .select('id, telegram_chat_id, timezone, currency, time_format, full_name')
      .eq('id', session.tutor_id)
      .single();

    if (tutorError || !tutor) {
      console.error('Error fetching tutor:', tutorError);
      return;
    }

    if (!tutor.telegram_chat_id) {
      console.log(`Tutor ${tutor.full_name} not subscribed to Telegram notifications`);
      return;
    }

    const studentName = session.unassigned_name || 'Unknown Student';
    const dateTime = formatDateTime(session.session_start, tutor.timezone, tutor.time_format);
    const earnings = (session.duration / 60) * parseFloat(session.rate);

    let message = `🔔 *New Booking Request!*\n\n`;
    message += `👤 *Student:* ${studentName}\n`;
    message += `📅 *Date:* ${dateTime}\n`;
    message += `⏱️ *Duration:* ${session.duration} minutes\n`;
    message += `💰 *Expected Earnings:* ${formatCurrency(earnings, tutor.currency)}\n\n`;
    message += `⚠️ _Pending your approval - check your dashboard_`;

    await bot.sendMessage(tutor.telegram_chat_id, message, { parse_mode: 'Markdown' });
    sentBookingNotifications.add(notificationKey);
    console.log(`✅ Booking notification sent to ${tutor.full_name} for session with ${studentName}`);
  } catch (error) {
    console.error('Error sending booking notification:', error);
  }
}

// Admin chat ID for receiving feedback notifications
const ADMIN_CHAT_ID = '1610008120';

export async function sendFeedbackNotification(feedback: {
  type: string;
  subject: string;
  message: string;
  userName: string;
  userEmail: string;
  feedbackId: number;
}) {
  if (!bot) {
    console.warn('⚠️ Cannot send feedback notification - bot not initialized');
    return { success: false, error: 'Bot not initialized' };
  }

  try {
    const telegramMessage = `📬 *New ${feedback.type}*\n\n` +
      `👤 *From:* ${feedback.userName}\n` +
      `📧 *Email:* ${feedback.userEmail}\n` +
      `📝 *Subject:* ${feedback.subject}\n\n` +
      `💬 *Message:*\n${feedback.message}\n\n` +
      `🆔 Feedback ID: #${feedback.feedbackId}`;

    await bot.sendMessage(ADMIN_CHAT_ID, telegramMessage, { parse_mode: 'Markdown' });
    console.log(`✅ Feedback notification sent to admin for feedback #${feedback.feedbackId}`);
    return { success: true };
  } catch (error) {
    console.error('❌ Error sending feedback notification:', error);
    return { success: false, error };
  }
}

export async function sendBroadcast(message: string, tutors: any[]) {
  if (!bot) {
    console.warn('⚠️ Cannot send broadcast - bot not initialized');
    return { success: false, sent: 0, failed: tutors.length };
  }

  let sent = 0;
  let failed = 0;

  for (const tutor of tutors) {
    try {
      await bot.sendMessage(
        tutor.telegram_chat_id, 
        `📢 *Announcement from Classter*\n\n${message}`,
        { parse_mode: 'Markdown' }
      );
      console.log(`✅ Broadcast sent to ${tutor.full_name}`);
      sent++;
    } catch (error) {
      console.error(`❌ Failed to send broadcast to ${tutor.full_name}:`, error);
      failed++;
    }
  }

  return { success: true, sent, failed };
}

export async function initializeTelegram() {
  if (!botToken || !supabaseUrl || !supabaseKey) {
    console.warn("⚠️ Telegram bot not initialized - missing environment variables");
    return;
  }

  // Prevent multiple initializations at once
  if (isInitializing) {
    console.log("⏳ Bot initialization already in progress, skipping...");
    return;
  }

  isInitializing = true;

  try {
    // Stop existing bot instance if any
    if (bot) {
      console.log("🛑 Stopping existing Telegram bot instance...");
      await cleanupTelegram();
      // Wait for cleanup to complete and Telegram to release the webhook
      await new Promise(resolve => setTimeout(resolve, 2000));
    }

    console.log("🚀 Starting Telegram bot...");
    
    // First, create a temporary bot to delete any webhook
    const tempBot = new TelegramBot(botToken!, { polling: false });
    try {
      await tempBot.deleteWebHook();
      console.log("🧹 Cleared any existing webhooks");
    } catch (error) {
      console.log("ℹ️ No webhook to clear");
    }
    
    // Create new bot instance with polling
    bot = new TelegramBot(botToken!, { 
      polling: {
        interval: 1000,
        autoStart: true,
        params: {
          timeout: 10
        }
      }
    });

    bot.getMe().then((botInfo) => {
      console.log("✅ Classter Telegram bot is running!");
      console.log(`📱 Bot username: @${botInfo.username}`);
      console.log(`🔗 Bot link: https://t.me/${botInfo.username}`);
    }).catch((error) => {
      console.error("❌ Error getting bot info:", error);
    });

    bot.on('message', async (msg) => {
      const chatId = msg.chat.id;
      const userInput = msg.text?.trim();
      const name = msg.from?.first_name || "there";

      if (!bot) {
        console.warn('⚠️ Bot is null in message handler');
        return;
      }

      if (!userInput || !userInput.includes('@')) {
        await bot.sendMessage(chatId, `👋 Hi ${name}! Please reply with your email (the one you used to sign up in Classter).`);
        return;
      }

      try {
        const { data, error } = await supabase
          .from('tutors')
          .update({ telegram_chat_id: chatId.toString() })
          .eq('email', userInput.toLowerCase())
          .select();

        if (error) {
          console.error("❌ Supabase update error:", error);
          await bot.sendMessage(chatId, `❌ Something went wrong while saving your Telegram subscription. Please try again later.`);
        } else if (!data || data.length === 0) {
          await bot.sendMessage(chatId, `⚠️ Couldn't find a tutor with that email. Please double-check and try again.`);
        } else {
          await bot.sendMessage(chatId, `✅ You're now subscribed to daily updates from Classter!`);
          console.log(`✅ chat_id saved for: ${userInput}`);
        }
      } catch (err) {
        console.error("❌ Unexpected error:", err);
        await bot.sendMessage(chatId, `❌ Something went wrong. Please try again later.`);
      }
    });

    bot.on('polling_error', (error: any) => {
      // 409 conflicts can happen during development when the server restarts quickly
      // The old instance hasn't fully released yet - this resolves itself
      if (error.response?.statusCode === 409) {
        console.log('ℹ️ Polling conflict detected (resolving automatically)');
        return;
      }
      console.error('❌ Telegram polling error:', error);
    });

    const sessionChannel = supabase
      .channel('sessions-pending')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'sessions',
          filter: 'status=eq.pending'
        },
        (payload) => {
          console.log('📬 New booking request received:', payload.new);
          sendBookingNotification(payload.new);
        }
      )
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          console.log('📡 Real-time booking notifications active');
        }
      });

    console.log("📱 Classter notification scheduler is running...");
    console.log("⏰ Checking for 9 PM notifications every minute");

    checkAndSendNotifications();
    setInterval(checkAndSendNotifications, 60 * 1000);
    setInterval(resetDailyCache, 24 * 60 * 60 * 1000);
  } catch (error) {
    console.error('❌ Failed to initialize Telegram bot:', error);
  } finally {
    isInitializing = false;
  }
}
