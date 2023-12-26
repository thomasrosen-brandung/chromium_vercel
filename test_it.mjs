import dotenv from 'dotenv';

import chromium from "@sparticuz/chromium-min";
import puppeteer from "puppeteer-core";

dotenv.config({ path: './.env.local' })

const IS_LOCAL = process.env.VERCEL_ENV === 'development';
const LOCAL_CHROMIUM_PATH = process.env.LOCAL_CHROMIUM_PATH;

// Optional: If you'd like to use the legacy headless mode. "new" is the default.
chromium.setHeadlessMode = true;

// Optional: If you'd like to disable webgl, true is the default.
chromium.setGraphicsMode = false;

(async () => {

  // Optional: Load any fonts you need. Open Sans is included by default in AWS Lambda instances
  // await chromium.font(
  //   "https://raw.githack.com/googlei18n/noto-emoji/master/fonts/NotoColorEmoji.ttf"
  // );

  const browser = await puppeteer.launch({
    args: chromium.args,
    defaultViewport: chromium.defaultViewport,
    executablePath: IS_LOCAL
      ? process.env.LOCAL_CHROMIUM_PATH
      : await chromium.executablePath("https://github.com/Sparticuz/chromium/releases/download/v119.0.2/chromium-v119.0.2-pack.tar"),
    headless: IS_LOCAL ? false : chromium.headless,
    ignoreHTTPSErrors: true,
  });

  const page = await browser.newPage();

  await page.goto("https://www.example.com", { waitUntil: "networkidle0" });

  await browser.close();

})();
