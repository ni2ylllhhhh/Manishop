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
const DEFAULT_BOT_TOKEN = "8922187032:AAHPHZLBGZB5ueeGD-Pb8XsWMoBKPCBJwwI";
const BOT_TOKEN = process.env.BOT_TOKEN || DEFAULT_BOT_TOKEN;
const MINI_APP_URL = "https://manishop.ziniyaapu7.workers.dev/";
const RTDB_URL = "https://maneishopbd-default-rtdb.firebaseio.com";

const app = express();
app.use(express.json());

// Helper for sending Telegram messages
async function sendTelegramMessage(chatId: string | number, text: string, replyMarkup?: any): Promise<boolean> {
  if (!BOT_TOKEN || !chatId) return false;
  const targetChatId = String(chatId).trim().replace(/^@/, '');
  // Ignore mock demo preview accounts
  if (targetChatId === "724910385" || targetChatId.startsWith("demo_") || targetChatId === "0") {
    return true;
  }
  return new Promise((resolve) => {
    const payload = JSON.stringify({
      chat_id: targetChatId,
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
          "Content-Length": Buffer.byteLength(payload, "utf8")
        }
      },
      (res) => {
        let data = "";
        res.on("data", (c) => (data += c));
        res.on("end", () => {
          try {
            const parsed = JSON.parse(data);
            if (parsed.ok) {
              console.log(`[Telegram Bot] Message sent successfully to ${targetChatId}`);
              resolve(true);
            } else {
              // If chat doesn't exist yet in Telegram, log as info rather than warn
              if (parsed.description && parsed.description.includes("chat not found")) {
                console.log(`[Telegram Bot] Chat ${targetChatId} not active yet`);
                resolve(false);
                return;
              }
              console.warn(`[Telegram Bot] sendMessage to ${targetChatId} failed:`, parsed.description);
              // Fallback: If failed due to HTML parsing, retry without parse_mode
              if (parsed.description && (parsed.description.includes("parse") || parsed.description.includes("entity"))) {
                const plainText = text.replace(/<[^>]*>/g, "");
                const plainPayload = JSON.stringify({
                  chat_id: targetChatId,
                  text: plainText,
                  ...(replyMarkup ? { reply_markup: replyMarkup } : {})
                });
                const retryReq = https.request(
                  `https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`,
                  {
                    method: "POST",
                    headers: {
                      "Content-Type": "application/json",
                      "Content-Length": Buffer.byteLength(plainPayload, "utf8")
                    }
                  },
                  (retryRes) => {
                    let rData = "";
                    retryRes.on("data", (c) => (rData += c));
                    retryRes.on("end", () => {
                      try {
                        const rParsed = JSON.parse(rData);
                        resolve(Boolean(rParsed.ok));
                      } catch {
                        resolve(false);
                      }
                    });
                  }
                );
                retryReq.on("error", () => resolve(false));
                retryReq.write(plainPayload);
                retryReq.end();
                return;
              }
              resolve(false);
            }
          } catch {
            resolve(false);
          }
        });
      }
    );
    req.on("error", (err) => {
      console.warn(`[Telegram Bot] Network error sending to ${targetChatId}:`, err);
      resolve(false);
    });
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

// Helper to answer Telegram callback query
async function answerCallbackQuery(callbackQueryId: string, text?: string, showAlert = false): Promise<boolean> {
  if (!BOT_TOKEN || !callbackQueryId) return false;
  return new Promise((resolve) => {
    const payload = JSON.stringify({
      callback_query_id: callbackQueryId,
      text: text || "",
      show_alert: showAlert
    });
    const req = https.request(
      `https://api.telegram.org/bot${BOT_TOKEN}/answerCallbackQuery`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Content-Length": Buffer.byteLength(payload)
        }
      },
      () => resolve(true)
    );
    req.on("error", () => resolve(false));
    req.write(payload);
    req.end();
  });
}

// Check membership in a specific channel using getChatMember
async function checkUserInTelegramChannel(usernameOrId: string, userId: string): Promise<boolean> {
  if (!BOT_TOKEN || !usernameOrId || !userId) return false;
  const clean = usernameOrId.replace(/^(https?:\/\/)?(www\.)?(t\.me\/|telegram\.me\/)/i, "").replace(/^@/, "").split("/")[0].split("?")[0].trim();
  const targetChatId = clean.startsWith("-") || /^\d+$/.test(clean) ? clean : `@${clean}`;

  return new Promise((resolve) => {
    https.get(
      `https://api.telegram.org/bot${BOT_TOKEN}/getChatMember?chat_id=${encodeURIComponent(targetChatId)}&user_id=${encodeURIComponent(userId)}`,
      (res) => {
        let data = "";
        res.on("data", (c) => (data += c));
        res.on("end", () => {
          try {
            const parsed = JSON.parse(data);
            if (parsed.ok && parsed.result) {
              const st = parsed.result.status;
              resolve(st === "creator" || st === "administrator" || st === "member" || st === "restricted");
              return;
            }
            const desc = parsed.description || "";
            if (desc.includes("member list is inaccessible")) {
              // Bot lacks admin privileges to inspect private channel, don't penalize user
              resolve(true);
              return;
            }
            resolve(false);
          } catch {
            resolve(false);
          }
        });
      }
    ).on("error", () => resolve(false));
  });
}

