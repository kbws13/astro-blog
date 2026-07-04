import type { AstroGlobal } from 'astro'
import rss from '@astrojs/rss'
import rehypeStringify from 'rehype-stringify'
import remarkParse from 'remark-parse'
import remarkRehype from 'remark-rehype'
import { unified } from 'unified'

import config from '@/site-config'
import { getPageContent, getPosts } from '@/lib/content-source'

const renderContent = async (source: string) => {
  const markdown = await getPageContent(source)
  const file = await unified().use(remarkParse).use(remarkRehype).use(rehypeStringify).process(markdown)
  return String(file)
}

const GET = async (context: AstroGlobal) => {
  const allPostsByDate = (await getPosts())
    .filter((post) => post.lang === 'zh')
    .sort((a, b) => b.date.valueOf() - a.date.valueOf())

  return rss({
    trailingSlash: false,
    xmlns: { h: 'http://www.w3.org/TR/html4/' },
    stylesheet: '/scripts/pretty-feed-v3.xsl',
    title: config.title,
    description: config.description || 'A blog built with Astro',
    site: context.site ?? import.meta.env.SITE,
    items: await Promise.all(
      allPostsByDate.map(async (post) => ({
        title: post.title,
        pubDate: post.date,
        link: `/blog/${post.slug}`,
        content: await renderContent(post.source)
      }))
    )
  })
}

export { GET }
