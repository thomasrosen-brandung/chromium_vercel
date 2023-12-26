// import { openWebpage } from "@/lib/openWebpage";
import dotenv from 'dotenv';
import OpenAI from 'openai';
import { openWebpage } from "./src/lib/openWebpage.mjs";


dotenv.config({ path: './.env.local' })

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })

function linksFromMarkdown({ markdown }) {
  const links = []

  const url_regex = /\[(.*?)\]\((.*?)\)/g;
  let matches;
  while ((matches = url_regex.exec(markdown)) !== null) {
    // This is necessary to avoid infinite loops with zero-width matches
    if (matches.index === url_regex.lastIndex) {
      url_regex.lastIndex++;
    }

    const [, linkText, linkUrl] = matches;
    links.push({ title: linkText, url: linkUrl })
  }

  return links
}

function shuffle(array) {
  let currentIndex = array.length, randomIndex;

  // While there remain elements to shuffle.
  while (currentIndex > 0) {

    // Pick a remaining element.
    randomIndex = Math.floor(Math.random() * currentIndex);
    currentIndex--;

    // And swap it with the current element.
    [array[currentIndex], array[randomIndex]] = [
      array[randomIndex], array[currentIndex]];
  }

  return array;
}

/*

1. Überleg was du suchen möchtest.

2. Passe die Frage so an, dass sie in die Suchmaschine passt.
3. Geb das in die Suchmaschine ein.
-> url aufrufen + inhalt an gpt geben

4. überleg welche links passen könnten.
5. schau den inhalt der links an.
-> url aufrufen + inhalt an gpt geben

6. entscheide ob mit allen inforationen die frage beantwortet werden kann.
7. wenn ja, gib die antwort aus.
8. wenn nein, geh zu schritt 2.

*/

const system_prompt = `
The current date is: _CURRENT_DATE_
The curent location is: _CURRENT_LOCATION_

You are a web crawler. You help the user navigate the internet and find information. You are realy good at it. You can find the answer to almost any question.
The user will input a question. You will find the answer.

Proceed with the following steps to find the answer. Between each step, the user will respond with the results of the previous step.

THE STEPS:
Step 1:
Rephrase the question so that it fits into a search engine like Google. Keep it concise.
Generate betwen one and five possible queries. Run the function "search_the_web" with all of the queries.
The function also expects a list of sources. Here are the options:
- "wikipedia.org" (for general knowledge)
- "www.cia.gov/the-world-factbook/" (for general knowledge)
- "tageschau.de" (for german news)
- "taz.de" (for german news)
- "nextjs.org/docs/app/" (for programming nextjs-react)
- "tailwindcss.com" (for programming tailwind-css)
- "developer.mozilla.org" (for programming javascript)
- You can decide on possible sources yourself. Just make sure that the sources are relevant to the question.

Step 2:
You got a list of urls that match the queries. Choose between 3 and 10 links that should be opened. You will get the content of them. Run the function "get_webpage_content" for each url. Run multiple function-calls in parallel.

Step 3:
Decide if the question can be answered with the content of the urls. If yes, go to step FOUR If no, go to step ONE.

Step 4:
WRITE A SMALL ARTICLE to answer the question. Easeliy readable. The answer must be in markdown. Include markdown-footnotes to where you found the parts of the article. The first paragraph should answer the question. Then continue with more info. WRITE AT LEAST 3 PARAGRAPHS. Respond in json exactly like this: { answer: 'The answer to the question.' } ONLY ONE OBJECT WITH ONE ANSWER. If you have multiple answers, combine them into one.

Example answer in markdown with footnotes:
Die Hauptstadt von England ist **London**.

London ist sowohl die Hauptstadt des Vereinigten Königreiches als auch Englands[1^]. Es liegt an der Themse im Südosten Englands und bildet das Zentrum von Greater London, das im Jahr 1965 gegründet wurde. London ist eine der wichtigsten Städte der Welt und ein bedeutendes Kultur-, Finanz- und Handelszentrum.[2^] Die Stadt geschichtlich betrachtet hat eine weitreichende Vergangenheit, die bis in die römischen Zeiten zurückreicht; im Jahr 50 n. Chr. wurde sie von den Römern als Londinium gegründet.

Nach der normannischen Eroberung im Jahr 1066 wurde London zur Hauptstadt und zum königlichen Sitz. Im Laufe der Jahrhunderte wuchs London zu einer Weltstadt heran, und **im Jahr 2021 lebten etwa 8,8 Millionen Menschen** innerhalb seiner Grenzen und ungefähr 14,4 Millionen in der gesamten Metropolregion[1^].

[1^]: https://domain.tld/one
[2^]: https://domain.tld/two

END of example answer.

SO EACH STEP ON ITS OWN. RESPOND BETWEEN EACH STEP.
`

// Respond in json: { urls: ['https://www.example.com', 'https://www.example.com/another-page'] }

