const puppeteer = require("puppeteer");
const fs = require("fs");
const notifier = require("./notifier"); // سكربت إرسال إشعار واتساب
const COOKIE_PATH = "./cookies.json";
const URL = "https://algeria.blsspainglobal.com/DZA/Appointment/NewAppointment?msg=qnKMqLIZTZAdouE2krw1tEf61eIzq9pfKRwrmoKqQbx8UJlNzqzt3ksy9Gl9bso7&d=d2c6EB8KeIjlggVpwafNFSFeNfkFm587b0OTsdiG%2FZIZzChnI0ufv42rccJsUtfN%2BejMeHx6%2F%2Bc4tvy%2BaqTcUZuJDebCYpinxB%2Bn1PeRbZ9Z9DQWMfD2ARM0Qe32a53cFG64%2BJCfC5okD4rqpUi%2FlFfUG0hyEh%2BI4rmrvRaytKMUlo6jy3LGXK0WY8mKfiREa6EH1yARcOIPtQUv9AqOj87RkadmOzz6kPnnKCbTkFOc%2FJUYOmLBVGsrX4n6L49fHjBW8xcWWNOGL5cMEUnqqRMHj7Lo2g7aAdS5MxOlb7ZXfDg%2FWk54QRz8r1Atccnn"; // ضع الرابط الكامل هنا

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

async function checkAppointments() {
  const browser = await puppeteer.launch({ headless: false });
  const page = await browser.newPage();

  await loadSessionCookies(page);
  await page.goto(URL, { waitUntil: "networkidle2" });

  await page.waitForTimeout(3000);

  if (!fs.existsSync(COOKIE_PATH)) {
    console.log("🔐 من فضلك سجل دخولك يدويًا الآن...");
    await page.waitForTimeout(60000);
    await saveSessionCookies(page);
    console.log("✅ تم حفظ الجلسة.");
  }

  const greenDaySelector = ".table td[style*='background-color: green']";
  const greenDay = await page.$(greenDaySelector);

  if (greenDay) {
    console.log("✅ تم العثور على موعد");

    await greenDay.click();
    await page.waitForTimeout(1000);

    const randomDays = Math.floor(Math.random() * 21) + 10;
    await page.type("input[name='stay_duration']", randomDays.toString());
    await page.click("button[type='submit']");

    await notifier.sendWhatsApp(`✅ تم الحجز ليوم متاح.\n📞 أرسل رقم الهاتف الذي سجلت به الفيديو بكتابة: "فيديو" ثم إرسال الرقم.`);
  } else {
    console.log("❌ لا توجد أيام خضراء حالياً.");
  }

  await browser.close();
}

setInterval(checkAppointments, 10000);
