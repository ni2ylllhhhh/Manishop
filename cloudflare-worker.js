/**
 * Cloudflare Worker for ManeiShopBD
 * Handles:
 * 1. Telegram Bot Webhook (/webhook) -> Replies with Welcome message & registers user in Firebase
 * 2. Telegram Send Message Proxy (/api/send-message)
 * 3. Static Assets / SPA Serving
 */

const DEFAULT_BOT_TOKEN = "8922187032:AAHPHZLBGZB5ueeGD-Pb8XsWMoBKPCBJwwI";
const BOT_TOKEN = (typeof process !== "undefined" && process.env?.BOT_TOKEN) || DEFAULT_BOT_TOKEN;
const MINI_APP_URL = "https://manishop.ziniyaapu7.workers.dev/";
const RTDB_URL = "https://maneishopbd-default-rtdb.firebaseio.com";

async function sendTelegramMessage(chatId, text, replyMarkup, customToken) {
  const activeToken = customToken || BOT_TOKEN || DEFAULT_BOT_TOKEN;
  if (!activeToken || !chatId) return false;
  const res = await fetch(`https://api.telegram.org/bot${activeToken}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      chat_id: String(chatId).trim(),
      text,
      parse_mode: "HTML",
      ...(replyMarkup ? { reply_markup: replyMarkup } : {})
    })
  });
  const data = await res.json().catch(() => ({}));
  return Boolean(data.ok);
}

async function answerCallbackQuery(activeToken, callbackQueryId, text, showAlert = false) {
  const token = activeToken || DEFAULT_BOT_TOKEN;
  if (!token || !callbackQueryId) return false;
  try {
    const res = await fetch(`https://api.telegram.org/bot${token}/answerCallbackQuery`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        callback_query_id: callbackQueryId,
        text: text || "",
        show_alert: showAlert
      })
    });
    const data = await res.json().catch(() => ({}));
    return Boolean(data.ok);
  } catch {
    return false;
  }
}

async function checkUserInTelegramChannel(activeToken, usernameOrId, userId) {
  const token = activeToken || DEFAULT_BOT_TOKEN;
  if (!token || !usernameOrId || !userId) return false;
  const clean = String(usernameOrId).replace(/^(https?:\/\/)?(www\.)?(t\.me\/|telegram\.me\/)/i, "").replace(/^@/, "").split("/")[0].split("?")[0].trim();
  const targetChatId = clean.startsWith("-") || /^\d+$/.test(clean) ? clean : `@${clean}`;

  try {
    const res = await fetch(`https://api.telegram.org/bot${token}/getChatMember?chat_id=${encodeURIComponent(targetChatId)}&user_id=${encodeURIComponent(userId)}`);
    const data = await res.json().catch(() => ({}));
    if (data.ok && data.result) {
      const st = data.result.status;
      return st === "creator" || st === "administrator" || st === "member" || st === "restricted";
    }
    const desc = data.description || "";
    if (desc.includes("member list is inaccessible")) {
      return true; // Don't block if bot lacks admin rights in private channel
    }
    return false;
  } catch {
    return false;
  }
}

async function checkAllRequiredChannels(activeToken, chatId) {
  let channels = [
    { id: "main", name: "Main Channel", username: "ManiShop_Community", url: "https://t.me/ManiShop_Community" },
    { id: "payment", name: "Payment Channel", username: "Earning_Money_Lob", url: "https://t.me/Earning_Money_Lob" }
  ];

  try {
    const res = await fetch(`${RTDB_URL}/config.json`);
    const cfg = await res.json();
    if (cfg && Array.isArray(cfg.requiredChannels) && cfg.requiredChannels.length > 0) {
      channels = cfg.requiredChannels;
    }
  } catch {}

  const missingChannels = [];
  for (const ch of channels) {
    if (!ch.username) continue;
    const isMember = await checkUserInTelegramChannel(activeToken, ch.username, chatId);
    if (!isMember) {
      missingChannels.push(ch.name || ch.username);
    }
  }

  return {
    allJoined: missingChannels.length === 0,
    missingChannels
  };
}

