import fetch from "node-fetch";

const TOKEN = "8266374536:AAGCn-Hw0raOqGXrBymkTOmmFxZSR-EG120";
const TELEGRAM_API = `https://api.telegram.org/bot${TOKEN}`;
const API_TRUYEN = "https://api-doctruyen210.netlify.app/truyen";
const API_DOWNLOAD = "https://api-taianh-210.netlify.app/tai?url=";

// =========================== //
//        TIỆN ÍCH CƠ BẢN       //
// =========================== //
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

// =========================== //
//          MENU CHÍNH         //
// =========================== //
function mainMenu() {
  return {
    inline_keyboard: [
      [{ text: "📖 Đọc truyện (mới)", callback_data: "read_all_v3" }],
      [{ text: "🚀 Tải truyện ZIP (mới)", callback_data: "start_download_v3" }],
      [{ text: "⏰ Time", callback_data: "show_time_v3" }],
    ],
  };
}

// =========================== //
//         XỬ LÝ CHÍNH         //
// =========================== //
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

  // 🏠 /start
  if (text?.startsWith("/start")) {
    await sendMessage(
      chatId,
      "👋 *Xin chào!*\n\nTôi là bot đọc và tải truyện.\nHãy chọn tính năng bên dưới 👇",
      { reply_markup: mainMenu() }
    );
  }

  // 🕒 Time
  if (callback === "show_time_v3") {
    const vnTime = new Date(Date.now() + 7 * 3600 * 1000).toLocaleString("vi-VN");
    await sendMessage(chatId, `🕒 Giờ hiện tại (VN): *${vnTime}*`);
  }

  // 📖 Đọc truyện
  if (callback === "read_all_v3") {
    try {
      const res = await fetch(`${API_TRUYEN}/all`);
      const rawText = await res.text();
      let data;

      try {
        data = JSON.parse(rawText);
      } catch {
        await sendMessage(chatId, "⚠️ API trả về dữ liệu không hợp lệ.");
        return;
      }

      const keys = Object.keys(data);
      if (!keys.length) {
        await sendMessage(chatId, "⚠️ Không có truyện nào trong danh sách.");
        return;
      }

      // Lọc và rút gọn
      const safeTitles = keys
        .slice(0, 10)
        .map((title) => ({
          name: title.replace(/[^a-zA-Z0-9\s]/g, " ").slice(0, 45) || "Untitled",
          slug: encodeBase64(title),
        }));

      console.log("✅ Lấy được danh sách:", safeTitles.map((x) => x.name));

      const buttons = safeTitles.map((t) => [
        { text: t.name, callback_data: `story_v3|${t.slug}` },
      ]);

      await sendMessage(chatId, "📚 *Danh sách truyện (Top 10)*", {
        reply_markup: { inline_keyboard: buttons },
      });
    } catch (err) {
      console.error("❌ Lỗi đọc API:", err);
      await sendMessage(chatId, `❌ Lỗi khi tải danh sách: ${err.message}`);
    }
  }

  // 🖼️ Hiển thị truyện
  if (callback?.startsWith("story_v3|")) {
    const slug = decodeBase64(callback.split("|")[1]);
    try {
      const res = await fetch(`${API_TRUYEN}/all`);
      const data = await res.json();
      const imgs = data[slug];

      if (!imgs || !imgs.length) {
        await sendMessage(chatId, "❌ Không có ảnh trong truyện này.");
        return;
      }

      await sendPhoto(chatId, imgs[0], `📖 ${slug.replace(/-/g, " ")}`);
      await sendMessage(chatId, `🖼️ Tổng số ảnh: *${imgs.length}*`);
    } catch (e) {
      await sendMessage(chatId, `⚠️ Lỗi khi tải truyện: ${e.message}`);
    }
  }

  // 🚀 Bắt đầu tải ZIP
  if (callback === "start_download_v3") {
    await sendMessage(chatId, "📎 Gửi link truyện bạn muốn tải (HTTP hoặc HTTPS):");
  }

  // 📎 Xử lý link tải
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
        `✅ Tải thành công *${imgs.length}* ảnh!\n\n📦 Link tải nhanh:\n${apiUrl}`
      );
    } catch (e) {
      await sendMessage(chatId, `❌ Lỗi khi tải truyện: ${e.message}`);
    }
  }

  return { statusCode: 200, body: "ok" };
};
