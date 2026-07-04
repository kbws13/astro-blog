import type { MarkdownHeading } from 'astro'
import type { Root } from 'mdast'
import rehypeKatex from 'rehype-katex'
import rehypeStringify from 'rehype-stringify'
import remarkGfm from 'remark-gfm'
import remarkMath from 'remark-math'
import remarkParse from 'remark-parse'
import remarkRehype from 'remark-rehype'
import { unified } from 'unified'
import { visit } from 'unist-util-visit'

import mdastToString from '@/utils/mdast-util-to-string'

export function slugifyHeading(text: string): string {
  return text
    .trim()
    .toLowerCase()
    .replace(/[`~!@#$%^&*()+=[\]{}|\\:;"'<>,.?/]/g, '')
    .replace(/\s+/g, '-')
}

export function getDescriptionFromMarkdown(markdown: string, fallback: string): string {
  const normalized = markdown
    .replace(/!\[[^\]]*]\([^)]+\)/g, '')
    .replace(/\[([^\]]+)]\([^)]+\)/g, '$1')
    .replace(/[#>*_`~-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()

  return normalized.slice(0, 160) || fallback
}

export async function renderContentMarkdown(markdown: string): Promise<{
  html: string
  headings: MarkdownHeading[]
}> {
  const headings: MarkdownHeading[] = []

  const file = await unified()
    .use(remarkParse)
    .use(remarkGfm)
    .use(remarkMath)
    .use(() => {
      return (tree: Root) => {
        visit(tree, 'heading', (node) => {
          const text = mdastToString(node, { includeHtml: false }).trim()
          if (!text) return

          const slug = slugifyHeading(text)
          node.data = {
            ...(node.data || {}),
            hProperties: {
              ...((node.data && node.data.hProperties) || {}),
              id: slug
            }
          }

          headings.push({
            depth: node.depth,
            slug,
            text
          })
        })
      }
    })
    .use(remarkRehype)
    .use(rehypeKatex)
    .use(rehypeStringify)
    .process(markdown)

  return {
    html: String(file),
    headings
  }
}
