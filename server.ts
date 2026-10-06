import express from "express";
import http from "http";
import https from "https";
import path from "path";
import dotenv from "dotenv";
import { fileURLToPath } from "url";

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = 3000;
const BOT_TOKEN =
  process.env.VITE_BOT_TOKEN ||
  process.env.BOT_TOKEN ||
  "8922187032:AAGXcO_wReVHRab4ME-X_0-eBB1dixWer-c";
const MINI_APP_URL = "https://manishop.ziniyaapu7.workers.dev/";
const RTDB_URL = "https://maneishopbd-default-rtdb.firebaseio.com";

const app = express();
app.use(express.json());

// Helper for sending Telegram messages
async function sendTelegramMessage(chatId: string | number, text: string, replyMarkup?: any): Promise<boolean> {
  if (!BOT_TOKEN || !chatId) return false;
  return new Promise((resolve) => {
    const payload = JSON.stringify({
      chat_id: String(chatId).trim(),
      text,
      parse_mode: "HTML",
      ...(replyMarkup ? { reply_markup: replyMarkup } : {})
    });

    const req = https.request(
      `https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Content-Length": Buffer.byteLength(payload)
        }
      },
      (res) => {
        let data = "";
        res.on("data", (c) => (data += c));
        res.on("end", () => {
          try {
            const parsed = JSON.parse(data);
            resolve(Boolean(parsed.ok));
          } catch {
            resolve(false);
          }
        });
      }
    );
    req.on("error", () => resolve(false));
    req.write(payload);
    req.end();
  });
}

// Helper to query Firebase RTDB via HTTPS
async function fetchFirebase<T>(endpoint: string): Promise<T | null> {
  return new Promise((resolve) => {
    https.get(`${RTDB_URL}/${endpoint}.json`, (res) => {
      let data = "";
      res.on("data", (c) => (data += c));
      res.on("end", () => {
        try {
          resolve(JSON.parse(data) as T);
        } catch {
          resolve(null);
        }
      });
    }).on("error", () => resolve(null));
  });
}

// Helper to write to Firebase RTDB via HTTPS
async function putFirebase(endpoint: string, data: any): Promise<boolean> {
  return new Promise((resolve) => {
    const payload = JSON.stringify(data);
    const req = https.request(
      `${RTDB_URL}/${endpoint}.json`,
      {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          "Content-Length": Buffer.byteLength(payload)
        }
      },
      (res) => {
        let out = "";
        res.on("data", (c) => (out += c));
        res.on("end", () => resolve(true));
      }
    );
    req.on("error", () => resolve(false));
    req.write(payload);
    req.end();
  });
}

// Handle an incoming Telegram message (from polling or webhook)
async function handleTelegramMessage(message: any) {
  if (!message || !message.chat || message.chat.type !== "private") return;
  const chatId = String(message.chat.id);
  const text = String(message.text || "").trim();
  const firstName = message.from?.first_name || "User";
  const lastName = message.from?.last_name || "";
  const username = message.from?.username || "";

  console.log(`[Telegram Bot] Received message from ${firstName} (${chatId}): "${text}"`);

  // Check if it is /start command or any text
  const isStart = text.startsWith("/start");
  let referrerId: string | null = null;
  if (isStart) {
    const parts = text.split(" ");
    if (parts.length > 1 && parts[1].trim()) {
      const rawRef = parts[1].trim().replace(/^(ref_|c2c_|r_|startapp_|start_)/i, '');
      if (rawRef && rawRef !== chatId && /^\d+$/.test(rawRef)) {
        referrerId = rawRef;
      }
    }
  }

  // Check if user exists in Firebase RTDB
  const existingUser = await fetchFirebase<any>(`users/${chatId}`);
  const now = new Date().toISOString();

  if (!existingUser) {
    // Brand new user registration via Telegram
    console.log(`[Telegram Bot] Registering new user: ${firstName} (${chatId}), referrer: ${referrerId || "none"}`);
    const newUser = {
      telegramId: chatId,
      username,
      firstName,
      lastName,
      photoUrl: "",
      bio: "",
      balance: 0.01,
      lifetimeEarned: 0.01,
      todayEarned: 0.01,
      todayDate: now.slice(0, 10),
      adsWatchedToday: 0,
      referralCount: 0,
      level2Count: 0,
      referralEarned: 0,
      referredBy: referrerId,
      binanceId: "",
      following: [],
      verified: false,
      banned: false,
      welcomeSent: true,
      createdAt: now,
      lastLogin: now,
      updatedAt: Date.now()
    };
    await putFirebase(`users/${chatId}`, newUser);

    // If referred by someone, credit referrer (Level 1: $0.50)
    if (referrerId) {
      const parent = await fetchFirebase<any>(`users/${referrerId}`);
      if (parent) {
        parent.referralCount = (Number(parent.referralCount) || 0) + 1;
        parent.balance = Number(((Number(parent.balance) || 0) + 0.50).toFixed(2));
        parent.lifetimeEarned = Number(((Number(parent.lifetimeEarned) || 0) + 0.50).toFixed(2));
        parent.referralEarned = Number(((Number(parent.referralEarned) || 0) + 0.50).toFixed(2));
        parent.updatedAt = Date.now();
        await putFirebase(`users/${referrerId}`, parent);

        // Record referral
        const refId = `ref_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
        await putFirebase(`referrals/${refId}`, {
          id: refId,
          referrerTelegramId: referrerId,
          referredTelegramId: chatId,
          level: 1,
          bonus: 0.50,
          createdAt: now
        });

        // Notify referrer
        await sendTelegramMessage(
          referrerId,
          `🎉 <b>নতুন রেফারেল যুক্ত হয়েছে!</b>\n\n👤 <b>নতুন সদস্য:</b> ${firstName}\n📊 <b>আপনার বর্তমান রেফারেল:</b> ${parent.referralCount} জন\n💰 <b>রেফারেল বোনাস:</b> +$0.50 USDT\n💵 <b>বর্তমান ব্যালেন্স:</b> $${parent.balance.toFixed(2)} USDT\n🎯 <b>উইথড্র রিকোয়ারমেন্ট:</b> ${parent.referralCount}/15 জন`,
          {
            inline_keyboard: [[{ text: "🚀 Open ManeiShop App", web_app: { url: MINI_APP_URL } }]]
          }
        );

        // Level 2 Grandparent ($0.10)
        if (parent.referredBy && parent.referredBy !== referrerId && parent.referredBy !== chatId) {
          const grandParent = await fetchFirebase<any>(`users/${parent.referredBy}`);
          if (grandParent) {
            grandParent.level2Count = (Number(grandParent.level2Count) || 0) + 1;
            grandParent.balance = Number(((Number(grandParent.balance) || 0) + 0.10).toFixed(2));
            grandParent.lifetimeEarned = Number(((Number(grandParent.lifetimeEarned) || 0) + 0.10).toFixed(2));
            grandParent.referralEarned = Number(((Number(grandParent.referralEarned) || 0) + 0.10).toFixed(2));
            grandParent.updatedAt = Date.now();
            await putFirebase(`users/${parent.referredBy}`, grandParent);

            const gRefId = `ref_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
            await putFirebase(`referrals/${gRefId}`, {
              id: gRefId,
              referrerTelegramId: parent.referredBy,
              referredTelegramId: chatId,
              level: 2,
              bonus: 0.10,
              createdAt: now
            });

            await sendTelegramMessage(
              parent.referredBy,
              `🌟 <b>লেভেল ২ টিম মেম্বার যুক্ত হয়েছে!</b>\n\n📊 <b>লেভেল ২ টিম সাইজ:</b> ${grandParent.level2Count} জন\n💰 <b>লেভেল ২ বোনাস:</b> +$0.10 USDT\n💵 <b>বর্তমান ব্যালেন্স:</b> $${grandParent.balance.toFixed(2)} USDT`,
              {
                inline_keyboard: [[{ text: "🚀 Open ManeiShop App", web_app: { url: MINI_APP_URL } }]]
              }
            );
          }
        }
      }
    }
  }

  const userBalance = existingUser ? Number(existingUser.balance || 0).toFixed(2) : "0.01";

  // Send the Welcome message with the Mini App button!
  const welcomeText = `🎉 <b>স্বাগতম ${firstName}!</b>\n\n🎁 <b>নতুন জয়েনিং বোনাস:</b> +$0.01 USDT আপনার একাউন্টে যোগ হয়েছে!\n💵 <b>বর্তমান ব্যালেন্স:</b> $${userBalance} USDT\n\n👉 প্রতিদিন ভিডিও অ্যাড দেখুন ও স্পেশাল টাস্ক পূরণ করে সরাসরি বিকাশ, নগদ বা বাইন্যান্সে টাকা তুলুন।\n👥 <b>প্রতি সফল রেফারে পাবেন:</b> +$0.50 USDT!\n💰 <b>নূন্যতম উইথড্র:</b> $5.00 USDT\n\n🚀 এখনই কাজ শুরু করতে নিচের বাটনে চাপুন!`;

  await sendTelegramMessage(chatId, welcomeText, {
    inline_keyboard: [[{ text: "🚀 Open ManeiShop App", web_app: { url: MINI_APP_URL } }]]
  });
}

// Background Long-Polling for Telegram Bot
let isPolling = false;
let lastUpdateOffset = 0;

async function startTelegramPolling() {
  if (isPolling) return;
  isPolling = true;
  console.log("[Telegram Polling] Starting 24/7 background Telegram bot polling...");

  while (isPolling) {
    try {
      const url = `https://api.telegram.org/bot${BOT_TOKEN}/getUpdates?offset=${lastUpdateOffset}&timeout=20`;
      const updates = await new Promise<any[]>((resolve) => {
        https.get(url, (res) => {
          let data = "";
          res.on("data", (c) => (data += c));
          res.on("end", () => {
            try {
              const json = JSON.parse(data);
              resolve(json.ok && Array.isArray(json.result) ? json.result : []);
            } catch {
              resolve([]);
            }
          });
        }).on("error", () => resolve([]));
      });

      for (const update of updates) {
        lastUpdateOffset = Math.max(lastUpdateOffset, update.update_id + 1);
        if (update.message) {
          await handleTelegramMessage(update.message).catch((err) => {
            console.warn("[Telegram Polling] Error handling message:", err);
          });
        }
      }
    } catch (err) {
      console.warn("[Telegram Polling] Polling loop error, retrying in 3s...", err);
      await new Promise((r) => setTimeout(r, 3000));
    }
  }
}

// API Routes
app.get("/api/check-member", async (req, res) => {
  const rawCh = String(req.query.channel || "").trim();
  const clean = rawCh.replace(/^(https?:\/\/)?(www\.)?(t\.me\/|telegram\.me\/)/i, "").replace(/^@/, "").split("/")[0].split("?")[0].trim();
  const userId = String(req.query.userId || "").trim();

  if (!clean || !userId) {
    return res.status(400).json({ ok: false, error: "Missing channel or userId" });
  }

  try {
    const tgRes = await new Promise<any>((resolve) => {
      https.get(
        `https://api.telegram.org/bot${BOT_TOKEN}/getChatMember?chat_id=@${encodeURIComponent(clean)}&user_id=${encodeURIComponent(userId)}`,
        (apiRes) => {
          let data = "";
          apiRes.on("data", (c) => (data += c));
          apiRes.on("end", () => {
            try {
              resolve(JSON.parse(data));
            } catch {
              resolve({ ok: false });
            }
          });
        }
      ).on("error", () => resolve({ ok: false }));
    });

    if (tgRes.ok) {
      const st = tgRes.result?.status;
      const isMember = st === "creator" || st === "administrator" || st === "member" || st === "restricted";
      return res.json({ ok: true, isMember, status: st });
    }

    const desc = tgRes.description || "";
    if (desc.includes("member list is inaccessible")) {
      return res.json({ ok: false, isMember: false, needsBotAdmin: true, error: desc });
    }
    return res.json({ ok: true, isMember: false, status: "not_member", error: desc });
  } catch (err: any) {
    res.status(500).json({ ok: false, isMember: false, error: err?.message || "Internal server error" });
  }
});

app.post("/api/send-message", async (req, res) => {
  const { chatId, text, replyMarkup } = req.body;
  if (!chatId || !text) {
    return res.status(400).json({ ok: false, error: "Missing chatId or text" });
  }
  const ok = await sendTelegramMessage(chatId, text, replyMarkup);
  res.json({ ok });
});

app.post("/api/telegram-webhook", async (req, res) => {
  if (req.body && req.body.message) {
    handleTelegramMessage(req.body.message).catch(console.error);
  }
  res.sendStatus(200);
});

app.get("/api/health", (req, res) => {
  res.json({ ok: true, timestamp: Date.now() });
});

// Setup Vite / Static Serving
async function startServer() {
  const isProd = process.env.NODE_ENV === "production";
  if (!isProd) {
    const { createServer: createViteServer } = await import("vite");
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa"
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static(path.join(__dirname, "dist")));
    app.get("*", (req, res) => {
      res.sendFile(path.join(__dirname, "dist", "index.html"));
    });
  }

  const server = http.createServer(app);
  server.listen(PORT, "0.0.0.0", () => {
    console.log(`[Server] ManeiShop Full-Stack Server running on port ${PORT}`);
    // Start background Telegram polling
    startTelegramPolling();
  });
}

startServer().catch((err) => {
  console.error("[Server] Fatal startup error:", err);
});