// Verify membership across all required channels from Firebase config
async function checkAllRequiredChannels(chatId: string): Promise<{ allJoined: boolean; missingChannels: string[] }> {
  const config = await fetchFirebase<any>("config");
  const channels = (config && Array.isArray(config.requiredChannels) && config.requiredChannels.length > 0)
    ? config.requiredChannels
    : [
        { id: "main", name: "Main Channel", username: "ManiShop_Community", url: "https://t.me/ManiShop_Community" },
        { id: "payment", name: "Payment Channel", username: "Earning_Money_Lob", url: "https://t.me/Earning_Money_Lob" }
      ];

  const missingChannels: string[] = [];
  for (const ch of channels) {
    if (!ch.username) continue;
    const isMember = await checkUserInTelegramChannel(ch.username, chatId);
    if (!isMember) {
      missingChannels.push(ch.name || ch.username);
    }
  }

  return {
    allJoined: missingChannels.length === 0,
    missingChannels
  };
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

  // Real-time channel membership verification
  const { allJoined, missingChannels } = await checkAllRequiredChannels(chatId);
  const userBalance = existingUser ? Number(existingUser.balance || 0).toFixed(2) : "0.01";

  if (allJoined) {
    // Mark as verified in Firebase RTDB
    await putFirebase(`users/${chatId}/verified`, true);
    await putFirebase(`users/${chatId}/lastLogin`, now);

    const welcomeText = `🎉 <b>স্বাগতম ${firstName}!</b>\n\n✅ <b>আপনার চ্যানেল ভেরিফিকেশন সফল হয়েছে!</b>\n🎁 <b>নতুন জয়েনিং বোনাস:</b> +$0.01 USDT আপনার একাউন্টে যোগ হয়েছে!\n💵 <b>বর্তমান ব্যালেন্স:</b> $${userBalance} USDT\n\n👉 প্রতিদিন ভিডিও অ্যাড দেখুন ও স্পেশাল টাস্ক পূরণ করে সরাসরি বিকাশ, নগদ বা বাইন্যান্সে টাকা তুলুন।\n👥 <b>প্রতি সফল রেফারে পাবেন:</b> +$0.50 USDT!\n💰 <b>নূন্যতম উইথড্র:</b> $5.00 USDT\n\n🚀 <b>কাজ শুরু করতে নিচের বাটনে চাপুন!</b>`;

    await sendTelegramMessage(chatId, welcomeText, {
      inline_keyboard: [
        [{ text: "🚀 Open ManeiShop App", web_app: { url: MINI_APP_URL } }],
        [
          { text: "📢 Main Channel", url: "https://t.me/ManiShop_Community" },
          { text: "💳 Payment Channel", url: "https://t.me/Earning_Money_Lob" }
        ],
        [{ text: "🔄 চ্যানেল ভেরিফাই রি-চেক", callback_data: "check_channels" }]
      ]
    });
  } else {
    // User has NOT joined all channels yet
    await putFirebase(`users/${chatId}/verified`, false);

    const gateText = `👋 <b>হ্যালো ${firstName}! ManeiShopBD এ স্বাগতম!</b>\n\n⚠️ <b>বট ও অ্যাপে কাজ করতে হলে নিচের অফিশিয়াল চ্যানেলগুলোতে জয়েন থাকা বাধ্যতামূলক:</b>\n\n1️⃣ 📢 <b>Main Channel:</b> @ManiShop_Community\n2️⃣ 💳 <b>Payment Channel:</b> @Earning_Money_Lob\n\n👉 উপরের চ্যানেলগুলোতে জয়েন করে নিচের <b>'✅ ভেরিফাই করুন'</b> বাটনে চাপুন:`;

    await sendTelegramMessage(chatId, gateText, {
      inline_keyboard: [
        [{ text: "📢 1. Join Main Channel", url: "https://t.me/ManiShop_Community" }],
        [{ text: "💳 2. Join Payment Channel", url: "https://t.me/Earning_Money_Lob" }],
        [{ text: "✅ চ্যানেল ভেরিফাই করুন (Verify)", callback_data: "check_channels" }],
        [{ text: "🚀 Open ManeiShop App", web_app: { url: MINI_APP_URL } }]
      ]
    });
  }
}

