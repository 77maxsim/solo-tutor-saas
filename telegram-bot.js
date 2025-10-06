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
  throw new Error("Missing required environment variables: TELEGRAM_BOT_TOKEN, SUPABASE_URL, or SUPABASE_SERVICE_ROLE_KEY");
}

const supabase = createClient(supabaseUrl, supabaseKey);

function formatCurrency(amount, currency = 'USD') {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: currency,
  }).format(amount);
}

function formatDateTime(utcTime, timezone, timeFormat = '24h') {
  const time = dayjs(utcTime).tz(timezone);
  if (timeFormat === '12h') {
    return time.format('MMMM D, YYYY [at] h:mm A');
  }
  return time.format('MMMM D, YYYY [at] HH:mm');
}

const bot = new TelegramBot(botToken, { polling: true });

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

bot.on('polling_error', (error) => {
  console.error('Polling error:', error);
});

async function sendBookingNotification(session) {
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
