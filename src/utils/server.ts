import { getCollection, type CollectionEntry } from 'astro:content'

import {
  getNotes,
  getPosts,
  type ContentLang,
  type ContentNoteEntry,
  type ContentPost
} from '../lib/content-source'

export interface BlogPostData {
  title: string
  description: string
  publishDate: Date
  updatedDate?: Date
  heroImage?: {
    src: string
    alt?: string
    inferSize?: boolean
    width?: number
    height?: number
    color?: string
  }
  tags: string[]
  category?: string
  language: ContentLang
  draft: boolean
  comment: boolean
  pixivLink?: string
}

export interface BlogPostEntry {
  id: string
  data: BlogPostData
  contentId: string
  source: string
}

export interface NoteEntry {
  id: string
  title: string
  lang: ContentLang
  path: string
  fullSlug: string
  contentId: string
  source: string
  category?: string
  segments: string[]
}

export interface NoteTreeNode {
  segment: string
  path: string
  title: string
  depth: number
  page?: NoteEntry
  children: NoteTreeNode[]
}

export interface FlatNoteTreeNode {
  path: string
  title: string
  depth: number
  hasPage: boolean
  hasChildren: boolean
}

export const prod = import.meta.env.PROD

function toBlogPostEntry(post: ContentPost): BlogPostEntry {
  const heroImage = post.cover
    ? {
        src: post.cover,
        alt: post.title,
        width: 1200,
        height: 630
      }
    : undefined

  return {
    id: post.slug,
    contentId: post.id,
    source: post.source,
    data: {
      title: post.title,
      description: post.title,
      publishDate: post.date,
      tags: post.tags,
      category: post.category,
      language: post.lang,
      draft: false,
      comment: true,
      heroImage
    }
  }
}

async function getPostsByLang(lang: ContentLang): Promise<BlogPostEntry[]> {
  return (await getPosts())
    .filter((post) => post.lang === lang)
    .map(toBlogPostEntry)
}

export async function getBlogCollection() {
  return await getPostsByLang('zh')
}

export async function getBlogCollectionEn() {
  return await getPostsByLang('en')
}

function splitNotePath(path: string) {
  return path ? path.split('/').filter(Boolean) : []
}

function humanizeNoteSegment(segment: string) {
  const decoded = decodeURIComponent(segment)
  const spaced = decoded.replace(/[-_]+/g, ' ').trim()

  if (!spaced) {
    return decoded
  }

  return /[A-Za-z]/.test(spaced)
    ? spaced.replace(/\b[a-z]/g, (char) => char.toUpperCase())
    : spaced
}

function toNoteEntry(note: ContentNoteEntry): NoteEntry {
  const path = note.slug

  return {
    id: path || 'notes',
    title: note.title,
    lang: note.lang,
    path,
    fullSlug: note.slug,
    contentId: note.id,
    source: note.source,
    category: note.category,
    segments: splitNotePath(path)
  }
}

async function getNotesByLang(lang: ContentLang): Promise<NoteEntry[]> {
  return (await getNotes())
    .filter((note) => note.lang === lang)
    .map(toNoteEntry)
    .sort((a, b) => a.path.localeCompare(b.path))
}

export async function getNotesCollection() {
  return await getNotesByLang('zh')
}

export async function getNotesCollectionEn() {
  return await getNotesByLang('en')
}

function sortNoteNodes(nodes: NoteTreeNode[]): NoteTreeNode[] {
  nodes.sort((a, b) => {
    const aLabel = a.page?.title || a.title
    const bLabel = b.page?.title || b.title
    return aLabel.localeCompare(bLabel)
  })

  nodes.forEach((node) => sortNoteNodes(node.children))
  return nodes
}

export function buildNoteTree(notes: NoteEntry[], rootTitle = 'Notes'): NoteTreeNode {
  const root: NoteTreeNode = {
    segment: '',
    path: '',
    title: rootTitle,
    depth: 0,
    children: []
  }

  for (const note of notes) {
    if (note.segments.length === 0) {
      root.page = note
      root.title = note.title || root.title
      continue
    }

    let current = root
    note.segments.forEach((segment, index) => {
      const nextPath = note.segments.slice(0, index + 1).join('/')
      let child = current.children.find((node) => node.segment === segment)

      if (!child) {
        child = {
          segment,
          path: nextPath,
          title: humanizeNoteSegment(segment),
          depth: index + 1,
          children: []
        }
        current.children.push(child)
      }

      current = child
    })

    current.page = note
    current.title = note.title || current.title
  }

  sortNoteNodes(root.children)
  return root
}