// Handle incoming Telegram callback query (from inline button clicks)
async function handleTelegramCallbackQuery(query: any) {
  if (!query || !query.message) return;
  const callbackId = String(query.id);
  const chatId = String(query.message.chat?.id || query.from?.id);
  const data = String(query.data || "");
  const firstName = query.from?.first_name || "User";

  console.log(`[Telegram Bot] Callback query from ${firstName} (${chatId}): "${data}"`);

  if (data === "check_channels" || data === "verify") {
    const { allJoined, missingChannels } = await checkAllRequiredChannels(chatId);

    if (allJoined) {
      await putFirebase(`users/${chatId}/verified`, true);
      await putFirebase(`users/${chatId}/updatedAt`, Date.now());

      await answerCallbackQuery(callbackId, "🎉 অভিনন্দন! চ্যানেল ভেরিফিকেশন সফল হয়েছে!", true);

      const successText = `🎉 <b>অভিনন্দন ${firstName}!</b>\n\n✅ <b>আপনার চ্যানেল ভেরিফিকেশন সফল হয়েছে!</b>\nএখন আপনি অ্যাপে প্রবেশ করে আনলিমিটেড ভিডিও অ্যাড দেখে ও টাস্ক পূরণ করে ইনকাম শুরু করতে পারবেন।\n\n🚀 নিচের বাটনে ক্লিক করে অ্যাপ ওপেন করুন:`;

      await sendTelegramMessage(chatId, successText, {
        inline_keyboard: [
          [{ text: "🚀 Open ManeiShop App", web_app: { url: MINI_APP_URL } }],
          [
            { text: "📢 Main Channel", url: "https://t.me/ManiShop_Community" },
            { text: "💳 Payment Channel", url: "https://t.me/Earning_Money_Lob" }
          ]
        ]
      });
    } else {
      await answerCallbackQuery(
        callbackId,
        `⚠️ আপনি এখনো ${missingChannels.join(" ও ")} এ জয়েন করেননি! দয়া করে আগে জয়েন করুন।`,
        true
      );
    }
  } else {
    await answerCallbackQuery(callbackId);
  }
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
        if (update.callback_query) {
          await handleTelegramCallbackQuery(update.callback_query).catch((err) => {
            console.warn("[Telegram Polling] Error handling callback_query:", err);
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
// ==========================================
// BROADCAST ENGINE
// ==========================================
interface BroadcastItem {
  id: string;
  serialNumber: number;
  title: string;
  messageType: 'text' | 'photo' | 'video' | 'document';
  text: string;
  mediaUrl?: string;
  buttons: Array<{ label: string; url: string }>;
  buttonLayout: 'single' | 'double';
  targetAudience: string;
  targetValue?: string;
  totalTarget: number;
  sentCount: number;
  failedCount: number;
  status: 'draft' | 'running' | 'paused' | 'stopped' | 'completed';
  currentIndex: number;
  targetUserIds: string[];
  createdAt: string;
  updatedAt: string;
  completedAt?: string;
}

let activeCampaign: BroadcastItem | null = null;
let broadcastShouldPause = false;
let broadcastShouldStop = false;
let isBroadcastWorkerActive = false;

function buildBroadcastInlineKeyboard(buttons: Array<{ label: string; url: string }>, layout: 'single' | 'double') {
  if (!buttons || !Array.isArray(buttons) || buttons.length === 0) return undefined;
  const validButtons = buttons
    .filter((b) => b && b.label && b.url)
    .map((b) => ({ text: b.label.trim(), url: b.url.trim() }));
  if (validButtons.length === 0) return undefined;

  if (layout === 'double') {
    const rows: any[] = [];
    for (let i = 0; i < validButtons.length; i += 2) {
      if (i + 1 < validButtons.length) {
        rows.push([validButtons[i], validButtons[i + 1]]);
      } else {
        rows.push([validButtons[i]]);
      }
    }
    return { inline_keyboard: rows };
  }
  return { inline_keyboard: validButtons.map((b) => [b]) };
}

async function sendBroadcastTelegramItem(
  chatId: string,
  messageType: 'text' | 'photo' | 'video' | 'document',
  text: string,
  mediaUrl?: string,
  replyMarkup?: any
): Promise<{ ok: boolean; retryAfter?: number; error?: string }> {
  return new Promise((resolve) => {
    let endpoint = "sendMessage";
    const body: any = {
      chat_id: chatId,
      parse_mode: "HTML",
      ...(replyMarkup ? { reply_markup: replyMarkup } : {})
    };

    if (messageType === 'photo' && mediaUrl) {
      endpoint = "sendPhoto";
      body.photo = mediaUrl;
      body.caption = text;
    } else if (messageType === 'video' && mediaUrl) {
      endpoint = "sendVideo";
      body.video = mediaUrl;
      body.caption = text;
    } else if (messageType === 'document' && mediaUrl) {
      endpoint = "sendDocument";
      body.document = mediaUrl;
      body.caption = text;
    } else {
      body.text = text;
    }

    const payload = JSON.stringify(body);
    const req = https.request(
      `https://api.telegram.org/bot${BOT_TOKEN}/${endpoint}`,
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
            if (parsed.ok) {
              resolve({ ok: true });
            } else {
              resolve({
                ok: false,
                retryAfter: parsed.parameters?.retry_after,
                error: parsed.description || "Telegram API Error"
              });
            }
          } catch {
            resolve({ ok: false, error: "Invalid JSON response" });
          }
        });
      }
    );
    req.on("error", (err) => resolve({ ok: false, error: err?.message }));
    req.write(payload);
    req.end();
  });
}