const tools = [
  {
    type: "function",
    function: {
      name: "search_the_web",
      description: "Search for a list of urls that match the query.",
      parameters: {
        type: "object",
        properties: {
          queries: {
            type: "array",
            items: {
              type: "string"
            },
            description: "The queries to search for.",
          },
          sources: {
            type: "array",
            items: {
              type: "string"
            },
            description: "Sources that could have the answer.",
          },
        },
        required: ["urls"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "get_webpage_content",
      description: "Get the current content of a url in markdown format.",
      parameters: {
        type: "object",
        properties: {
          url: {
            type: "string",
            description: "The url to get the content from.",
          },
        },
        required: ["url"],
      },
    },
  },
];

const tool_callbacks = {
  search_the_web: async ({ set_state, queries, sources }) => {
    set_state(state => {
      const key = 'queries'
      if (!state.hasOwnProperty(key)) {
        state[key] = []
      }
      state[key].push(...queries)
      return state
    })

    const LINKS_PER_PAGE = 10
    const MAX_PAGES = 1 // 1 = only NO_SOURCE

    let found_entries = []
    const found_urls = []

    const NO_SOURCE = 'NO_SOURCE'
    sources.unshift(NO_SOURCE) // add a source that searches the whole web at the start

    const urls_to_open = []
    for (const source of sources) {
      for (const query of queries) {
        const full_query = (
          source === NO_SOURCE
            ? query
            : `site:${source} ${query}`
        )
        const url = `https://duckduckgo.com/?q=${encodeURIComponent(full_query)}`
        urls_to_open.push(url)
      }
    }

    // limit urls_to_open to MAX_PAGES
    urls_to_open.splice(MAX_PAGES)


    // get the search results

    const get_markdown_promises = urls_to_open
      .map(async (url) => {
        const { markdown } = await openWebpage({ url })
        return markdown;
      });

    const array_of_markdown = await Promise.all(get_markdown_promises);



    for (const markdown of array_of_markdown) {
      const links = linksFromMarkdown({ markdown })
        .filter((link) => link.title.length > 0 && link.url.startsWith('http')) // only keep links that have a title and start with http
        .filter((link) => !found_urls.includes(link.url)) // only keep links that are not already in found_urls
        .filter((link, index) => index < LINKS_PER_PAGE) // only keep the first X links

      found_urls.push(...links.map(link => link.url))
      found_entries.push(...links)
    }

    found_entries = shuffle(found_entries)

    const found_entries_text = found_entries
      .map((entry, index) => `[${entry.title}](${entry.url})`)
      .join('\n')

    return found_entries_text
  },
  get_webpage_content: async ({ set_state, url }) => {
    set_state(state => {
      const key = 'considered_websites'
      if (!state.hasOwnProperty(key)) {
        state[key] = []
      }
      state[key].push(url)
      return state
    })

    const { plain } = await openWebpage({ url })

    // only keep the first X letters
    const content_less = plain
      .replace(/[\n\s]+/g, ' ') // remove newlines
      .replace(/-+/g, '-')
      .slice(0, 2000)

    return content_less
  }
}

async function call_gpt(state) {

  const {
    messages,
    counter = 0
  } = state || {}

  function set_state(set_metadata_function) {
    state = set_metadata_function(state)
    // const keys = Object.keys(metadata)
    // for (const key of keys) {
    //   if (!state.hasOwnProperty(key)) {
    //     state[key] = []
    //   }
    //   state[key].push(...metadata[key])
    // }
  }

  if (counter > 5) {
    // prevent infinite loops
    return state
  }

  const fast_model = 'gpt-3.5-turbo-1106'
  const better_model = 'gpt-4-1106-preview'

  const chatCompletion = await openai.chat.completions.create({
    messages,
    model: counter < 2 ? fast_model : better_model,
    response_format: { type: 'json_object' },
    seed: 42,
    tools,
    tool_choice: 'auto', // auto is default, but we'll be explicit
  });

  const new_messages = chatCompletion.choices.map(choice => choice.message)
  console.log('new_messages', JSON.stringify(new_messages, null, 2))
  state.messages.push(...new_messages)

  // if the newest message contains tool calls from the assistant. run them and add the response to the messages array
  const last_message = new_messages[new_messages.length - 1]
  if (last_message.hasOwnProperty('tool_calls')) {
    const tool_call_promises = last_message.tool_calls
      .map(async (tool_call) => {
        const tool_call_id = tool_call.id;
        const function_name = tool_call.function.name;

        const parameters = JSON.parse(tool_call.function.arguments);
        parameters.set_state = set_state
        const function_response = await tool_callbacks[function_name](parameters);

        return {
          tool_call_id,
          role: 'tool',
          name: function_name,
          content: function_response,
        };
      });

    const tool_messages = await Promise.all(tool_call_promises);
    state.messages.push(...tool_messages)

    const new_state = await call_gpt({
      ...state,
      counter: counter + 1,
    })

    return new_state
  }

  return state
}

export async function queryGpt({ question }) {

  let this_system_prompt = system_prompt
    .replace('_CURRENT_DATE_', new Date().toISOString())
    .replace('_CURRENT_LOCATION_', 'Bonn, Germany')
    .trim()

  const { messages, queries, considered_websites } = await call_gpt({
    messages: [
      {
        role: 'system',
        content: this_system_prompt,
      },
      { role: "user", content: question },
    ]
  })

  // get the last message
  const last_message = messages[messages.length - 1]

  // get the answer from the last message
  let answer = last_message.content
  try {
    const parsedContent = JSON.parse(last_message.content)
    answer = parsedContent.answer
  } catch (error) {
    console.error('error parsing last message', error)
  }

  // return the answer
  return {
    answer,
    queries,
    considered_websites,
  }
}


async function main() {
  const question = 'Wo kann man morgen gut in der Bonner Umgebung wandern gehen?'
  console.log(`\n\nquestion:\n\n${question}\n\n`)

  const answer = await queryGpt({ question })
  // console.log(`answer JSON:\n\n${JSON.stringify(answer, null, 2)}\n\n`)
  console.log(`answer TEXT:\n\n${answer.answer}\n\n`)
}
main()