export function flattenNoteTree(root: NoteTreeNode): FlatNoteTreeNode[] {
  const flat: FlatNoteTreeNode[] = []

  function visit(node: NoteTreeNode) {
    flat.push({
      path: node.path,
      title: node.page?.title || node.title,
      depth: node.depth,
      hasPage: Boolean(node.page),
      hasChildren: node.children.length > 0
    })

    node.children.forEach(visit)
  }

  root.children.forEach(visit)
  return flat
}

export function getNoteNode(root: NoteTreeNode, path: string): NoteTreeNode | undefined {
  if (!path) {
    return root
  }

  const segments = splitNotePath(path)
  let current: NoteTreeNode | undefined = root

  for (const segment of segments) {
    current = current.children.find((node) => node.segment === segment)
    if (!current) {
      return undefined
    }
  }

  return current
}

export function getNoteAncestors(root: NoteTreeNode, path: string): NoteTreeNode[] {
  const ancestors: NoteTreeNode[] = [root]

  if (!path) {
    return ancestors
  }

  const segments = splitNotePath(path)
  let current: NoteTreeNode | undefined = root

  for (const segment of segments) {
    current = current.children.find((node) => node.segment === segment)
    if (!current) {
      break
    }
    ancestors.push(current)
  }

  return ancestors
}

export async function getPostCollections() {
  return await getCollection('postCollections')
}

export async function getPostsForCollection(
  collection: CollectionEntry<'postCollections'>,
  isEn: boolean = false
) {
  const allPosts = isEn ? await getBlogCollectionEn() : await getBlogCollection()
  const blogList = collection.data.bloglist || []

  const postMap = new Map<string, BlogPostEntry>()
  allPosts.forEach((post) => {
    postMap.set(post.id.toLowerCase(), post)
  })

  return blogList
    .map((itemId) => postMap.get(itemId.toLowerCase()))
    .filter((post): post is BlogPostEntry => post !== undefined)
}

function getYearFromCollection(collection: BlogPostEntry): number | undefined {
  const dateStr = collection.data.updatedDate ?? collection.data.publishDate
  return dateStr ? new Date(dateStr).getFullYear() : undefined
}

export function groupCollectionsByYear<T extends BlogPostEntry>(
  collections: T[]
): [number, T[]][] {
  const collectionsByYear = collections.reduce((acc, collection) => {
    const year = getYearFromCollection(collection)
    if (year !== undefined) {
      if (!acc.has(year)) {
        acc.set(year, [])
      }
      acc.get(year)!.push(collection)
    }
    return acc
  }, new Map<number, T[]>())

  return Array.from(collectionsByYear.entries()).sort((a, b) => b[0] - a[0])
}

export function sortMDByDate<T extends BlogPostEntry>(collections: T[]): T[] {
  return [...collections].sort((a, b) => {
    const aUpdatedDate = a.data.updatedDate ? new Date(a.data.updatedDate).valueOf() : 0
    const bUpdatedDate = b.data.updatedDate ? new Date(b.data.updatedDate).valueOf() : 0
    if (aUpdatedDate !== bUpdatedDate) {
      return bUpdatedDate - aUpdatedDate
    }
    const aPublishDate = a.data.publishDate ? new Date(a.data.publishDate).valueOf() : 0
    const bPublishDate = b.data.publishDate ? new Date(b.data.publishDate).valueOf() : 0
    return bPublishDate - aPublishDate
  })
}

export function getAllTags(collections: BlogPostEntry[]) {
  return collections.flatMap((collection) => [...collection.data.tags])
}

export function getUniqueTags(collections: BlogPostEntry[]) {
  return [...new Set(getAllTags(collections))]
}

export function getUniqueTagsWithCount(collections: BlogPostEntry[]): [string, number][] {
  return [
    ...getAllTags(collections).reduce(
      (acc, tag) => acc.set(tag, (acc.get(tag) || 0) + 1),
      new Map<string, number>()
    )
  ].sort((a, b) => b[1] - a[1])
}

export function getAllCategories(collections: BlogPostEntry[]) {
  return collections
    .map((collection) => collection.data.category)
    .filter((category): category is string => category !== undefined)
}

export function getUniqueCategories(collections: BlogPostEntry[]) {
  return [...new Set(getAllCategories(collections))]
}

export function getUniqueCategoriesWithCount(collections: BlogPostEntry[]): [string, number][] {
  return [
    ...getAllCategories(collections).reduce(
      (acc, category) => acc.set(category, (acc.get(category) || 0) + 1),
      new Map<string, number>()
    )
  ].sort((a, b) => b[1] - a[1])
}

export function getCollectionsByCategory<T extends BlogPostEntry>(
  collections: T[],
  category: string
): T[] {
  return collections.filter((collection) => collection.data.category === category)
}