async function runBroadcastWorker() {
  if (isBroadcastWorkerActive || !activeCampaign) return;
  isBroadcastWorkerActive = true;
  broadcastShouldPause = false;
  broadcastShouldStop = false;

  console.log(`[Broadcast Engine] Starting broadcast #${activeCampaign.serialNumber} ("${activeCampaign.title}") targeting ${activeCampaign.totalTarget} users...`);

  const replyMarkup = buildBroadcastInlineKeyboard(activeCampaign.buttons, activeCampaign.buttonLayout);
  let lastSyncTime = Date.now();

  try {
    while (activeCampaign && activeCampaign.currentIndex < activeCampaign.targetUserIds.length) {
      if (broadcastShouldStop) {
        activeCampaign.status = 'stopped';
        activeCampaign.updatedAt = new Date().toISOString();
        await putFirebase(`broadcasts/${activeCampaign.id}`, activeCampaign);
        break;
      }

      if (broadcastShouldPause) {
        activeCampaign.status = 'paused';
        activeCampaign.updatedAt = new Date().toISOString();
        await putFirebase(`broadcasts/${activeCampaign.id}`, activeCampaign);
        break;
      }

      const currentUid = activeCampaign.targetUserIds[activeCampaign.currentIndex];

      if (currentUid && /^\d+$/.test(currentUid)) {
        let result = await sendBroadcastTelegramItem(
          currentUid,
          activeCampaign.messageType,
          activeCampaign.text,
          activeCampaign.mediaUrl,
          replyMarkup
        );

        if (!result.ok && result.retryAfter && result.retryAfter > 0) {
          console.log(`[Broadcast Engine] Rate limit notice. Waiting ${result.retryAfter}s...`);
          await new Promise((r) => setTimeout(r, (result.retryAfter! * 1000) + 150));
          result = await sendBroadcastTelegramItem(
            currentUid,
            activeCampaign.messageType,
            activeCampaign.text,
            activeCampaign.mediaUrl,
            replyMarkup
          );
        }

        if (result.ok) {
          activeCampaign.sentCount++;
        } else {
          activeCampaign.failedCount++;
        }
      } else {
        activeCampaign.failedCount++;
      }

      activeCampaign.currentIndex++;
      activeCampaign.updatedAt = new Date().toISOString();

      // Sync progress to Firebase every 10 users or every 2 seconds
      if (activeCampaign.currentIndex % 10 === 0 || Date.now() - lastSyncTime > 2000) {
        lastSyncTime = Date.now();
        await putFirebase(`broadcasts/${activeCampaign.id}`, activeCampaign);
      }

      // Safe pacing: 40ms (~25 msgs/sec for maximum speed without hitting 30/s ceiling)
      await new Promise((r) => setTimeout(r, 40));
    }

    if (activeCampaign && activeCampaign.currentIndex >= activeCampaign.targetUserIds.length) {
      activeCampaign.status = 'completed';
      activeCampaign.completedAt = new Date().toISOString();
      activeCampaign.updatedAt = new Date().toISOString();
      await putFirebase(`broadcasts/${activeCampaign.id}`, activeCampaign);
      console.log(`[Broadcast Engine] Broadcast #${activeCampaign.serialNumber} finished! Sent: ${activeCampaign.sentCount}, Failed: ${activeCampaign.failedCount}`);
    }
  } catch (err) {
    console.warn("[Broadcast Engine] Error in worker loop:", err);
  } finally {
    isBroadcastWorkerActive = false;
  }
}

// Broadcast Endpoints
app.post("/api/broadcast/start", async (req, res) => {
  try {
    const data = req.body;
    if (!data || !data.text || !Array.isArray(data.targetUserIds)) {
      return res.status(400).json({ ok: false, error: "Invalid broadcast payload" });
    }

    if (isBroadcastWorkerActive && activeCampaign && activeCampaign.status === 'running') {
      return res.status(409).json({ ok: false, error: "A broadcast is already running. Please pause or stop it first." });
    }

    const now = new Date().toISOString();
    const campaignId = data.id || `bc_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;

    // Read previous campaigns to get auto-increment serial number
    const existing = (await fetchFirebase<Record<string, any>>("broadcasts")) || {};
    const count = Object.keys(existing).length;
    const serial = Number(data.serialNumber) || count + 1;

    activeCampaign = {
      id: campaignId,
      serialNumber: serial,
      title: data.title || `Broadcast #${serial}`,
      messageType: data.messageType || 'text',
      text: data.text,
      mediaUrl: data.mediaUrl || "",
      buttons: Array.isArray(data.buttons) ? data.buttons : [],
      buttonLayout: data.buttonLayout === 'double' ? 'double' : 'single',
      targetAudience: data.targetAudience || 'all',
      targetValue: data.targetValue || "",
      totalTarget: data.targetUserIds.length,
      sentCount: 0,
      failedCount: 0,
      status: 'running',
      currentIndex: 0,
      targetUserIds: data.targetUserIds,
      createdAt: now,
      updatedAt: now
    };

    await putFirebase(`broadcasts/${activeCampaign.id}`, activeCampaign);
    runBroadcastWorker();

    res.json({ ok: true, campaign: activeCampaign });
  } catch (err: any) {
    res.status(500).json({ ok: false, error: err?.message });
  }
});