async function handleTelegramUpdate(update, env) {
  const activeToken = env?.BOT_TOKEN || BOT_TOKEN || DEFAULT_BOT_TOKEN;

  // 1. Handle Callback Query (e.g., "✅ চ্যানেল ভেরিফাই করুন" button clicks)
  if (update?.callback_query) {
    const query = update.callback_query;
    const callbackId = String(query.id);
    const chatId = String(query.message?.chat?.id || query.from?.id);
    const data = String(query.data || "");
    const firstName = query.from?.first_name || "User";

    if (data === "check_channels" || data === "verify") {
      const { allJoined, missingChannels } = await checkAllRequiredChannels(activeToken, chatId);

      if (allJoined) {
        try {
          await fetch(`${RTDB_URL}/users/${chatId}/verified.json`, {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(true)
          });
        } catch {}

        await answerCallbackQuery(activeToken, callbackId, "🎉 অভিনন্দন! চ্যানেল ভেরিফিকেশন সফল হয়েছে!", true);

        const successText = `🎉 <b>অভিনন্দন ${firstName}!</b>\n\n✅ <b>আপনার চ্যানেল ভেরিফিকেশন সফল হয়েছে!</b>\nএখন আপনি অ্যাপে প্রবেশ করে আনলিমিটেড ভিডিও অ্যাড দেখে ও টাস্ক পূরণ করে ইনকাম শুরু করতে পারবেন।\n\n🚀 নিচের বাটনে ক্লিক করে অ্যাপ ওপেন করুন:`;

        await sendTelegramMessage(chatId, successText, {
          inline_keyboard: [
            [{ text: "🚀 Open ManeiShop App", web_app: { url: MINI_APP_URL } }],
            [
              { text: "📢 Main Channel", url: "https://t.me/ManiShop_Community" },
              { text: "💳 Payment Channel", url: "https://t.me/Earning_Money_Lob" }
            ]
          ]
        }, activeToken);
      } else {
        await answerCallbackQuery(
          activeToken,
          callbackId,
          `⚠️ আপনি এখনো ${missingChannels.join(" ও ")} এ জয়েন করেননি! দয়া করে আগে জয়েন করুন।`,
          true
        );
      }
    } else {
      await answerCallbackQuery(activeToken, callbackId);
    }
    return;
  }

  // 2. Handle Message (/start, /verify, text messages)
  const message = update?.message;
  if (!message || !message.chat || message.chat.type !== "private") return;

  const chatId = String(message.chat.id);
  const text = String(message.text || "").trim();
  const firstName = message.from?.first_name || "User";
  const lastName = message.from?.last_name || "";
  const username = message.from?.username || "";

  // Handle /admin command in Telegram bot
  if (text === "/admin" || text.startsWith("/admin")) {
    const adminUrl = "https://manishop.ziniyaapu7.workers.dev/admin";
    await sendTelegramMessage(
      chatId,
      `🛡️ <b>ManeiShop Admin Panel</b>\n\nএডমিন প্যানেলে প্রবেশ করতে নিচের বাটনে চাপুন:\n\n🔑 <b>Default PIN:</b> <code>445566</code> (অথবা <code>1234</code>)`,
      {
        inline_keyboard: [
          [{ text: "🔐 Open Admin Panel (Mini App)", web_app: { url: adminUrl } }],
          [{ text: "🌐 Open in Web Browser", url: adminUrl }]
        ]
      },
      activeToken
    );
    return;
  }

  const isStart = text.startsWith("/start");
  let referrerId = null;
  if (isStart) {
    const parts = text.split(" ");
    if (parts.length > 1 && parts[1].trim()) {
      const rawRef = parts[1].trim().replace(/^(ref_|c2c_|r_|startapp_|start_)/i, '');
      if (rawRef && rawRef !== chatId && /^\d+$/.test(rawRef)) {
        referrerId = rawRef;
      }
    }
  }

  // Check user in Firebase RTDB
  let existingUser = null;
  try {
    const res = await fetch(`${RTDB_URL}/users/${chatId}.json`);
    existingUser = await res.json();
  } catch {}

  const now = new Date().toISOString();

  if (!existingUser) {
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

    await fetch(`${RTDB_URL}/users/${chatId}.json`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(newUser)
    });

    if (referrerId) {
      try {
        const pRes = await fetch(`${RTDB_URL}/users/${referrerId}.json`);
        const parent = await pRes.json();
        if (parent) {
          parent.referralCount = (Number(parent.referralCount) || 0) + 1;
          parent.balance = Number(((Number(parent.balance) || 0) + 0.50).toFixed(2));
          parent.lifetimeEarned = Number(((Number(parent.lifetimeEarned) || 0) + 0.50).toFixed(2));
          parent.referralEarned = Number(((Number(parent.referralEarned) || 0) + 0.50).toFixed(2));
          parent.updatedAt = Date.now();

          await fetch(`${RTDB_URL}/users/${referrerId}.json`, {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(parent)
          });

          const refId = `ref_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
          await fetch(`${RTDB_URL}/referrals/${refId}.json`, {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              id: refId,
              referrerTelegramId: referrerId,
              referredTelegramId: chatId,
              level: 1,
              bonus: 0.50,
              createdAt: now
            })
          });

          await sendTelegramMessage(
            referrerId,
            `🎉 <b>নতুন রেফারেল যুক্ত হয়েছে!</b>\n\n👤 <b>নতুন সদস্য:</b> ${firstName}\n📊 <b>আপনার বর্তমান রেফারেল:</b> ${parent.referralCount} জন\n💰 <b>রেফারেল বোনাস:</b> +$0.50 USDT\n💵 <b>বর্তমান ব্যালেন্স:</b> $${parent.balance.toFixed(2)} USDT\n🎯 <b>উইথড্র রিকোয়ারমেন্ট:</b> ${parent.referralCount}/15 জন`,
            { inline_keyboard: [[{ text: "🚀 Open ManeiShop App", web_app: { url: MINI_APP_URL } }]] },
            activeToken
          );
        }
      } catch {}
    }
  }

  // Check channel verification
  const { allJoined, missingChannels } = await checkAllRequiredChannels(activeToken, chatId);
  const userBalance = existingUser ? Number(existingUser.balance || 0).toFixed(2) : "0.01";

  if (allJoined) {
    try {
      await fetch(`${RTDB_URL}/users/${chatId}/verified.json`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(true)
      });
    } catch {}

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
    }, activeToken);
  } else {
    try {
      await fetch(`${RTDB_URL}/users/${chatId}/verified.json`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(false)
      });
    } catch {}

    const gateText = `👋 <b>হ্যালো ${firstName}! ManeiShopBD এ স্বাগতম!</b>\n\n⚠️ <b>বট ও অ্যাপে কাজ করতে হলে নিচের অফিশিয়াল চ্যানেলগুলোতে জয়েন থাকা বাধ্যতামূলক:</b>\n\n1️⃣ 📢 <b>Main Channel:</b> @ManiShop_Community\n2️⃣ 💳 <b>Payment Channel:</b> @Earning_Money_Lob\n\n👉 উপরের চ্যানেলগুলোতে জয়েন করে নিচের <b>'✅ ভেরিফাই করুন'</b> বাটনে চাপুন:`;

    await sendTelegramMessage(chatId, gateText, {
      inline_keyboard: [
        [{ text: "📢 1. Join Main Channel", url: "https://t.me/ManiShop_Community" }],
        [{ text: "💳 2. Join Payment Channel", url: "https://t.me/Earning_Money_Lob" }],
        [{ text: "✅ চ্যানেল ভেরিফাই করুন (Verify)", callback_data: "check_channels" }],
        [{ text: "🚀 Open ManeiShop App", web_app: { url: MINI_APP_URL } }]
      ]
    }, activeToken);
  }
}

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);

    // 1. Telegram Webhook Endpoint
    if (url.pathname === "/webhook" || url.pathname === "/api/telegram-webhook") {
      if (request.method === "POST") {
        try {
          const update = await request.json();
          ctx.waitUntil(handleTelegramUpdate(update, env));
        } catch {}
        return new Response("OK", { status: 200 });
      }
      return new Response("Webhook endpoint active", { status: 200 });
    }

    // 2. Telegram Send-Message Proxy Endpoint
    if (url.pathname === "/api/send-message" && request.method === "POST") {
      try {
        const body = await request.json();
        const ok = await sendTelegramMessage(body.chatId, body.text, body.replyMarkup);
        return new Response(JSON.stringify({ ok }), {
          headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" }
        });
      } catch (err) {
        return new Response(JSON.stringify({ ok: false, error: String(err) }), {
          status: 400,
          headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" }
        });
      }
    }

    // 2b. Real-Time Mini App Referral & Session Notification Endpoint
    if (url.pathname === "/api/notify-referral" && request.method === "POST") {
      try {
        const body = await request.json();
        const { newUserId, newUserName, referrerId, isExisting, balance, todayEarned, referralCount } = body || {};
        const cleanUid = String(newUserId || "").trim().replace(/^@/, '');
        const cleanName = String(newUserName || "ইউজার").trim();
        const cleanRef = String(referrerId || "").trim().replace(/^@/, '');

        if (cleanUid && /^\d+$/.test(cleanUid) && cleanUid !== "724910385") {
          if (!isExisting) {
            const welcomeText = `🎉 <b>স্বাগতম ${cleanName}!</b>\n\n🎁 <b>নতুন জয়েনিং বোনাস:</b> +$0.01 USDT আপনার একাউন্টে যোগ হয়েছে!\n💵 <b>বর্তমান ব্যালেন্স:</b> $0.01 USDT\n\n👉 প্রতিদিন ভিডিও অ্যাড দেখুন ও স্পেশাল টাস্ক পূরণ করে সরাসরি বিকাশ, নগদ বা বাইন্যান্সে টাকা তুলুন।\n👥 <b>প্রতি সফল রেফারে পাবেন:</b> +$0.50 USDT!\n💰 <b>নূন্যতম উইথড্র:</b> $5.00 USDT\n\n🚀 এখনই কাজ শুরু করতে নিচের বাটনে চাপুন!`;
            await sendTelegramMessage(cleanUid, welcomeText, {
              inline_keyboard: [[{ text: "🚀 Open ManeiShop App", web_app: { url: MINI_APP_URL } }]]
            });
          }
        }

        if (cleanRef && cleanRef !== cleanUid && /^\d+$/.test(cleanRef) && cleanRef !== "724910385") {
          const referrerText = `🎉 <b>নতুন রেফারেল যুক্ত হয়েছে!</b>\n\n👤 <b>নতুন সদস্য:</b> ${cleanName}\n💰 <b>রেফারেল বোনাস:</b> +$0.50 USDT\n\n🚀 এখনই ManeiShop অ্যাপে চেক করুন!`;
          await sendTelegramMessage(cleanRef, referrerText, {
            inline_keyboard: [[{ text: "🚀 Open ManeiShop App", web_app: { url: MINI_APP_URL } }]]
          });
        }

        return new Response(JSON.stringify({ ok: true }), {
          headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" }
        });
      } catch (err) {
        return new Response(JSON.stringify({ ok: false, error: String(err) }), {
          status: 500,
          headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" }
        });
      }
    }

    // 2c. Guaranteed Balance Credit Endpoint
    if (url.pathname === "/api/user/credit") {
      if (request.method === "OPTIONS") {
        return new Response(null, {
          status: 204,
          headers: {
            "Access-Control-Allow-Origin": "*",
            "Access-Control-Allow-Methods": "POST, OPTIONS",
            "Access-Control-Allow-Headers": "Content-Type"
          }
        });
      }
      if (request.method === "POST") {
        try {
          const body = await request.json();
          const { telegramId, kind, label, amount } = body || {};
          const tid = String(telegramId || "").trim();
          const cleanAmount = Number(Number(amount || 0).toFixed(2));
          if (!tid || cleanAmount <= 0) {
            return new Response(JSON.stringify({ ok: false, error: "invalid_params" }), {
              status: 400,
              headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" }
            });
          }

          let user = null;
          try {
            const uRes = await fetch(`${RTDB_URL}/users/${tid}.json`);
            if (uRes.ok) user = await uRes.json();
          } catch {}

          const now = new Date().toISOString();
          const todayStr = now.slice(0, 10);

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
              todayDate: todayStr,
              adsWatchedToday: 0,
              referralCount: 0,
              level2Count: 0,
              referralEarned: 0,
              referredBy: null,
              binanceId: "",
              following: [],
              verified: false,
              banned: false,
              welcomeSent: true,
              createdAt: now,
              lastLogin: now
            };
          }

          if (user.todayDate !== todayStr) {
            user.todayDate = todayStr;
            user.todayEarned = 0;
            user.adsWatchedToday = 0;
          }

          const oldBal = Number(user.balance) || 0;
          const oldToday = Number(user.todayEarned) || 0;
          const oldLife = Number(user.lifetimeEarned) || 0;

          user.balance = Number((oldBal + cleanAmount).toFixed(2));
          user.todayEarned = Number((oldToday + cleanAmount).toFixed(2));
          user.lifetimeEarned = Number((oldLife + cleanAmount).toFixed(2));
          if (kind === "ad") {
            user.adsWatchedToday = (Number(user.adsWatchedToday) || 0) + 1;
          }
          user.updatedAt = Date.now();

          // Save user to Firebase RTDB
          await fetch(`${RTDB_URL}/users/${tid}.json`, {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(user)
          });

          // Save log to Firebase RTDB
          const logId = `log_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
          await fetch(`${RTDB_URL}/logs/${logId}.json`, {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              id: logId,
              telegramId: tid,
              kind: kind || "ad",
              label: label || "Ad Reward",
              amount: cleanAmount,
              createdAt: now
            })
          });

          return new Response(JSON.stringify({ ok: true, user }), {
            headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" }
          });
        } catch (err) {
          return new Response(JSON.stringify({ ok: false, error: String(err) }), {
            status: 500,
            headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" }
          });
        }
      }
    }

    // 3. Telegram Check-Member Proxy Endpoint
    if (url.pathname === "/api/check-member" && request.method === "GET") {
      const channel = (url.searchParams.get("channel") || "").replace(/^(https?:\/\/)?(www\.)?(t\.me\/|telegram\.me\/)/i, "").replace(/^@/, "").split("/")[0].split("?")[0].trim();
      const userId = (url.searchParams.get("userId") || "").trim();
      if (!channel || !userId) {
        return new Response(JSON.stringify({ ok: false, error: "Missing parameters" }), {
          status: 400,
          headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" }
        });
      }

      const botToken = env?.BOT_TOKEN || BOT_TOKEN || DEFAULT_BOT_TOKEN;
      const targetChatId = channel.startsWith("-") || /^\d+$/.test(channel) ? channel : `@${channel}`;
      try {
        const tgRes = await fetch(`https://api.telegram.org/bot${botToken}/getChatMember?chat_id=${encodeURIComponent(targetChatId)}&user_id=${encodeURIComponent(userId)}`);
        const data = await tgRes.json().catch(() => ({}));
        if (data.ok && data.result) {
          const st = data.result?.status;
          const isMember = st === "creator" || st === "administrator" || st === "member" || st === "restricted";
          return new Response(JSON.stringify({ ok: true, isMember, status: st }), {
            headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" }
          });
        }
        const desc = data.description || "";
        if (desc.includes("member list is inaccessible")) {
          return new Response(JSON.stringify({ ok: false, isMember: false, needsBotAdmin: true, error: desc }), {
            headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" }
          });
        }
        return new Response(JSON.stringify({ ok: false, isMember: false, status: "error", error: desc || "Telegram check failed" }), {
          headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" }
        });
      } catch (err) {
        return new Response(JSON.stringify({ ok: false, isMember: false, error: String(err) }), {
          status: 500,
          headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" }
        });
      }
    }

    // 4. Telegram Broadcast Item Proxy Endpoint
    if (url.pathname === "/api/broadcast-send-item" && request.method === "POST") {
      try {
        const body = await request.json();
        const { chatId, messageType, text, mediaUrl, replyMarkup } = body;
        let endpoint = "sendMessage";
        const postData = {
          chat_id: chatId,
          parse_mode: "HTML",
          ...(replyMarkup ? { reply_markup: replyMarkup } : {})
        };
        if (messageType === 'photo' && mediaUrl) {
          endpoint = "sendPhoto";
          postData.photo = mediaUrl;
          postData.caption = text;
        } else if (messageType === 'video' && mediaUrl) {
          endpoint = "sendVideo";
          postData.video = mediaUrl;
          postData.caption = text;
        } else if (messageType === 'document' && mediaUrl) {
          endpoint = "sendDocument";
          postData.document = mediaUrl;
          postData.caption = text;
        } else {
          postData.text = text;
        }

        const res = await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/${endpoint}`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(postData)
        });
        const json = await res.json().catch(() => ({}));
        return new Response(JSON.stringify(json), {
          headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" }
        });
      } catch (err) {
        return new Response(JSON.stringify({ ok: false, error: String(err) }), {
          status: 500,
          headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" }
        });
      }
    }

    // Pass through to assets / SPA Serving
    if (env.ASSETS) {
      const pathname = url.pathname;
      const isFile = pathname.includes(".") && !pathname.endsWith(".html");

      // For SPA routes like /admin, /refer, /rank, /wallet, /profile - serve index.html directly
      if (!isFile && request.method === "GET") {
        const indexRequest = new Request(new URL("/index.html", request.url), request);
        const indexRes = await env.ASSETS.fetch(indexRequest);
        if (indexRes.status < 400) {
          return indexRes;
        }
      }

      const assetRes = await env.ASSETS.fetch(request);
      if (assetRes.status === 404 && request.method === "GET") {
        const indexRequest = new Request(new URL("/index.html", request.url), request);
        return env.ASSETS.fetch(indexRequest);
      }
      return assetRes;
    }
    return new Response("ManeiShop Worker Active", { status: 200 });
  }
};
