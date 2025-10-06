import TelegramBot from 'node-telegram-bot-api';
import { createClient } from '@supabase/supabase-js';

const botToken = process.env.TELEGRAM_BOT_TOKEN;
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!botToken || !supabaseUrl || !supabaseKey) {
  throw new Error("Missing required environment variables: TELEGRAM_BOT_TOKEN, SUPABASE_URL, or SUPABASE_SERVICE_ROLE_KEY");
}

const supabase = createClient(supabaseUrl, supabaseKey);

const bot = new TelegramBot(botToken, { polling: true });

console.log("🤖 TutorTrack Telegram bot is running...");

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