app.post("/api/broadcast/pause", async (req, res) => {
  broadcastShouldPause = true;
  if (activeCampaign) {
    activeCampaign.status = 'paused';
    activeCampaign.updatedAt = new Date().toISOString();
    await putFirebase(`broadcasts/${activeCampaign.id}`, activeCampaign);
  }
  res.json({ ok: true, status: 'paused', campaign: activeCampaign });
});

app.post("/api/broadcast/resume", async (req, res) => {
  const { id } = req.body || {};
  let campaignToResume = activeCampaign;

  if (id && (!activeCampaign || activeCampaign.id !== id)) {
    const fetched = await fetchFirebase<BroadcastItem>(`broadcasts/${id}`);
    if (fetched) {
      campaignToResume = fetched;
      activeCampaign = fetched;
    }
  }

  if (!campaignToResume) {
    return res.status(404).json({ ok: false, error: "Campaign not found" });
  }

  campaignToResume.status = 'running';
  campaignToResume.updatedAt = new Date().toISOString();
  await putFirebase(`broadcasts/${campaignToResume.id}`, campaignToResume);

  runBroadcastWorker();
  res.json({ ok: true, status: 'running', campaign: activeCampaign });
});

app.post("/api/broadcast/stop", async (req, res) => {
  broadcastShouldStop = true;
  if (activeCampaign) {
    activeCampaign.status = 'stopped';
    activeCampaign.updatedAt = new Date().toISOString();
    await putFirebase(`broadcasts/${activeCampaign.id}`, activeCampaign);
  }
  res.json({ ok: true, status: 'stopped', campaign: activeCampaign });
});

app.get("/api/broadcast/status", (req, res) => {
  res.json({
    ok: true,
    isRunning: isBroadcastWorkerActive,
    activeCampaign
  });
});

