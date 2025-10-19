import fetch from "node-fetch";

const TOKEN = "8266374536:AAGCn-Hw0raOqGXrBymkTOmmFxZSR-EG120";
const TELEGRAM_API = `https://api.telegram.org/bot${TOKEN}`;
const API_TRUYEN = "https://api-doctruyen210.netlify.app/truyen";
const API_DOWNLOAD = "https://api-taianh-210.netlify.app/tai?url=";

// ============ HÀM TIỆN ÍCH ============
async function sendMessage(chatId, text, extra = {}) {
  const safeText = text.replace(/([_*[\]()~`>#+\-=|{}.!])/g, "\\$1");
  await fetch(`${TELEGRAM_API}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      chat_id: chatId,
      text: safeText,
      parse_mode: "MarkdownV2",
      ...extra,
    }),
  });
}

async function sendPhoto(chatId, photoUrl, caption = "") {
  const safeCap = caption.replace(/([_*[\]()~`>#+\-=|{}.!])/g, "\\$1");
  await fetch(`${TELEGRAM_API}/sendPhoto`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      chat_id: chatId,
      photo: photoUrl,
      caption: safeCap,
      parse_mode: "MarkdownV2",
    }),
  });
}

function safeCallback(title) {
  return "s|" + title.replace(/[^a-zA-Z0-9]/g, "").slice(0, 40);
}

// ============ MENU CHÍNH ============
function mainMenu() {
  return {
    inline_keyboard: [
      [{ text: "📖 Đọc truyện", callback_data: "read_all_v5" }],
      [{ text: "🚀 Tải truyện ZIP", callback_data: "start_download_v5" }],
      [{ text: "⏰ Time", callback_data: "show_time_v5" }],
    ],
  };
}

// ============ HANDLER CHÍNH ============
export const handler = async (event) => {
  if (event.httpMethod !== "POST")
    return { statusCode: 200, body: "Only POST accepted" };

  const body = JSON.parse(event.body || "{}");
  const msg = body.message || body.callback_query?.message;
  const chatId = msg?.chat?.id;
  const text = body.message?.text;
  const callback = body.callback_query?.data;

  if (!chatId) return { statusCode: 200, body: "No chat id" };

  // 🏠 Lệnh /start
  if (text?.startsWith("/start")) {
    await sendMessage(
      chatId,
      "👋 Xin chào!\nTôi là bot đọc và tải truyện.\nChọn tính năng bên dưới 👇",
      { reply_markup: mainMenu() }
    );
  }

  // 🕒 Time
  if (callback === "show_time_v5") {
    const vnTime = new Date(Date.now() + 7 * 3600 * 1000).toLocaleString("vi-VN");
    await sendMessage(chatId, `🕒 Giờ hiện tại (VN): ${vnTime}`);
  }

  // 📚 Danh sách truyện
  if (callback === "read_all_v5") {
    try {
      const res = await fetch(`${API_TRUYEN}/all`);
      const data = await res.json();
      const keys = Object.keys(data);

      if (!keys.length) {
        await sendMessage(chatId, "⚠️ Không có truyện nào trong danh sách.");
        return;
      }

      const top10 = keys.slice(0, 10);
      const buttons = top10.map((t) => [
        {
          text: t.replace(/[^a-zA-Z0-9\s]/g, " ").slice(0, 40),
          callback_data: safeCallback(t),
        },
      ]);

      console.log("✅ Lấy được danh sách:", top10);

      await sendMessage(chatId, "📚 Danh sách truyện (Top 10)", {
        reply_markup: { inline_keyboard: buttons },
      });
    } catch (e) {
      console.error("❌ Lỗi API:", e);
      await sendMessage(chatId, "❌ Lỗi khi tải danh sách truyện.");
    }
  }

  // 🖼️ Xem truyện (có Next/Prev)
  if (callback?.startsWith("s|")) {
    const slug = callback.replace("s|", "");
    try {
      const res = await fetch(`${API_TRUYEN}/all`);
      const data = await res.json();
      const key = Object.keys(data).find((t) =>
        t.replace(/[^a-zA-Z0-9]/g, "").slice(0, 40) === slug
      );
      const imgs = data[key];
      if (!imgs || !imgs.length) {
        await sendMessage(chatId, "❌ Không có ảnh trong truyện này.");
        return;
      }

      await sendPhoto(chatId, imgs[0], `📖 ${key} (1 / ${imgs.length})`);
      await sendMessage(chatId, "➡️ Chuyển trang:", {
        reply_markup: {
          inline_keyboard: [
            [{ text: "➡️ Tiếp theo", callback_data: `next|${slug}|1` }],
          ],
        },
      });
    } catch (e) {
      await sendMessage(chatId, `⚠️ Lỗi khi tải truyện: ${e.message}`);
    }
  }

  // ➡️ Next / Prev
  if (callback?.startsWith("next|") || callback?.startsWith("prev|")) {
    const [action, slug, indexStr] = callback.split("|");
    const index = parseInt(indexStr);
    const res = await fetch(`${API_TRUYEN}/all`);
    const data = await res.json();
    const key = Object.keys(data).find((t) =>
      t.replace(/[^a-zA-Z0-9]/g, "").slice(0, 40) === slug
    );
    const imgs = data[key];
    if (!imgs) return;

    let newIndex = index;
    if (action === "next") newIndex++;
    if (action === "prev") newIndex--;

    if (newIndex < 0 || newIndex >= imgs.length) {
      await sendMessage(chatId, "❌ Hết ảnh rồi!");
      return;
    }

    await sendPhoto(
      chatId,
      imgs[newIndex],
      `📖 ${key} (${newIndex + 1} / ${imgs.length})`
    );

    const buttons = [];
    if (newIndex > 0)
      buttons.push({ text: "⬅️ Trước", callback_data: `prev|${slug}|${newIndex}` });
    if (newIndex < imgs.length - 1)
      buttons.push({ text: "➡️ Tiếp", callback_data: `next|${slug}|${newIndex}` });

    await sendMessage(chatId, "➡️ Chuyển trang:", {
      reply_markup: { inline_keyboard: [buttons] },
    });
  }

  // 🚀 Bắt đầu tải ZIP
  if (callback === "start_download_v5") {
    await sendMessage(chatId, "📎 Gửi link truyện bạn muốn tải (HTTP hoặc HTTPS):");
  }

  // 📎 Khi user gửi link
  if (text?.startsWith("http")) {
    await sendMessage(chatId, "⏳ Đang xử lý link...");

    try {
      const apiUrl = `${API_DOWNLOAD}${encodeURIComponent(text)}`;
      const res = await fetch(apiUrl);
      const data = await res.json();
      const imgs = data.comic_images || [];

      if (!imgs.length) {
        await sendMessage(chatId, "❌ Không tìm thấy ảnh trong link này.");
        return;
      }

      await sendMessage(
        chatId,
        `✅ Tải thành công ${imgs.length} ảnh!\n📦 Link tải nhanh:\n${apiUrl}`
      );
    } catch (e) {
      await sendMessage(chatId, `❌ Lỗi khi tải truyện: ${e.message}`);
    }
  }

  return { statusCode: 200, body: "ok" };
};
