import assert from 'node:assert/strict'
import test from 'node:test'
import rehypeStringify from 'rehype-stringify'
import remarkGfm from 'remark-gfm'
import remarkParse from 'remark-parse'
import remarkRehype from 'remark-rehype'
import { unified } from 'unified'

import { docxBlocksToMarkdown } from '../src/lib/content-source/feishu-docx-markdown.js'

test('renders embedded Feishu sheets as HTML tables with literal cell text', async () => {
  const markdown = await docxBlocksToMarkdown(
    [{ block_type: 30, sheet: { token: 'spreadsheet_sheet' } }],
    {
      resolveSheet: async (sheet) => {
        assert.equal(sheet.token, 'spreadsheet_sheet')
        return [
          ['方 法', '描 述'],
          ['filter(Predicate<T> p)', '接收 Lambda，从流中排除某些元素'],
          ['skip(long n)', '跳过前 n 个元素。\n与 limit(n) 互补'],
          ['a | b', '*literal* _name_ `code`'],
          [0, false],
          ['没有描述']
        ]
      }
    }
  )

  const html = String(await unified()
    .use(remarkParse)
    .use(remarkGfm)
    .use(remarkRehype)
    .use(rehypeStringify)
    .process(markdown))

  assert.ok(html.includes('<table>'))
  assert.ok(html.includes('<th>方 法</th>'))
  assert.ok(html.includes('<td>filter(Predicate&#x3C;T> p)</td>'))
  assert.ok(html.includes('<td>跳过前 n 个元素。 与 limit(n) 互补</td>'))
  assert.ok(html.includes('<td>a | b</td>'))
  assert.ok(html.includes('<td>*literal* _name_ `code`</td>'))
  assert.ok(html.includes('<td>0</td>'))
  assert.ok(html.includes('<td>false</td>'))
  assert.equal((html.match(/<td>/g) || []).length, 10)
})

test('empty embedded sheets produce no table', async () => {
  assert.equal(await docxBlocksToMarkdown(
    [{ block_type: 30, sheet: { token: 'spreadsheet_sheet' } }],
    { resolveSheet: async () => [] }
  ), '')
})

test('native Docx tables keep their cell order and inline formatting', async () => {
  const cells = ['a', 'b', 'c', 'd']
  const markdown = await docxBlocksToMarkdown([{
    block_type: 31,
    table: { cells, property: { column_size: 2 } },
    childrenBlocks: cells.map((id) => ({
      block_id: id,
      block_type: 32,
      childrenBlocks: [{
        block_type: 2,
        text: { elements: [{ text_run: { content: id, text_element_style: { inline_code: true } } }] }
      }]
    }))
  }])
  assert.equal(markdown, '| `a` | `b` |\n| --- | --- |\n| `c` | `d` |')
})
