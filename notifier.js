const {
  default: makeWASocket,
  useMultiFileAuthState,
  fetchLatestBaileysVersion
} = require("@whiskeysockets/baileys");

let sock;
let ready = false;
let isInitializing = false;
const target = "213770285417@s.whatsapp.net"; // بدون +

async function initSocket() {
  if (isInitializing) return; // تجنب التهيئة المتكررة
  isInitializing = true;

  const { state, saveCreds } = await useMultiFileAuthState("auth");
  const { version } = await fetchLatestBaileysVersion();

  sock = makeWASocket({ version, auth: state });

  sock.ev.on("creds.update", saveCreds);

  sock.ev.on("connection.update", ({ connection, lastDisconnect }) => {
    if (connection === "open") {
      console.log("✅ الاتصال بواتساب جاهز");
      ready = true;
      isInitializing = false;
    } else if (connection === "close") {
      console.log("🔄 إعادة الاتصال بواتساب...");
      ready = false;
      initSocket(); // إعادة الاتصال عند الانقطاع
    }
  });
}

async function sendWhatsAppNotification(message) {
  if (!sock || !ready) {
    console.log("⌛ جاري الاتصال بواتساب...");
    await initSocket();

    // انتظر حتى الجاهزية
    while (!ready) {
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
  }

  try {
    await sock.sendMessage(target, { text: message });
    console.log("📤 تم إرسال إشعار واتساب بنجاح");
  } catch (err) {
    console.error("❌ فشل إرسال إشعار واتساب:", err);
  }
}

module.exports = { sendWhatsAppNotification };
