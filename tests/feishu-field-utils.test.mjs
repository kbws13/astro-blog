import assert from 'node:assert/strict'
import test from 'node:test'

import {
  FEISHU_REGISTRY_FIELD_NAMES,
  extractFeishuWikiToken,
  normalizeFeishuRecord,
  readFeishuFieldValue
} from '../src/lib/content-source/feishu-field-utils.js'

test('extractFeishuWikiToken reads wiki token from a Feishu wiki URL', () => {
  assert.equal(
    extractFeishuWikiToken('https://my.feishu.cn/wiki/LMwXwJqaWilHW1kvWJ4cyEnJnOb'),
    'LMwXwJqaWilHW1kvWJ4cyEnJnOb'
  )
})

test('readFeishuFieldValue normalizes common Bitable field shapes', () => {
  assert.equal(readFeishuFieldValue({ text: 'Site', link: 'https://example.com' }), 'https://example.com')
  assert.equal(readFeishuFieldValue([{ text: 'Hello' }, { text: ' world' }]), 'Hello world')
  assert.equal(readFeishuFieldValue([{ name: 'tech' }, { name: 'astro' }]).join(','), 'tech,astro')
  assert.equal(readFeishuFieldValue(1704067200000), '2024-01-01')
})

test('normalizeFeishuRecord maps a published post registry row', () => {
  const entry = normalizeFeishuRecord({
    record_id: 'rec001',
    fields: {
      Title: [{ text: 'Feishu Migration' }],
      Type: 'Post',
      Status: 'Published',
      Lang: 'zh',
      Slug: [{ text: 'feishu-migration' }],
      Source: { text: 'doc', link: 'https://my.feishu.cn/wiki/LMwXwJqaWilHW1kvWJ4cyEnJnOb' },
      Date: 1704067200000,
      Tags: ['astro', 'feishu'],
      Category: 'tech',
      Cover: { text: 'cover', link: 'https://example.com/cover.webp' }
    }
  })

  assert.deepEqual(entry, {
    id: 'rec001',
    title: 'Feishu Migration',
    type: 'Post',
    lang: 'zh',
    slug: 'feishu-migration',
    source: 'https://my.feishu.cn/wiki/LMwXwJqaWilHW1kvWJ4cyEnJnOb',
    date: new Date('2024-01-01'),
    tags: ['astro', 'feishu'],
    category: 'tech',
    cover: 'https://example.com/cover.webp'
  })
})

test('normalizeFeishuRecord skips unpublished rows', () => {
  assert.equal(
    normalizeFeishuRecord({
      record_id: 'rec002',
      fields: {
        Title: 'Draft',
        Type: 'Post',
        Status: 'Draft',
        Lang: 'zh',
        Slug: 'draft',
        Source: 'https://example.com',
        Date: 1704067200000
      }
    }),
    null
  )
})

test('normalizeFeishuRecord maps an optional category on notes', () => {
  const entry = normalizeFeishuRecord({
    record_id: 'rec-note-category',
    fields: {
      Title: 'Agent Notes',
      Type: 'Note',
      Status: 'Published',
      Lang: 'zh',
      Slug: 'agent',
      Source: 'https://my.feishu.cn/wiki/LMwXwJqaWilHW1kvWJ4cyEnJnOb',
      Category: 'AI'
    }
  })

  assert.deepEqual(entry, {
    id: 'rec-note-category',
    title: 'Agent Notes',
    type: 'Note',
    lang: 'zh',
    slug: 'agent',
    source: 'https://my.feishu.cn/wiki/LMwXwJqaWilHW1kvWJ4cyEnJnOb',
    category: 'AI'
  })
})

test('registry query field names exclude removed friend-link fields', () => {
  assert.equal(FEISHU_REGISTRY_FIELD_NAMES.includes('URL'), false)
  assert.equal(FEISHU_REGISTRY_FIELD_NAMES.includes('Avatar'), false)
})

test('registry query field names include optional post cover field', () => {
  assert.equal(FEISHU_REGISTRY_FIELD_NAMES.includes('Cover'), true)
})
