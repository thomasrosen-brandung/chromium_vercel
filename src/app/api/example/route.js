import chromium from "@sparticuz/chromium-min";
import puppeteer from "puppeteer-core";

import { simplifyHtml } from "./simplifyHtml";
// import { queryGpt } from "./queryGpt";

const IS_LOCAL = process.env.VERCEL_ENV === 'development';
const LOCAL_CHROMIUM_PATH = process.env.LOCAL_CHROMIUM_PATH;

// Optional: If you'd like to use the legacy headless mode. "new" is the default.
chromium.setHeadlessMode = true;

// Optional: If you'd like to disable webgl, true is the default.
chromium.setGraphicsMode = false;



export async function GET(req, res) {

  // // get get params
  // const { url, q } = req?.query

  // if (typeof url !== 'string' || url.length === 0) {
  //   return Response.json({
  //     error: 'no url in get (?url=x)'
  //   }, 400)
  // }

  // if (typeof q !== 'string' || q.length === 0) {
  //   return Response.json({
  //     error: 'no question in get (?q=x)'
  //   }, 400)
  // }

  const url = 'https://www.example.com'

  try {
    const response_data = {}

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

    await page.goto(url, { waitUntil: "networkidle0" });

    console.log("Chromium:", await browser.version());
    console.log("Page Title:", await page.title());

    response_data.url = await page.url();
    response_data.chromium = await browser.version();
    response_data.title = await page.title();

    const html_text = await simplifyHtml(page);
    response_data.html_text = html_text;

    await browser.close();

    return Response.json(response_data)
  } catch (error) {
    console.log('error', error)
    return Response.json({ error }, 500)
  }

}

