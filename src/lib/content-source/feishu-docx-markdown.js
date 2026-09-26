const CODE_LANGUAGE_BY_ID = {
  1: '',
  7: 'sh',
  30: 'js'
}

function renderTextElements(elements = []) {
  return elements
    .map((element) => {
      const run = element.text_run
      if (!run?.content) return ''

      let content = run.content
      const style = run.text_element_style
      if (style?.inline_code) content = `\`${content}\``
      if (style?.bold) content = `**${content}**`
      if (style?.italic) content = `_${content}_`
      if (style?.link?.url) content = `[${content}](${style.link.url})`
      return content
    })
    .join('')
}

function renderPlainTextElements(elements = []) {
  return elements.map((element) => element.text_run?.content || '').join('')
}

function getCodeLanguage(code = {}) {
  const language = code.language ?? code.style?.language
  if (typeof language === 'string') return language
  return CODE_LANGUAGE_BY_ID[language] ?? ''
}

function getCodeFence(content) {
  const matches = content.match(/`+/g) || []
  const maxLength = matches.reduce((max, match) => Math.max(max, match.length), 2)
  return '`'.repeat(maxLength + 1)
}

async function renderChildren(block, options) {
  if (!block.childrenBlocks?.length) return ''
  return docxBlocksToMarkdown(block.childrenBlocks, options)
}

function escapeTableCell(markdown) {
  return markdown
    .replace(/\|/g, '\\|')
    .replace(/\n+/g, '<br>')
    .trim()
}

// The docx API may return `cells` either as a row-major 2D matrix or as a flat
// block-id list sized row_size * column_size; normalize both to a matrix.
function getCellMatrix(table) {
  const cells = table?.cells
  if (!Array.isArray(cells) || !cells.length) return []

  if (Array.isArray(cells[0])) return cells

  const columnSize = Number(table.property?.column_size)
  if (!Number.isInteger(columnSize) || columnSize < 1) return cells.map((id) => [id])

  const matrix = []
  for (let index = 0; index < cells.length; index += columnSize) {
    matrix.push(cells.slice(index, index + columnSize))
  }
  return matrix
}

async function renderTable(block, options) {
  const cellMatrix = getCellMatrix(block.table)
  if (!cellMatrix.length) return ''

  const cellBlocksById = new Map()
  for (const child of block.childrenBlocks || []) {
    if (child.block_id) cellBlocksById.set(child.block_id, child)
  }

  const rows = []
  for (const row of cellMatrix) {
    const renderedCells = []
    for (const cellId of row) {
      const cellBlock = cellBlocksById.get(cellId)
      const markdown = cellBlock ? await renderChildren(cellBlock, options) : ''
      renderedCells.push(escapeTableCell(markdown || ''))
    }
    if (renderedCells.length) rows.push(renderedCells)
  }
  if (!rows.length) return ''

  const columnCount = Math.max(...rows.map((row) => row.length))
  const normalizedRows = rows.map((row) => {
    const padded = [...row]
    while (padded.length < columnCount) padded.push('')
    return padded
  })

  const [headerRow, ...bodyRows] = normalizedRows
  return [
    `| ${headerRow.join(' | ')} |`,
    `| ${Array.from({ length: columnCount }, () => '---').join(' | ')} |`,
    ...bodyRows.map((row) => `| ${row.join(' | ')} |`)
  ].join('\n')
}

async function blockToMarkdown(block, options = {}) {
  const type = block.block_type

  if (type === 2) return renderTextElements(block.text?.elements)
  if (type === 3) return `# ${renderTextElements(block.heading1?.elements)}`
  if (type === 4) return `## ${renderTextElements(block.heading2?.elements)}`
  if (type === 5) return `### ${renderTextElements(block.heading3?.elements)}`
  if (type === 6) return `#### ${renderTextElements(block.heading4?.elements)}`
  if (type === 7) return `##### ${renderTextElements(block.heading5?.elements)}`
  if (type === 8) return `###### ${renderTextElements(block.heading6?.elements)}`

  if (type === 12) {
    const nested = await renderChildren(block, options)
    const current = `- ${renderTextElements(block.bullet?.elements)}`
    return nested ? `${current}\n${nested}` : current
  }

  if (type === 13) {
    const nested = await renderChildren(block, options)
    const current = `1. ${renderTextElements(block.ordered?.elements)}`
    return nested ? `${current}\n${nested}` : current
  }

  if ((type === 14 || type === 15) && block.code) {
    const content = renderPlainTextElements(block.code.elements)
    const fence = getCodeFence(content)
    const language = getCodeLanguage(block.code)
    return `${fence}${language}\n${content}\n${fence}`
  }

  if (type === 27 && block.image?.token && options.resolveImage) {
    const src = await options.resolveImage(block.image)
    return src ? `![Feishu image](${src})` : ''
  }

  if (type === 31 && block.table) {
    return renderTable(block, options)
  }

  if (type === 34) {
    const children = await renderChildren(block, options)
    if (!children) return ''
    return children
      .split('\n')
      .map((line) => (line ? `> ${line}` : '>'))
      .join('\n')
  }

  return renderChildren(block, options)
}

export async function docxBlocksToMarkdown(blocks, options = {}) {
  const chunks = []
  for (const block of blocks) {
    const markdown = await blockToMarkdown(block, options)
    if (markdown) chunks.push(markdown)
  }
  return chunks.join('\n\n')
}
