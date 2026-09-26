import type { Element, Root, Text } from 'hast'
import { codeToHast, type ShikiTransformer } from 'shiki'
import { visit } from 'unist-util-visit'

import {
  addCopyButton,
  addLanguage,
  addTitle,
  transformerNotationDiff,
  transformerNotationHighlight,
  updateStyle
} from './shiki-transformers'

function extractText(code: Element): string {
  let text = ''
  for (const child of code.children) {
    if (child.type === 'text') text += (child as Text).value
  }
  // markdown 代码块末尾的换行是语法产物，去掉以避免多余的空白行
  return text.replace(/\n$/, '')
}

function extractLang(code: Element): string {
  const className = code.properties?.className
  const classes = Array.isArray(className) ? className : className ? [className] : []
  for (const cls of classes) {
    if (typeof cls === 'string' && cls.startsWith('language-')) {
      return cls.slice('language-'.length)
    }
  }
  return ''
}

// 与 @astrojs/markdown-remark 的 shiki 集成保持一致：把 shiki 生成的 class 中的
// `shiki` 替换为 `astro-code`，让 public/styles/global.css 里绑定在 .astro-code 上的
// 代码块样式（背景、行号、复制按钮的 hover 显示等）生效。
function addAstroCodeClass(): ShikiTransformer {
  return {
    name: 'shiki-transformer-astro-code',
    pre(node) {
      // shiki 的 pre hook 里 properties 用的是 HTML 属性名（`class`），而非 hast 的
      // camelCase（`className`），与 @astrojs/markdown-remark 的 shiki 集成保持一致。
      const props = node.properties as unknown as Record<string, string | string[] | undefined>
      const classValue = props.class
      const str = Array.isArray(classValue)
        ? classValue.join(' ')
        : typeof classValue === 'string'
          ? classValue
          : ''
      props.class = str.replace(/shiki/g, 'astro-code')
    }
  }
}

// 手动 unified 管道绕过了 Astro 的 shikiConfig，导致飞书内容渲染出的
// 代码块没有语法高亮和一键复制。这里复用 shiki 的 codeToHast 与 astro.config.mjs
// 里相同的 transformers，使代码块与原生 .md 内容拥有一致的表现。
export function rehypeShikiHighlight() {
  const transformers = [
    addAstroCodeClass(),
    transformerNotationDiff(),
    transformerNotationHighlight(),
    updateStyle(),
    addTitle(),
    addLanguage(),
    addCopyButton(2000)
  ]

  return async (tree: Root) => {
    const targets: { parent: Root | Element; pre: Element }[] = []

    visit(tree, 'element', (node, index, parent) => {
      if (node.tagName !== 'pre' || index === undefined || !parent) return
      const hasCode = node.children.some(
        (child) => child.type === 'element' && child.tagName === 'code'
      )
      if (hasCode) targets.push({ parent: parent as Root | Element, pre: node })
    })

    // 从后往前替换，避免前面的 splice 改变后面节点的 index
    for (const { parent, pre } of targets.reverse()) {
      const index = parent.children.indexOf(pre)
      if (index === -1) continue

      const code = pre.children.find(
        (child) => child.type === 'element' && child.tagName === 'code'
      ) as Element

      const text = extractText(code)
      if (!text) continue
      const lang = extractLang(code) || 'text'

      let result
      try {
        result = await codeToHast(text, {
          lang: lang as string,
          themes: { light: 'github-light', dark: 'github-dark' },
          transformers
        })
      } catch {
        // 语言不在 shiki bundle 内（例如自定义标签）时回退为纯文本，避免构建失败
        result = await codeToHast(text, {
          lang: 'text' as string,
          themes: { light: 'github-light', dark: 'github-dark' },
          transformers
        })
      }

      parent.children.splice(index, 1, ...(result.children as Element[]))
    }
  }
}
