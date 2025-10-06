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
  throw new Error("Missing required environment variables");
}

const supabase = createClient(supabaseUrl, supabaseKey);
const bot = new TelegramBot(botToken);

const sentNotifications = new Set();

function formatCurrency(amount, currency = 'USD') {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: currency,
  }).format(amount);
}

function formatTime(utcTime, timezone, timeFormat = '24h') {
  const time = dayjs(utcTime).tz(timezone);
  if (timeFormat === '12h') {
    return time.format('h:mm A');
  }
  return time.format('HH:mm');
}

async function calculateTodayEarnings(tutorId, timezone) {
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

async function getTomorrowSessions(tutorId, timezone) {
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

  return sessions.map(session => ({
    ...session,
    student_name: session.students?.name || 'Unknown Student'
  }));
}

async function sendDailyNotification(tutor) {
  try {
    const { id, telegram_chat_id, timezone, currency, time_format, full_name } = tutor;
    
    const notificationKey = `${id}-${dayjs().tz(timezone).format('YYYY-MM-DD')}`;
    if (sentNotifications.has(notificationKey)) {
      return;
    }

    console.log(`📊 Preparing notification for ${full_name} (${timezone})`);

    const todayData = await calculateTodayEarnings(id, timezone);
    const tomorrowSessions = await getTomorrowSessions(id, timezone);

    let message = `📊 *Daily Summary for ${dayjs().tz(timezone).format('MMMM D, YYYY')}*\n\n`;
    
    message += `💰 *Today's Earnings*\n`;
    message += `${formatCurrency(todayData.earnings, currency)} from ${todayData.count} session${todayData.count !== 1 ? 's' : ''}\n\n`;

    message += `📅 *Tomorrow's Schedule*\n`;
    if (tomorrowSessions.length === 0) {
      message += `No sessions scheduled\n`;
    } else {
      tomorrowSessions.forEach((session, index) => {
        const startTime = formatTime(session.session_start, timezone, time_format);
        const endTime = formatTime(session.session_end, timezone, time_format);
        const earnings = (session.duration / 60) * session.rate;
        message += `${index + 1}. ${session.student_name} • ${startTime} - ${endTime} • ${formatCurrency(earnings, currency)}\n`;
      });
      
      const totalTomorrow = tomorrowSessions.reduce((total, session) => {
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

console.log("📱 TutorTrack notification scheduler is running...");
console.log("⏰ Checking for 9 PM notifications every minute");

checkAndSendNotifications();

setInterval(checkAndSendNotifications, 60 * 1000);

setInterval(resetDailyCache, 24 * 60 * 60 * 1000);
