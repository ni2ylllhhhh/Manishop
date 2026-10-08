/**
 * Cloudflare Worker for ManeiShopBD
 * Handles:
 * 1. Telegram Bot Webhook (/webhook) -> Replies with Welcome message & registers user in Firebase
 * 2. Telegram Send Message Proxy (/api/send-message)
 * 3. Static Assets / SPA Serving
 */

const BOT_TOKEN = (typeof process !== "undefined" && process.env?.BOT_TOKEN) || "";
const MINI_APP_URL = "https://manishop.ziniyaapu7.workers.dev/";
const RTDB_URL = "https://maneishopbd-default-rtdb.firebaseio.com";

async function sendTelegramMessage(chatId, text, replyMarkup) {
  if (!BOT_TOKEN || !chatId) return false;
  const res = await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
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

async function handleTelegramUpdate(update) {
  const message = update?.message;
  if (!message || !message.chat || message.chat.type !== "private") return;

  const chatId = String(message.chat.id);
  const text = String(message.text || "").trim();
  const firstName = message.from?.first_name || "User";
  const lastName = message.from?.last_name || "";
  const username = message.from?.username || "";

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
            { inline_keyboard: [[{ text: "🚀 Open ManeiShop App", web_app: { url: MINI_APP_URL } }]] }
          );
        }
      } catch {}
    }
  }

  const userBalance = existingUser ? Number(existingUser.balance || 0).toFixed(2) : "0.01";
  const welcomeText = `🎉 <b>স্বাগতম ${firstName}!</b>\n\n🎁 <b>নতুন জয়েনিং বোনাস:</b> +$0.01 USDT আপনার একাউন্টে যোগ হয়েছে!\n💵 <b>বর্তমান ব্যালেন্স:</b> $${userBalance} USDT\n\n👉 প্রতিদিন ভিডিও অ্যাড দেখুন ও স্পেশাল টাস্ক পূরণ করে সরাসরি বিকাশ, নগদ বা বাইন্যান্সে টাকা তুলুন।\n👥 <b>প্রতি সফল রেফারে পাবেন:</b> +$0.50 USDT!\n💰 <b>নূন্যতম উইথড্র:</b> $5.00 USDT\n\n🚀 এখনই কাজ শুরু করতে নিচের বাটনে চাপুন!`;

  await sendTelegramMessage(chatId, welcomeText, {
    inline_keyboard: [[{ text: "🚀 Open ManeiShop App", web_app: { url: MINI_APP_URL } }]]
  });
}

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);

    // 1. Telegram Webhook Endpoint
    if (url.pathname === "/webhook" || url.pathname === "/api/telegram-webhook") {
      if (request.method === "POST") {
        try {
          const update = await request.json();
          ctx.waitUntil(handleTelegramUpdate(update));
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

      try {
        const tgRes = await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/getChatMember?chat_id=@${encodeURIComponent(channel)}&user_id=${encodeURIComponent(userId)}`);
        const data = await tgRes.json().catch(() => ({}));
        if (data.ok) {
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
        return new Response(JSON.stringify({ ok: true, isMember: false, status: "not_member", error: desc }), {
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

    // Pass through to assets/default
    if (env.ASSETS) {
      return env.ASSETS.fetch(request);
    }
    return new Response("ManeiShop Worker Active", { status: 200 });
  }
};