app.get("/api/broadcast/history", async (req, res) => {
  try {
    const data = (await fetchFirebase<Record<string, BroadcastItem>>("broadcasts")) || {};
    const list = Object.values(data);
    list.sort((a, b) => (b.serialNumber || 0) - (a.serialNumber || 0));
    res.json({ ok: true, broadcasts: list });
  } catch (err: any) {
    res.status(500).json({ ok: false, error: err?.message });
  }
});
app.get("/api/check-member", async (req, res) => {
  const rawCh = String(req.query.channel || "").trim();
  const clean = rawCh.replace(/^(https?:\/\/)?(www\.)?(t\.me\/|telegram\.me\/)/i, "").replace(/^@/, "").split("/")[0].split("?")[0].trim();
  const userId = String(req.query.userId || "").trim();

  if (!clean || !userId) {
    return res.status(400).json({ ok: false, error: "Missing channel or userId" });
  }

  try {
    const targetChatId = clean.startsWith("-") || /^\d+$/.test(clean) ? clean : `@${clean}`;
    const tgRes = await new Promise<any>((resolve) => {
      https.get(
        `https://api.telegram.org/bot${BOT_TOKEN}/getChatMember?chat_id=${encodeURIComponent(targetChatId)}&user_id=${encodeURIComponent(userId)}`,
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

    if (tgRes.ok && tgRes.result) {
      const st = tgRes.result?.status;
      const isMember = st === "creator" || st === "administrator" || st === "member" || st === "restricted";
      return res.json({ ok: true, isMember, status: st });
    }

    const desc = tgRes.description || "";
    if (desc.includes("member list is inaccessible")) {
      return res.json({ ok: false, isMember: false, needsBotAdmin: true, error: desc });
    }
    return res.json({ ok: false, isMember: false, status: "error", error: desc || "Telegram check failed" });
  } catch (err: any) {
    res.status(500).json({ ok: false, isMember: false, error: err?.message || "Internal server error" });
  }
});

app.post("/api/send-message", async (req, res) => {
  const { chatId, text, replyMarkup, reply_markup } = req.body || {};
  const targetMarkup = replyMarkup || reply_markup;
  if (!chatId || !text) {
    return res.status(400).json({ ok: false, error: "Missing chatId or text" });
  }
  const ok = await sendTelegramMessage(chatId, text, targetMarkup);
  res.json({ ok });
});

// Dedicated Real-Time Referral & Welcome Notification Engine
app.post("/api/notify-referral", async (req, res) => {
  try {
    const { newUserId, newUserName, referrerId, isExisting } = req.body || {};

    // Existing users must NEVER trigger referrer notification or welcome message
    if (isExisting) {
      return res.json({ ok: true, status: "existing_user_ignored" });
    }

    const cleanNewUserId = String(newUserId || "").trim().replace(/^@/, '');
    const cleanUserName = String(newUserName || "ইউজার").trim();
    const cleanRefId = String(referrerId || "").trim().replace(/^@/, '');

    // Double check that this user isn't already registered in Firebase
    if (cleanNewUserId && cleanNewUserId !== "724910385") {
      const existingInDb = await fetchFirebase<any>(`users/${cleanNewUserId}`);
      if (existingInDb && (existingInDb.welcomeSent || (existingInDb.createdAt && Date.now() - new Date(existingInDb.createdAt).getTime() > 120000))) {
        return res.json({ ok: true, status: "already_registered" });
      }
    }

    console.log(`[Referral Event] Genuinely New User: ${cleanUserName} (${cleanNewUserId}), Referrer: ${cleanRefId}`);

    const now = new Date().toISOString();
    const miniUrl = MINI_APP_URL || "https://manishop.ziniyaapu7.workers.dev/";

    // 1. Send welcome message to brand new user
    if (cleanNewUserId && /^\d+$/.test(cleanNewUserId) && cleanNewUserId !== "724910385") {
      const welcomeText = `🎉 <b>স্বাগতম ${cleanUserName}!</b>\n\n🎁 <b>নতুন জয়েনিং বোনাস:</b> +$0.01 USDT আপনার একাউন্টে যোগ হয়েছে!\n💵 <b>বর্তমান ব্যালেন্স:</b> $0.01 USDT\n\n👉 প্রতিদিন ভিডিও অ্যাড দেখুন ও স্পেশাল টাস্ক পূরণ করে সরাসরি বিকাশ, নগদ বা বাইন্যান্সে টাকা তুলুন।\n👥 <b>প্রতি সফল রেফারে পাবেন:</b> +$0.50 USDT!\n💰 <b>নূন্যতম উইথড্র:</b> $5.00 USDT\n\n🚀 এখনই কাজ শুরু করতে নিচের বাটনে চাপুন!`;
      await sendTelegramMessage(cleanNewUserId, welcomeText, {
        inline_keyboard: [[{ text: "🚀 Open ManeiShop App", web_app: { url: miniUrl } }]]
      });
    }

    // 2. If valid referrer exists, credit them and send Telegram message
    if (cleanRefId && cleanRefId !== cleanNewUserId && /^\d+$/.test(cleanRefId) && cleanRefId !== "724910385") {
      const parent = await fetchFirebase<any>(`users/${cleanRefId}`);
      let currentRefBonus = 0.50;
      let parentCount = 1;
      let parentBalance = 0.50;

      if (parent) {
        parent.referralCount = (Number(parent.referralCount) || 0) + 1;
        parent.balance = Number(((Number(parent.balance) || 0) + currentRefBonus).toFixed(2));
        parent.lifetimeEarned = Number(((Number(parent.lifetimeEarned) || 0) + currentRefBonus).toFixed(2));
        parent.referralEarned = Number(((Number(parent.referralEarned) || 0) + currentRefBonus).toFixed(2));
        parent.updatedAt = Date.now();
        await putFirebase(`users/${cleanRefId}`, parent);

        parentCount = parent.referralCount;
        parentBalance = parent.balance;
      }

      // Record referral in Firebase RTDB
      const refId = `ref_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
      await putFirebase(`referrals/${refId}`, {
        id: refId,
        referrerTelegramId: cleanRefId,
        referredTelegramId: cleanNewUserId,
        level: 1,
        bonus: currentRefBonus,
        createdAt: now
      });

      // Send telegram message to referrer
      const referrerText = `🎉 <b>নতুন রেফারেল যুক্ত হয়েছে!</b>\n\n👤 <b>নতুন সদস্য:</b> ${cleanUserName}\n📊 <b>আপনার বর্তমান রেফারেল:</b> ${parentCount} জন\n💰 <b>রেফারেল বোনাস:</b> +$${currentRefBonus.toFixed(2)} USDT\n💵 <b>বর্তমান ব্যালেন্স:</b> $${parentBalance.toFixed(2)} USDT\n🎯 <b>উইথড্র রিকোয়ারমেন্ট:</b> ${parentCount}/15 জন`;
      await sendTelegramMessage(cleanRefId, referrerText, {
        inline_keyboard: [[{ text: "🚀 Open ManeiShop App", web_app: { url: miniUrl } }]]
      });

      // 3. Level 2 Grandparent check
      if (parent && parent.referredBy && parent.referredBy !== cleanRefId && parent.referredBy !== cleanNewUserId) {
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
            referredTelegramId: cleanNewUserId,
            level: 2,
            bonus: 0.10,
            createdAt: now
          });

          await sendTelegramMessage(
            parent.referredBy,
            `🌟 <b>লেভেল ২ টিম মেম্বার যুক্ত হয়েছে!</b>\n\n📊 <b>লেভেল ২ টিম সাইজ:</b> ${grandParent.level2Count} জন\n💰 <b>লেভেল ২ বোনাস:</b> +$0.10 USDT\n💵 <b>বর্তমান ব্যালেন্স:</b> $${grandParent.balance.toFixed(2)} USDT`,
            {
              inline_keyboard: [[{ text: "🚀 Open ManeiShop App", web_app: { url: miniUrl } }]]
            }
          );
        }
      }
    }

    res.json({ ok: true });
  } catch (err: any) {
    console.error("[Referral Event Error]:", err);
    res.status(500).json({ ok: false, error: err?.message });
  }
});

app.post("/api/set-menu-button", async (req, res) => {
  const url = req.body?.url || MINI_APP_URL;
  try {
    const payload = JSON.stringify({
      menu_button: {
        type: "web_app",
        text: "ManeiShop",
        web_app: { url }
      }
    });
    const reqTg = https.request(
      `https://api.telegram.org/bot${BOT_TOKEN}/setChatMenuButton`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Content-Length": Buffer.byteLength(payload)
        }
      },
      (resTg) => {
        let data = "";
        resTg.on("data", (c) => (data += c));
        resTg.on("end", () => {
          try {
            res.json(JSON.parse(data));
          } catch {
            res.json({ ok: false });
          }
        });
      }
    );
    reqTg.on("error", () => res.json({ ok: false }));
    reqTg.write(payload);
    reqTg.end();
  } catch {
    res.json({ ok: false });
  }
});

app.post("/api/telegram-webhook", async (req, res) => {
  if (req.body) {
    if (req.body.message) {
      handleTelegramMessage(req.body.message).catch(console.error);
    }
    if (req.body.callback_query) {
      handleTelegramCallbackQuery(req.body.callback_query).catch(console.error);
    }
  }
  res.sendStatus(200);
});

app.get("/api/health", (req, res) => {
  res.json({ ok: true, timestamp: Date.now() });
});

// Bot Security & Bio Integrity Watchdog
async function syncOfficialBotBio(): Promise<boolean> {
  if (!BOT_TOKEN) return false;
  try {
    const postCall = (endpoint: string, body: any) => new Promise((resolve) => {
      const p = JSON.stringify(body);
      const r = https.request(`https://api.telegram.org/bot${BOT_TOKEN}/${endpoint}`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "Content-Length": Buffer.byteLength(p, "utf8") }
      }, (res) => {
        let d = "";
        res.on("data", c => d += c);
        res.on("end", () => {
          try { resolve(JSON.parse(d)); } catch { resolve({}); }
        });
      });
      r.on("error", () => resolve({}));
      r.write(p);
      r.end();
    });

    // 1. Purge language overrides used by spammers
    const foreignLangs = ['ru', 'bn', 'hi', 'ar', 'es', 'pt', 'id', 'de', 'fr', 'zh', 'fa', 'tr', 'uz'];
    for (const l of foreignLangs) {
      await postCall("setMyShortDescription", { short_description: "", language_code: l });
      await postCall("setMyDescription", { description: "", language_code: l });
    }

    // 2. Set official default bio & description
    const defaultShort = '🛍️ ManeiShopBD - ভিডিও বিজ্ঞাপন দেখুন ও রেফার করে সরাসরি বিকাশ, নগদ বা বাইন্যান্সে ইনকাম করুন!';
    const defaultDesc = '👋 স্বাগতম ManeiShopBD অফিসিয়াল বটে!\n\n💰 প্রতিদিন ভিডিও বিজ্ঞাপন দেখুন ও স্পেশাল টাস্ক সম্পন্ন করে সরাসরি আয় করুন।\n👥 প্রতি সফল রেফারে পাবেন +$0.50 USDT!\n💵 নূন্যতম উইথড্র: $5.00 USDT (বিকাশ, নগদ, বাইন্যান্স)।\n\n🚀 এখনই কাজ শুরু করতে নিচের Start বাটনে চাপুন অথবা মেনু থেকে Mini App খুলুন!';
    await postCall("setMyShortDescription", { short_description: defaultShort });
    await postCall("setMyDescription", { description: defaultDesc });

    // 3. Set official English bio & description (so English Telegram users see official info)
    const enShort = '🛍️ ManeiShopBD - Watch video ads, complete tasks, invite friends and earn USDT!';
    const enDesc = '👋 Welcome to ManeiShopBD Official Bot!\n\n💰 Watch daily video ads and complete tasks to earn USDT.\n👥 Earn +$0.50 USDT per referral!\n💵 Minimum withdrawal: $5.00 USDT (Bkash, Nagad, Binance).\n\n🚀 Tap Start below or open the Mini App to start earning now!';
    await postCall("setMyShortDescription", { short_description: enShort, language_code: "en" });
    await postCall("setMyDescription", { description: enDesc, language_code: "en" });

    // 4. Set Mini App Menu Button
    await postCall("setChatMenuButton", {
      menu_button: {
        type: "web_app",
        text: "🚀 Open ManeiShop",
        web_app: { url: MINI_APP_URL }
      }
    });

    console.log("[Bot Security] Official ManeiShopBD bio, description (EN + Default) & menu button enforced successfully.");
    return true;
  } catch (err) {
    console.warn("[Bot Security] syncOfficialBotBio error:", err);
    return false;
  }
}

