import assert from 'node:assert/strict'
import test from 'node:test'

import { docxBlocksToMarkdown } from '../src/lib/content-source/feishu-docx-markdown.js'

test('renders Feishu code blocks as fenced Markdown without inline formatting', async () => {
  const markdown = await docxBlocksToMarkdown([
    {
      block_type: 14,
      code: {
        elements: [
          { text_run: { content: 'function log(' } },
          { text_run: { content: 'title', text_element_style: { italic: true } } },
          { text_run: { content: ') {\n  console.log(title)\n}' } }
        ],
        style: { language: 30 }
      }
    }
  ])

  assert.equal(markdown, '```js\nfunction log(title) {\n  console.log(title)\n}\n```')
})

test('renders Feishu image blocks through the provided media resolver', async () => {
  const markdown = await docxBlocksToMarkdown(
    [
      {
        block_type: 27,
        image: {
          token: 'Jlbobt0Doohc48xYht3cJp0hnpd',
          width: 1818,
          height: 1068
        }
      }
    ],
    {
      resolveImage: async (image) => `/feishu-assets/${image.token}.png`
    }
  )

  assert.equal(markdown, '![Feishu image](/feishu-assets/Jlbobt0Doohc48xYht3cJp0hnpd.png)')
})
