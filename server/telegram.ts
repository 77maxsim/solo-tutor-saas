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
const sentNotifications = new Set<string>();
const sentBookingNotifications = new Set<string>();

// Cleanup function to stop bot polling
export function cleanupTelegram() {
  if (bot) {
    try {
      bot.stopPolling();
      console.log("🛑 Telegram bot polling stopped");
    } catch (error) {
      console.error("Error stopping bot:", error);
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
    const { id, telegram_chat_id, timezone, currency, time_format, full_name } = tutor;
    
    const notificationKey = `${id}-${dayjs().tz(timezone).format('YYYY-MM-DD')}`;
    if (sentNotifications.has(notificationKey)) {
      return;
    }

    console.log(`📊 Preparing notification for ${full_name} (${timezone})`);

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

    await bot.sendMessage(telegram_chat_id, message, { parse_mode: 'Markdown' });
    
    sentNotifications.add(notificationKey);
    console.log(`✅ Notification sent to ${full_name}`);

  } catch (error) {
    console.error(`Error sending notification to tutor ${tutor.id}:`, error);
  }
}

async function checkAndSendNotifications() {
  try {
    const { data: tutors, error } = await supabase
      .from('tutors')
      .select('id, telegram_chat_id, timezone, currency, time_format, full_name')
      .not('telegram_chat_id', 'is', null);

    if (error) {
      console.error('Error fetching tutors:', error);
      return;
    }

    for (const tutor of tutors) {
      const now = dayjs().tz(tutor.timezone);
      const hour = now.hour();
      const minute = now.minute();

      if (hour === 21 && minute === 0) {
        await sendDailyNotification(tutor);
      }
    }
  } catch (error) {
    console.error('Error in checkAndSendNotifications:', error);
  }
}

function resetDailyCache() {
  const cacheSize = sentNotifications.size;
  sentNotifications.clear();
  console.log(`🔄 Daily cache reset. Cleared ${cacheSize} entries.`);
}

async function sendBookingNotification(session: any) {
  if (!bot) {
    console.warn('⚠️ Cannot send booking notification - bot not initialized');
    return;
  }

  try {
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
    console.log(`✅ Booking notification sent to ${tutor.full_name} for session with ${studentName}`);
  } catch (error) {
    console.error('Error sending booking notification:', error);
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
        `📢 *Announcement from TutorTrack*\n\n${message}`,
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

export function initializeTelegram() {
  if (!botToken || !supabaseUrl || !supabaseKey) {
    console.warn("⚠️ Telegram bot not initialized - missing environment variables");
    return;
  }

  // Stop existing bot instance if any
  if (bot) {
    try {
      bot.stopPolling();
      console.log("🛑 Stopped existing Telegram bot instance");
    } catch (error) {
      console.error("Error stopping existing bot:", error);
    }
  }

  // Create new bot instance with polling
  bot = new TelegramBot(botToken!, { polling: true });

  bot.getMe().then((botInfo) => {
    console.log("🤖 TutorTrack Telegram bot is running...");
    console.log(`📱 Bot username: @${botInfo.username}`);
    console.log(`🔗 Bot link: https://t.me/${botInfo.username}`);
  }).catch((error) => {
    console.error("Error getting bot info:", error);
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
      await bot.sendMessage(chatId, `👋 Hi ${name}! Please reply with your email (the one you used to sign up in TutorTrack).`);
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
        await bot.sendMessage(chatId, `✅ You're now subscribed to daily updates from TutorTrack!`);
        console.log(`✅ chat_id saved for: ${userInput}`);
      }
    } catch (err) {
      console.error("❌ Unexpected error:", err);
      await bot.sendMessage(chatId, `❌ Something went wrong. Please try again later.`);
    }
  });

  bot.on('polling_error', (error: any) => {
    // Ignore 409 conflicts during development (happens when server restarts)
    if (error.response?.statusCode === 409) {
      console.warn('⚠️ Telegram polling conflict (another instance running) - this is normal during development restarts');
      return;
    }
    console.error('Polling error:', error);
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

  console.log("📱 TutorTrack notification scheduler is running...");
  console.log("⏰ Checking for 9 PM notifications every minute");

  checkAndSendNotifications();
  setInterval(checkAndSendNotifications, 60 * 1000);
  setInterval(resetDailyCache, 24 * 60 * 60 * 1000);
}
