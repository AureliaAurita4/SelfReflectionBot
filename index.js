require("dotenv").config();
const { Telegraf } = require("telegraf");
const fs = require("fs");
const path = require("path");

const RESPONSES_FILE = path.join(__dirname, "responses.json");

function loadResponses() {
  try {
    if (!fs.existsSync(RESPONSES_FILE)) {
      fs.writeFileSync(RESPONSES_FILE, JSON.stringify([]));
    }
    const data = fs.readFileSync(RESPONSES_FILE, "utf8");
    return JSON.parse(data);
  } catch (err) {
    console.error("Ошибка чтения responses.json", err);
    return [];
  }
}

function saveResponse(response) {
  const all = loadResponses();
  all.push(response);
  fs.writeFileSync(RESPONSES_FILE, JSON.stringify(all, null, 2));
}

const bot = new Telegraf(process.env.BOT_TOKEN);

// интервал между напоминаниями (3 часа)
const INTERVAL_MS = 3 * 60 * 60 * 1000;

const userTimers = new Map();

/**
 * Шлём вопросы
 */
async function sendCheckIn(chatId) {
  const text = [
    "🌿 Пауза заботы о себе 🌿",
    "",
    "1) Что я сейчас чувствую телом?",
    "2) Где моё внимание?",
    "3) Что мне сейчас нужно? (дыхание, вода, пауза, движение, нежность, что-то ещё)",
    "4) Что хорошего произошло?",
    "",
    "Ответь просто одним сообщением — как есть, без цензуры 💚",
  ].join("\n");

  await bot.telegram.sendMessage(chatId, text);
}

/**
 * Запускаем напоминания для конкретного чата
 */
function startReminders(chatId) {
  stopReminders(chatId);
  sendCheckIn(chatId).catch(console.error);

  const timer = setInterval(() => {
    sendCheckIn(chatId).catch(console.error);
  }, INTERVAL_MS);

  userTimers.set(chatId, timer);
}

/**
 * Останавливаем напоминания
 */
function stopReminders(chatId) {
  const timer = userTimers.get(chatId);
  if (timer) {
    clearInterval(timer);
    userTimers.delete(chatId);
  }
}

// /start
bot.start((ctx) => {
  const chatId = ctx.chat.id;

  ctx.reply(
    "Привет, Света 🌸\n" +
      "Я — твой бот возвращения фокуса к себе.\n\n" +
      "Я буду периодически напоминать тебе задать себе 4 вопроса.\n" +
      "Чтобы включить напоминания, я уже всё запустила ✅\n\n" +
      "Если захочешь остановить — напиши /stop."
  );

  startReminders(chatId);
});

// /stats — сколько ответов за 7 дней
bot.command("stats", (ctx) => {
  const all = loadResponses();
  const now = Date.now();
  const weekAgo = now - 7 * 24 * 60 * 60 * 1000;

  const recent = all.filter((r) => {
    const t = new Date(r.timestamp).getTime();
    return t >= weekAgo;
  });

  const count = recent.length;

  ctx.reply(
    "🌿 Статистика за последние 7 дней 🌿\n\n" +
      `Ты ответила мне ${count} раз.\n\n` +
      (count === 0
        ? "Твоё внимание скучало по тебе... 💛"
        : "Горжусь тобой, Светик 💚 Продолжай заботиться о себе так же нежно!")
  );
});

// /last — последние 10 записей
bot.command("last", (ctx) => {
  const all = loadResponses();

  if (all.length === 0) {
    ctx.reply(
      "Пока в дневнике пусто 🌱 Но это легко исправить — просто ответь на мой следующий чек-ин 💚"
    );
    return;
  }

  const recent = all.slice(-10);
  const lines = recent.map((r, index) => {
    const date = new Date(r.timestamp);
    const timeStr = date.toLocaleString("ru-RU"); // без таймзоны, чтобы точно не упасть

    return `${index + 1}) ${timeStr}\n${r.message}`;
  });

  const text =
    "📝 Последние записи в дневнике заботы:\n\n" + lines.join("\n\n");
  ctx.reply(text);
});

// /stop
bot.command("stop", (ctx) => {
  const chatId = ctx.chat.id;
  stopReminders(chatId);
  ctx.reply(
    "Окей 💙 Я временно замолкаю. Когда захочешь снова напоминаний — напиши /start."
  );
});

// обработка обычных сообщений
bot.on("text", (ctx) => {
  const chatId = ctx.chat.id;
  const message = ctx.message.text;
  const timestamp = new Date().toISOString();

  saveResponse({
    chatId,
    message,
    timestamp,
  });

  ctx.reply("Я с тобой 💚 Твой ответ записан в дневник заботы.");
});

// запуск бота
bot.launch().catch((err) => {
  console.error("❌ Ошибка при запуске бота:");
  console.error(err);
  process.exit(1);
});

console.log("🚀 Bot is running...");

// корректное завершение
process.once("SIGINT", () => bot.stop("SIGINT"));
process.once("SIGTERM", () => bot.stop("SIGTERM"));
