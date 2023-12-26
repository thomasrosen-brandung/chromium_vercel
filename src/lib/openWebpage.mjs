import dotenv from 'dotenv'

import chromium from "@sparticuz/chromium-min"
import puppeteer from "puppeteer-core"
import { simplifyHtml } from "./simplifyHtml.mjs"
// import puppeteer from "puppeteer-extra";

dotenv.config({ path: './.env.local' })

const IS_LOCAL = true // process.env.VERCEL_ENV === 'development'
const LOCAL_CHROMIUM_PATH = process.env.LOCAL_CHROMIUM_PATH

// Optional: If you'd like to use the legacy headless mode. "new" is the default.
chromium.setHeadlessMode = true

// Optional: If you'd like to disable webgl, true is the default.
chromium.setGraphicsMode = false

export async function openWebpage({ url }) {
  console.log('openWebpage', url)
  const response_data = {}

  // Optional: Load any fonts you need. Open Sans is included by default in AWS Lambda instances
  // await chromium.font(
  //   "https://raw.githack.com/googlei18n/noto-emoji/master/fonts/NotoColorEmoji.ttf"
  // );

  // const browser = await puppeteer.launch({
  //   args: chromium.args,
  //   defaultViewport: chromium.defaultViewport,
  //   executablePath: IS_LOCAL
  //     ? LOCAL_CHROMIUM_PATH
  //     : await chromium.executablePath("https://github.com/Sparticuz/chromium/releases/download/v119.0.2/chromium-v119.0.2-pack.tar"),
  //   headless: IS_LOCAL ? false : chromium.headless,
  //   ignoreHTTPSErrors: true,
  // });

  const browser = await puppeteer.launch({
    defaultViewport: chromium.defaultViewport,
    executablePath: IS_LOCAL
      ? LOCAL_CHROMIUM_PATH
      : await chromium.executablePath("https://github.com/Sparticuz/chromium/releases/download/v119.0.2/chromium-v119.0.2-pack.tar"),
    headless: IS_LOCAL ? false : chromium.headless,
    ignoreHTTPSErrors: true,
    args: [...chromium.args, "--incognito", "--no-sandbox"]
  })



  const page = await browser.newPage()

  // Add Headers to fool the website into thinking we're a real browser
  // source: https://www.zenrows.com/blog/puppeteer-avoid-detection#headers
  await page.setExtraHTTPHeaders({
    'user-agent': 'Mozilla/5.0 (Windows NT 10.0; WOW64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/108.0.0.0 Safari/537.36',
    'upgrade-insecure-requests': '1',
    'accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
    'accept-encoding': 'gzip, deflate, br',
    'accept-language': 'en-US,en;q=0.9,en;q=0.8'
  })

  // Limit requests
  // source: https://www.zenrows.com/blog/puppeteer-avoid-detection#headers
  await page.setRequestInterception(true);
  page.on('request', async (request) => {
    if (request.resourceType() == 'image') {
      // do not load images
      await request.abort();
    } else {
      await request.continue();
    }
  });

  if (url.includes('duckduckgo.com')) {
    // set cookies for duckduckgo to not show ads
    const duckduckgo_cookies = 'z=-1; 1=-1; v=-1; ak=-1; ax=-1; aq=-1; ap=-1; ao=-1; au=-1'
      .split(';')
      .map(cookie => {
        const [name, value] = cookie.trim().split('=')
        return { name, value, domain: '.duckduckgo.com' }
      })

    await page.setCookie(...duckduckgo_cookies)
  }

  // navigate to the page
  await page.goto(url, { waitUntil: "domcontentloaded" })

  // wait for 200 milliseconds
  await new Promise(resolve => setTimeout(resolve, 200))

  const current_url = await page.url()
  response_data.url = current_url
  // response_data.chromium = await browser.version();
  response_data.title = await page.title()

  const html = await page.content(page)
  const {
    markdown,
    plain,
  } = await simplifyHtml({ html, url: current_url })

  response_data.markdown = markdown
  response_data.plain = plain

  await browser.close()

  return response_data
}
