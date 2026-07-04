import assert from 'node:assert/strict'
import test from 'node:test'

import {
  getNoteCategoryGroups,
  getNoteCategoryItems,
  getNotesWithoutCategory
} from '../src/utils/note-categories.js'

const notes = [
  {
    id: 'agent',
    title: 'Agent',
    lang: 'zh',
    path: 'agent',
    fullSlug: 'agent',
    contentId: 'rec-agent',
    source: 'https://example.com/agent',
    category: 'AI',
    segments: ['agent']
  },
  {
    id: 'rag',
    title: 'RAG',
    lang: 'zh',
    path: 'rag',
    fullSlug: 'rag',
    contentId: 'rec-rag',
    source: 'https://example.com/rag',
    category: 'AI',
    segments: ['rag']
  },
  {
    id: 'daily',
    title: 'Daily',
    lang: 'zh',
    path: 'daily',
    fullSlug: 'daily',
    contentId: 'rec-daily',
    source: 'https://example.com/daily',
    segments: ['daily']
  }
]

test('getNoteCategoryGroups groups categorized notes and counts them', () => {
  assert.deepEqual(getNoteCategoryGroups(notes), [
    {
      category: 'AI',
      count: 2,
      hrefSegment: 'AI'
    }
  ])
})

test('getNoteCategoryItems returns notes in one category only', () => {
  assert.deepEqual(
    getNoteCategoryItems(notes, 'AI').map((note) => note.title),
    ['Agent', 'RAG']
  )
})

test('getNotesWithoutCategory returns uncategorized notes only', () => {
  assert.deepEqual(
    getNotesWithoutCategory(notes).map((note) => note.title),
    ['Daily']
  )
})
