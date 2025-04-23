// سكربت Puppeteer لتجاوز تحقق الكاميرا باستخدام فيديو OBS
const puppeteer = require("puppeteer");
const fs = require("fs");
const notifier = require("./notifier");
const COOKIE_PATH = "./cookies.json";

const URL = "https://bls.mfa.dz/book-appointment"; // عدل هذا حسب المرحلة الفعلية

async function saveSessionCookies(page) {
  const cookies = await page.cookies();
  fs.writeFileSync(COOKIE_PATH, JSON.stringify(cookies, null, 2));
}

async function loadSessionCookies(page) {
  if (fs.existsSync(COOKIE_PATH)) {
    const cookies = JSON.parse(fs.readFileSync(COOKIE_PATH));
    await page.setCookie(...cookies);
  }
}

async function simulateFaceVerification() {
  const browser = await puppeteer.launch({
    headless: false,
    args: [
      '--use-fake-ui-for-media-stream',
      '--use-fake-device-for-media-stream',
      '--allow-file-access-from-files',
      '--no-sandbox',
      '--disable-setuid-sandbox'
    ]
  });

  const page = await browser.newPage();
  await loadSessionCookies(page);
  await page.goto(URL, { waitUntil: "networkidle2" });

  if (!fs.existsSync(COOKIE_PATH)) {
    console.log("🔐 سجل الدخول يدويًا واحفظ الجلسة...");
    await page.waitForTimeout(60000);
    await saveSessionCookies(page);
    console.log("✅ تم حفظ الجلسة.");
  }

  console.log("📷 بدء محاولة التحقق بالكاميرا...");

  // انتظر زر بدء التحقق (حسب الزر في موقع BLS)
  try {
    await page.waitForSelector("button.start-verification", { timeout: 20000 });
    await page.click("button.start-verification");
    console.log("✅ تم الضغط على زر التحقق.");
  } catch (err) {
    console.log("❌ لم يتم العثور على زر التحقق. تأكد من أنك في الصفحة الصحيحة.");
    await browser.close();
    return;
  }

  // انتظر قليلًا لتشغيل OBS
  await page.waitForTimeout(15000); // 15 ثانية انتظار للبث من OBS

  await notifier.sendWhatsApp("🎥 تم تشغيل التحقق بالفيديو تلقائيًا على موقع BLS.");

  console.log("⌛ جارٍ تشغيل بث الفيديو...");
  await page.waitForTimeout(20000); // مزيد من الوقت لضمان انتهاء التحقق

  await browser.close();
}

simulateFaceVerification();
