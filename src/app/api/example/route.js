// import { queryGpt } from "./queryGpt";

import { openWebpage } from "@/lib/openWebpage";

export async function GET(req, res) {

  // get the get-params
  const { searchParams } = new URL(req.url)
  const url = searchParams.get('url')

  console.log('url', url)

  // const q = searchParams.get('q')

  if (typeof url !== 'string' || url.length === 0) {
    return Response.json({
      error: 'no url in get (?url=x)'
    }, 400)
  }

  // if (typeof q !== 'string' || q.length === 0) {
  //   return Response.json({
  //     error: 'no question in get (?q=x)'
  //   }, 400)
  // }

  // const url = 'https://www.example.com'

  try {
    const response_data = await openWebpage(url)

    return new Response(response_data.markdown, {
      status: 200,
      headers: {
        'content-type': 'text/html;charset=UTF-8',
      },
    })

    // return Response.json(response_data)
  } catch (error) {
    console.error('error', error)
    return Response.json({ error }, 500)
  }

}

