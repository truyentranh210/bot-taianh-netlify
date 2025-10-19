const fetch = require("node-fetch");

const TOKEN = "8266374536:AAGCn-Hw0raOqGXrBymkTOmmFxZSR-EG120";
const API_DOWNLOAD = "https://api-taianh-210.netlify.app/tai?url=";
const API_TRUYEN = "https://api-doctruyen210.netlify.app/truyen/";

const TELEGRAM_API = `https://api.telegram.org/bot${TOKEN}`;

exports.handler = async (event) => {
  if (event.httpMethod !== "POST") {
    return { statusCode: 200, body: "Only POST accepted" };
  }

  const body = JSON.parse(event.body || "{}");
  const message = body.message || body.callback_query?.message;
  const chatId = message?.chat?.id;
  const text = body.message?.text;
  const callback = body.callback_query?.data;

  if (!chatId) return { statusCode: 200, body: "No chat" };

  async function sendMessage(text, extra = {}) {
    await fetch(`${TELEGRAM_API}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: chatId,
        text,
        parse_mode: "Markdown",
        ...extra,
      }),
    });
  }

  async function sendPhoto(url, caption) {
    await fetch(`${TELEGRAM_API}/sendPhoto`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ chat_id: chatId, photo: url, caption }),
    });
  }

  async function sendDocument(buffer, filename, caption) {
    await fetch(`${TELEGRAM_API}/sendDocument`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: chatId,
        document: buffer,
        caption,
      }),
    });
  }

  // Menu chính
  const menu = {
    inline_keyboard: [
      [{ text: "📖 Đọc truyện", callback_data: "read_all" }],
      [{ text: "🚀 Tải truyện ZIP", callback_data: "start_download" }],
      [{ text: "⏰ Time", callback_data: "show_time" }],
    ],
  };

  // /start
  if (text?.startsWith("/start")) {
    await sendMessage(
      "👋 Xin chào!\n\nTôi là bot đọc và tải truyện.\nChọn tính năng bên dưới 👇",
      { reply_markup: menu }
    );
  }

  // Nút xem thời gian
  if (callback === "show_time") {
    const vnTime = new Date(Date.now() + 7 * 60 * 60 * 1000).toLocaleString("vi-VN");
    await sendMessage(`🕒 Giờ hiện tại (VN): ${vnTime}`);
  }

  // Danh sách truyện
  if (callback === "read_all") {
    const res = await fetch(`${API_TRUYEN}/all`);
    const data = await res.json();
    const titles = Object.keys(data).slice(0, 10);
    const kb = titles.map((t) => [{ text: t, callback_data: `story|${t}` }]);
    await sendMessage("📚 Danh sách truyện:", {
      reply_markup: { inline_keyboard: kb },
    });
  }

  // Đọc truyện cụ thể
  if (callback?.startsWith("story|")) {
    const slug = callback.split("|")[1];
    const res = await fetch(`${API_TRUYEN}/${slug}`);
    const data = await res.json();

    if (!data.images?.length) {
      await sendMessage("❌ Không có ảnh trong truyện này.");
    } else {
      await sendPhoto(data.images[0], `📖 ${data.title}`);
    }
  }

  // Tải ZIP
  if (callback === "start_download") {
    await sendMessage("📎 Gửi link truyện (HTTP hoặc HTTPS):");
  }

  // Nếu user gửi link
  if (text?.startsWith("http")) {
    await sendMessage("⏳ Đang tải truyện, vui lòng đợi...");
    try {
      const apiUrl = `${API_DOWNLOAD}${encodeURIComponent(text)}`;
      const resp = await fetch(apiUrl);
      const data = await resp.json();
      const imgs = data.comic_images || [];

      if (!imgs.length) {
        await sendMessage("❌ Không tìm thấy ảnh trong link này.");
      } else {
        await sendMessage(`✅ Tải thành công ${imgs.length} ảnh!`);
      }
    } catch (e) {
      await sendMessage(`❌ Lỗi: ${e.message}`);
    }
  }

  return { statusCode: 200, body: "ok" };
};