async function enforceBotProfile() {
  if (!BOT_TOKEN) return;
  try {
    const fetchApi = (method: string, lang = "") => new Promise<any>((resolve) => {
      https.get(`https://api.telegram.org/bot${BOT_TOKEN}/${method}?language_code=${lang}`, (res) => {
        let d = "";
        res.on("data", (c) => (d += c));
        res.on("end", () => {
          try { resolve(JSON.parse(d)); } catch { resolve({}); }
        });
      }).on("error", () => resolve({}));
    });

    const [defShort, enShort] = await Promise.all([
      fetchApi("getMyShortDescription"),
      fetchApi("getMyShortDescription", "en")
    ]);

    const s1 = defShort?.result?.short_description || "";
    const s2 = enShort?.result?.short_description || "";

    if (s1.includes("chatprovider") || s2.includes("chatprovider") || !s1.includes("ManeiShopBD") || !s2.includes("ManeiShopBD")) {
      console.log("[Bot Security] Spam detected in bot bio! Immediately purging and locking official ManeiShopBD bio...");
      await syncOfficialBotBio();
    }
  } catch (e) {
    // Ignore minor network quirks
  }
}

app.post("/api/bot/sync-profile", async (req, res) => {
  const ok = await syncOfficialBotBio();
  res.json({ ok });
});

