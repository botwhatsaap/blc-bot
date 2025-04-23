const { default: makeWASocket, useMultiFileAuthState, fetchLatestBaileysVersion, downloadMediaMessage } = require("@whiskeysockets/baileys");
const qrcode = require("qrcode-terminal");
const { createClient } = require("@supabase/supabase-js");
const { exec } = require("child_process");  // إضافة هذه المكتبة لتشغيل سكربتات خارجية
require("dotenv").config();

// إنشاء عميل Supabase
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_KEY);

// تتبع الحالات لكل مستخدم
const userStates = {};

async function startBot() {
  const { state, saveCreds } = await useMultiFileAuthState("auth");
  const { version } = await fetchLatestBaileysVersion();

  const sock = makeWASocket({ version, auth: state });

  // الاتصال الأولي
  sock.ev.on("connection.update", ({ connection, qr }) => {
    if (qr) qrcode.generate(qr, { small: true });
    if (connection === "open") console.log("✅ الاتصال ناجح");
    if (connection === "close") {
      console.log("❌ قطع الاتصال.. إعادة المحاولة");
      startBot();
    }
  });

  sock.ev.on("creds.update", saveCreds);

  // استقبال الرسائل
  sock.ev.on("messages.upsert", async ({ messages }) => {
    const msg = messages[0];
    if (!msg.message || msg.key.fromMe) return;

    const sender = msg.key.remoteJid;
    const textMsg = msg.message.conversation || msg.message.extendedTextMessage?.text;
    const messageType = Object.keys(msg.message)[0];

    // نظام الخطوات التقليدي: صورة + مدة المكوث
    if (!userStates[sender]) {
      userStates[sender] = { step: 0 };
      await sock.sendMessage(sender, { text: "👋 مرحبًا! أرسل صورة سيلفي واضحة لك." });
      return;
    }

    const state = userStates[sender];

    switch (state.step) {
      case 0:
        if (messageType === "imageMessage") {
          const buffer = await downloadMediaMessage(msg, "buffer", {});
          const fileName = `selfies/${Date.now()}_${sender}.jpg`;

          const { data: uploadData, error: uploadError } = await supabase.storage
            .from("images")
            .upload(fileName, buffer, { contentType: "image/jpeg" });

          if (uploadError) {
            await sock.sendMessage(sender, { text: "❌ فشل في رفع الصورة. حاول مجددًا." });
            return;
          }

          state.image_url = `${process.env.SUPABASE_URL}/storage/v1/object/public/images/${fileName}`;
          state.step++;
          await sock.sendMessage(sender, { text: "📆 كم مدة المكوث؟ اكتبها بالأيام فقط (مثال: 20 يومًا)" });
        } else {
          await sock.sendMessage(sender, { text: "📸 من فضلك أرسل صورة سيلفي." });
        }
        break;

      case 1:
        const duration = parseInt(textMsg);
        if (isNaN(duration) || duration <= 0) {
          await sock.sendMessage(sender, { text: "❗ أدخل عدد أيام صالح (مثال: 15)" });
          return;
        }

        // التأكد من أن المدة صالحة وداخل النطاق المتوقع (مثال: بين 1 و 365 يومًا)
        if (duration < 1 || duration > 365) {
          await sock.sendMessage(sender, { text: "❗ المدة يجب أن تكون بين 1 و 365 يومًا." });
          return;
        }

        const { error: insertError } = await supabase.from("users").insert([{
          image_url: state.image_url,
          stay_duration: duration
        }]);

        if (insertError) {
          console.error("❌ خطأ أثناء حفظ البيانات:", insertError.message);
          await sock.sendMessage(sender, { text: "❌ حدث خطأ. حاول لاحقًا." });
        } else {
          await sock.sendMessage(sender, {
            text: `✅ تم تسجيل بياناتك بنجاح!

📧 الآن من فضلك:
1. قم بتسجيل الدخول إلى موقع BLS بنفس الإيميل الذي استخدمته في طلب الموعد.
2. اترك صفحة الحجز مفتوحة في المتصفح.

🌐 رابط موقع BLS:
https://bls.mfa.dz/book-appointment`
          });

          // تشغيل سكربت watcher.js بشكل مستمر
          exec("node watcher.js", (error, stdout, stderr) => {
            if (error) {
              console.error(`❌ حدث خطأ أثناء تشغيل watcher.js: ${error.message}`);
              return;
            }
            if (stderr) {
              console.error(`❌ خطأ في watcher.js: ${stderr}`);
              return;
            }
            console.log(`✅ watcher.js تم تشغيله بنجاح: ${stdout}`);
          });
        }

        delete userStates[sender];
        break;

      default:
        await sock.sendMessage(sender, { text: "⚠️ حدث خطأ. أعد المحاولة من البداية." });
        delete userStates[sender];
        break;
    }
  });
}

startBot();
