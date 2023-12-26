import { Readability } from '@mozilla/readability';
import { JSDOM } from 'jsdom';
import { NodeHtmlMarkdown } from 'node-html-markdown';

export async function simplifyHtml({ html, url }) {
  const doc = new JSDOM(html, { url })
  let reader = new Readability(doc.window.document);
  reader.FLAG_STRIP_UNLIKELYS = false // it strips some a-tags otherwise

  const article = reader.parse();

  let articleHtmlContent = ''
  let articleTextContent = ''

  if (!article) {
    articleHtmlContent = html
    articleTextContent = doc.window.document.body.textContent
  } else {
    if (article.textContent) {
      articleTextContent = article.textContent
    }
    if (article.content) {
      articleHtmlContent = article.content
    }
  }

  let markdown = NodeHtmlMarkdown.translate(articleHtmlContent)
  markdown = markdown.split('_X_') // remove extra fields at the end
  markdown = markdown[0].trim()

  return {
    markdown,
    plain: articleTextContent,
  }
}