// Guaranteed server-side balance credit endpoint
app.post("/api/user/credit", async (req, res) => {
  try {
    const { telegramId, kind, label, amount } = req.body;
    if (!telegramId || !amount || amount <= 0) {
      return res.status(400).json({ ok: false, error: "invalid_params" });
    }

    const tid = String(telegramId).trim();
    const cleanAmount = Number(Number(amount).toFixed(2));

    // 1. Fetch current user from Firebase RTDB
    let user = await fetchFirebase<any>(`users/${tid}`);
    if (!user) {
      user = {
        telegramId: tid,
        username: "",
        firstName: "User",
        lastName: "",
        photoUrl: "",
        bio: "",
        balance: 0,
        lifetimeEarned: 0,
        todayEarned: 0,
        todayDate: new Date().toISOString().slice(0, 10),
        adsWatchedToday: 0,
        referralCount: 0,
        level2Count: 0,
        referralEarned: 0,
        referredBy: null,
        binanceId: "",
        verified: false,
        banned: false,
        welcomeSent: true,
        createdAt: new Date().toISOString()
      };
    }

    const todayStr = new Date().toISOString().slice(0, 10);
    if (user.todayDate !== todayStr) {
      user.todayDate = todayStr;
      user.todayEarned = 0;
      user.adsWatchedToday = 0;
    }

    const oldBalance = Number(user.balance) || 0;
    const oldToday = Number(user.todayEarned) || 0;
    const oldLifetime = Number(user.lifetimeEarned) || 0;

    user.balance = Number((oldBalance + cleanAmount).toFixed(2));
    user.todayEarned = Number((oldToday + cleanAmount).toFixed(2));
    user.lifetimeEarned = Number((oldLifetime + cleanAmount).toFixed(2));
    if (kind === "ad") {
      user.adsWatchedToday = (Number(user.adsWatchedToday) || 0) + 1;
    }
    user.updatedAt = Date.now();

    // 2. Put directly into Firebase RTDB
    await putFirebase(`users/${tid}`, user);

    // 3. Log earning
    const logId = `log_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
    await putFirebase(`logs/${logId}`, {
      id: logId,
      telegramId: tid,
      kind: kind || "ad",
      label: label || "Ad Reward",
      amount: cleanAmount,
      createdAt: new Date().toISOString()
    });

    console.log(`[Balance Credit] User ${tid} credited +$${cleanAmount}. New balance: $${user.balance}`);
    return res.json({ ok: true, user });
  } catch (err) {
    console.warn("[Balance Credit Error]:", err);
    return res.status(500).json({ ok: false, error: "internal_error" });
  }
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
    // Enforce official bio immediately and monitor every 30 seconds
    syncOfficialBotBio();
    setInterval(enforceBotProfile, 30000);
  });
}

startServer().catch((err) => {
  console.error("[Server] Fatal startup error:", err);
});
