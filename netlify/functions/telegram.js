import fetch from "node-fetch";

const TOKEN = "8266374536:AAGCn-Hw0raOqGXrBymkTOmmFxZSR-EG120";
const TELEGRAM_API = `https://api.telegram.org/bot${TOKEN}`;
const API_TRUYEN = "https://api-doctruyen210.netlify.app/truyen";
const API_DOWNLOAD = "https://api-taianh-210.netlify.app/tai?url=";

// ========== HÀM GỬI TIN NHẮN ==========
async function sendMessage(chatId, text, extra = {}) {
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

async function sendPhoto(chatId, photoUrl, caption = "") {
  await fetch(`${TELEGRAM_API}/sendPhoto`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      chat_id: chatId,
      photo: photoUrl,
      caption,
      parse_mode: "Markdown",
    }),
  });
}

// ========== HÀM MÃ HÓA / GIẢI MÃ ==========
function encodeBase64(str) {
  return Buffer.from(str, "utf-8").toString("base64").slice(0, 60);
}
function decodeBase64(str) {
  try {
    return Buffer.from(str, "base64").toString("utf-8");
  } catch {
    return str;
  }
}

// ========== MENU CHÍNH ==========
function mainMenu() {
  return {
    inline_keyboard: [
      [{ text: "📖 Đọc truyện", callback_data: "read_all" }],
      [{ text: "🚀 Tải truyện ZIP", callback_data: "start_download" }],
      [{ text: "⏰ Time", callback_data: "show_time" }],
    ],
  };
}

// ========== HANDLER CHÍNH ==========
export const handler = async (event) => {
  if (event.httpMethod !== "POST") {
    return { statusCode: 200, body: "Only POST accepted" };
  }

  const body = JSON.parse(event.body || "{}");
  const message = body.message || body.callback_query?.message;
  const chatId = message?.chat?.id;
  const text = body.message?.text;
  const callback = body.callback_query?.data;

  if (!chatId) return { statusCode: 200, body: "No chat id" };

  // --- /start ---
  if (text?.startsWith("/start")) {
    await sendMessage(
      chatId,
      "👋 *Xin chào!*\n\nTôi là bot đọc và tải truyện.\nChọn tính năng bên dưới 👇",
      { reply_markup: mainMenu() }
    );
  }

  // --- ⏰ XEM GIỜ ---
  if (callback === "show_time") {
    const vnTime = new Date(Date.now() + 7 * 60 * 60 * 1000).toLocaleString("vi-VN");
    await sendMessage(chatId, `🕒 Giờ hiện tại (VN): ${vnTime}`);
  }

  // --- 📖 ĐỌC TRUYỆN ---
  if (callback === "read_all") {
    try {
      const res = await fetch(`${API_TRUYEN}/all`);
      const text = await res.text(); // raw để tránh lỗi unicode
      const data = JSON.parse(text);

      if (!data || typeof data !== "object") {
        await sendMessage(chatId, "⚠️ Không thể đọc dữ liệu từ API.");
        return;
      }

      const keys = Object.keys(data);
      if (keys.length === 0) {
        await sendMessage(chatId, "⚠️ Không có truyện nào trong danh sách.");
        return;
      }

      const top10 = keys.slice(0, 10);
      console.log("✅ Lấy được danh sách:", top10);

      // tạo nút bấm an toàn
      const buttons = top10.map((t) => [
        { text: t.replace(/-/g, " ").slice(0, 45), callback_data: `story|${encodeBase64(t)}` },
      ]);

      await sendMessage(chatId, "📚 *Danh sách truyện (Top 10)*", {
        reply_markup: { inline_keyboard: buttons },
      });
    } catch (err) {
      console.error("❌ Lỗi đọc API:", err);
      await sendMessage(chatId, `❌ Lỗi khi tải danh sách: ${err.message}`);
    }
  }

  // --- 🖼️ HIỂN THỊ TRUYỆN ---
  if (callback?.startsWith("story|")) {
    const slugEncoded = callback.split("|")[1];
    const slug = decodeBase64(slugEncoded);

    try {
      const res = await fetch(`${API_TRUYEN}/all`);
      const text = await res.text();
      const data = JSON.parse(text);

      const images = data[slug];
      if (!images || images.length === 0) {
        await sendMessage(chatId, "❌ Không có ảnh trong truyện này.");
        return;
      }

      await sendPhoto(chatId, images[0], `📖 ${slug.replace(/-/g, " ")}`);
      await sendMessage(chatId, `🖼️ Tổng số ảnh: ${images.length}`);
    } catch (err) {
      console.error("❌ Lỗi khi tải truyện:", err);
      await sendMessage(chatId, `⚠️ Lỗi khi tải truyện: ${err.message}`);
    }
  }

  // --- 🚀 YÊU CẦU LINK ZIP ---
  if (callback === "start_download") {
    await sendMessage(chatId, "📎 Gửi link truyện bạn muốn tải (HTTP hoặc HTTPS):");
  }

  // --- NHẬN LINK ZIP ---
  if (text?.startsWith("http")) {
    await sendMessage(chatId, "⏳ Đang xử lý link của bạn...");

    try {
      const apiUrl = `${API_DOWNLOAD}${encodeURIComponent(text)}`;
      const resp = await fetch(apiUrl);
      const data = await resp.json();

      const title = data.title || "Truyện không tên";
      const imgs = data.comic_images || [];

      if (!imgs.length) {
        await sendMessage(chatId, "❌ Không tìm thấy ảnh trong link này.");
      } else {
        await sendMessage(
          chatId,
          `✅ Tải thành công *${imgs.length}* ảnh!\n\n📦 Link tải nhanh:\n${apiUrl}`
        );
      }
    } catch (e) {
      await sendMessage(chatId, `❌ Lỗi khi tải truyện: ${e.message}`);
    }
  }

  return { statusCode: 200, body: "ok" };
};
