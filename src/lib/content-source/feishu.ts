import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'

import { docxBlocksToMarkdown } from './feishu-docx-markdown.js'
import {
  FEISHU_REGISTRY_FIELD_NAMES,
  extractFeishuWikiToken,
  normalizeFeishuRecord
} from './feishu-field-utils.js'
import type {
  ContentEntry,
  ContentLang,
  ContentNoteEntry,
  ContentPageEntry,
  ContentPost,
  ContentProject,
  ContentRegistryType
} from './types'

type FeishuEnvName =
  | 'FEISHU_APP_ID'
  | 'FEISHU_APP_SECRET'
  | 'FEISHU_TEST_DOC_URL'
  | 'FEISHU_REGISTRY_APP_TOKEN'
  | 'FEISHU_REGISTRY_TABLE_ID'
  | 'FEISHU_REGISTRY_VIEW_ID'
  | 'FEISHU_WIKI_SPACE_ID'

interface FeishuApiResponse<T> {
  code: number
  msg: string
  data?: T
  tenant_access_token?: string
  expire?: number
}

interface FeishuRecord {
  record_id: string
  fields: Record<string, unknown>
}

interface FeishuNodeInfo {
  node: {
    obj_token: string
    obj_type: string
    title?: string
  }
}

interface FeishuBlockChildren {
  items?: FeishuBlock[]
  has_more?: boolean
  page_token?: string
}

interface FeishuBlock {
  block_id?: string
  block_type?: number
  children?: string[]
  childrenBlocks?: FeishuBlock[]
  text?: {
    elements?: FeishuTextElement[]
  }
  heading1?: { elements?: FeishuTextElement[] }
  heading2?: { elements?: FeishuTextElement[] }
  heading3?: { elements?: FeishuTextElement[] }
  heading4?: { elements?: FeishuTextElement[] }
  heading5?: { elements?: FeishuTextElement[] }
  heading6?: { elements?: FeishuTextElement[] }
  bullet?: { elements?: FeishuTextElement[] }
  ordered?: { elements?: FeishuTextElement[] }
  code?: { elements?: FeishuTextElement[]; language?: string; style?: { language?: number } }
  quote?: { elements?: FeishuTextElement[] }
  image?: {
    token?: string
    width?: number
    height?: number
  }
}

interface FeishuTextElement {
  text_run?: {
    content?: string
    text_element_style?: {
      bold?: boolean
      italic?: boolean
      inline_code?: boolean
      link?: { url?: string }
    }
  }
}

let envFileCache: Record<string, string> | undefined
let tokenCache: { token: string; expiresAt: number } | undefined
const registryCache = new Map<string, Promise<ContentEntry[]>>()
const markdownCache = new Map<string, Promise<string>>()
const mediaCache = new Map<string, Promise<string>>()

function loadEnvFile(): Record<string, string> {
  if (envFileCache) return envFileCache

  const envFilePath = resolve(process.cwd(), '.env')
  if (!existsSync(envFilePath)) {
    envFileCache = {}
    return envFileCache
  }

  envFileCache = readFileSync(envFilePath, 'utf8')
    .split(/\r?\n/)
    .reduce<Record<string, string>>((acc, line) => {
      const trimmed = line.trim()
      if (!trimmed || trimmed.startsWith('#')) return acc
      const separator = trimmed.indexOf('=')
      if (separator === -1) return acc
      const key = trimmed.slice(0, separator).trim()
      const value = trimmed.slice(separator + 1).trim().replace(/^['"]|['"]$/g, '')
      if (key) acc[key] = value
      return acc
    }, {})

  return envFileCache
}

function getEnv(name: FeishuEnvName): string | undefined {
  const env = loadEnvFile()
  return process.env[name] || import.meta.env?.[name] || env[name] || undefined
}

function getRequiredEnv(name: FeishuEnvName): string {
  const value = getEnv(name)
  if (!value) throw new Error(`Missing required environment variable: ${name}`)
  return value
}

async function getTenantAccessToken(): Promise<string> {
  const now = Date.now()
  if (tokenCache && tokenCache.expiresAt - now > 30 * 60 * 1000) {
    return tokenCache.token
  }

  const response = await fetch('https://open.feishu.cn/open-apis/auth/v3/tenant_access_token/internal', {
    method: 'POST',
    headers: { 'content-type': 'application/json; charset=utf-8' },
    body: JSON.stringify({
      app_id: getRequiredEnv('FEISHU_APP_ID'),
      app_secret: getRequiredEnv('FEISHU_APP_SECRET')
    })
  })

  const data = await response.json() as FeishuApiResponse<never>
  if (data.code !== 0 || !data.tenant_access_token) {
    throw new Error(`Feishu tenant_access_token request failed: ${data.msg || data.code}`)
  }

  tokenCache = {
    token: data.tenant_access_token,
    expiresAt: now + Math.max((data.expire ?? 7200) - 60, 60) * 1000
  }
  return tokenCache.token
}

class FeishuApiError extends Error {
  readonly rateLimited: boolean

  constructor(path: string, data: FeishuApiResponse<unknown>) {
    super(`Feishu API request failed (${path}): ${data.msg || data.code}`)
    this.rateLimited =
      data.code === 99991400 || /frequency limit|too many request|rate limit/i.test(data.msg || '')
  }
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

const MAX_REQUEST_ATTEMPTS = 5
const RETRY_BASE_DELAY_MS = 500

function isRetryableError(error: unknown): boolean {
  if (error instanceof FeishuApiError) return error.rateLimited
  // Network-level failures (fetch rejects) are retried as well
  return true
}

async function feishuRequestOnce<T>(
  path: string,
  init: RequestInit
): Promise<FeishuApiResponse<T>> {
  const token = await getTenantAccessToken()
  const response = await fetch(`https://open.feishu.cn/open-apis${path}`, {
    ...init,
    headers: {
      authorization: `Bearer ${token}`,
      'content-type': 'application/json; charset=utf-8',
      ...(init.headers || {})
    }
  })

  const data = await response.json() as FeishuApiResponse<T>
  if (data.code !== 0) {
    throw new FeishuApiError(path, data)
  }
  return data
}

async function feishuRequest<T>(path: string, init: RequestInit = {}): Promise<FeishuApiResponse<T>> {
  for (let attempt = 1; ; attempt++) {
    try {
      return await feishuRequestOnce<T>(path, init)
    } catch (error) {
      if (attempt >= MAX_REQUEST_ATTEMPTS || !isRetryableError(error)) throw error
      await sleep(RETRY_BASE_DELAY_MS * 2 ** (attempt - 1) + Math.random() * 500)
    }
  }
}

// Feishu throttles parallel docx block requests ("request trigger frequency limit"),
// so cap the number of in-flight block fetches process-wide.
const DOCX_REQUEST_CONCURRENCY = 5
let docxActiveRequests = 0
const docxWaiters: Array<() => void> = []

async function withDocxSlot<T>(task: () => Promise<T>): Promise<T> {
  if (docxActiveRequests >= DOCX_REQUEST_CONCURRENCY) {
    await new Promise<void>((resolve) => docxWaiters.push(resolve))
  }
  docxActiveRequests++
  try {
    return await task()
  } finally {
    docxActiveRequests--
    docxWaiters.shift()?.()
  }
}

function hasRegistryConfig() {
  return Boolean(getEnv('FEISHU_REGISTRY_APP_TOKEN') && getEnv('FEISHU_REGISTRY_TABLE_ID'))
}

async function getRegistryEntries(): Promise<ContentEntry[]> {
  const cacheKey = 'published'
  if (registryCache.has(cacheKey)) return registryCache.get(cacheKey)!

  const request = (async () => {
    if (!hasRegistryConfig()) return []

    const appToken = getRequiredEnv('FEISHU_REGISTRY_APP_TOKEN')
    const tableId = getRequiredEnv('FEISHU_REGISTRY_TABLE_ID')
    const viewId = getEnv('FEISHU_REGISTRY_VIEW_ID')
    const entries: ContentEntry[] = []
    let pageToken: string | undefined

    do {
      const query = new URLSearchParams({ page_size: '500' })
      if (pageToken) query.set('page_token', pageToken)

      const body: Record<string, unknown> = {
        field_names: FEISHU_REGISTRY_FIELD_NAMES,
        filter: {
          conjunction: 'and',
          conditions: [{ field_name: 'Status', operator: 'is', value: ['Published'] }]
        },
        automatic_fields: false
      }
      if (viewId) body.view_id = viewId

      const data = await feishuRequest<{
        items?: FeishuRecord[]
        has_more?: boolean
        page_token?: string
      }>(`/bitable/v1/apps/${appToken}/tables/${tableId}/records/search?${query}`, {
        method: 'POST',
        body: JSON.stringify(body)
      })

      for (const record of data.data?.items || []) {
        const entry = normalizeFeishuRecord(record) as ContentEntry | null
        if (entry) entries.push(entry)
      }

      pageToken = data.data?.has_more ? data.data.page_token : undefined
    } while (pageToken)

    return entries
  })()

  registryCache.set(cacheKey, request)
  return request
}

function getEntriesByType<T extends ContentEntry>(type: ContentRegistryType): Promise<T[]> {
  return getRegistryEntries().then((entries) => entries.filter((entry): entry is T => entry.type === type))
}

export async function getPosts(): Promise<ContentPost[]> {
  return getEntriesByType<ContentPost>('Post')
}

export async function getPages(): Promise<ContentPageEntry[]> {
  return getEntriesByType<ContentPageEntry>('Page')
}

export async function getNotes(): Promise<ContentNoteEntry[]> {
  return getEntriesByType<ContentNoteEntry>('Note')
}

export async function getProjects(): Promise<ContentProject[]> {
  return getEntriesByType<ContentProject>('Project')
}

const PROJECT_LINK_ICONS: Record<string, string> = {
  site: 'earth',
  github: 'github-circle',
  doc: 'document',
  release: 'package'
}
const PROJECT_LINK_PRIORITY = ['site', 'github', 'doc', 'release'] as const

export interface ProjectLink {
  name: string
  url: string
  icon: string
}

export function getProjectLink(project: ContentProject): ProjectLink | undefined {
  for (const key of PROJECT_LINK_PRIORITY) {
    const href = project[key]
    if (typeof href === 'string' && href) {
      return { name: project.title, url: href, icon: PROJECT_LINK_ICONS[key] }
    }
  }
  return undefined
}

export async function findProjectByArticleSlug(
  slug: string,
  lang: ContentLang
): Promise<ContentProject | undefined> {
  const projects = await getProjects()
  return projects.find((project) => project.slug === slug && project.lang === lang)
}

export async function getArticleUrls(lang: ContentLang): Promise<Map<string, string>> {
  const [posts, notes] = await Promise.all([getPosts(), getNotes()])
  const prefix = lang === 'en' ? '/en' : ''
  const urls = new Map<string, string>()

  for (const post of posts) {
    if (post.lang === lang) urls.set(post.slug, `${prefix}/blog/${post.slug}`)
  }
  for (const note of notes) {
    if (note.lang === lang) urls.set(note.slug, `${prefix}/notes/${note.slug}`)
  }
  return urls
}

function extractSourceToken(source: string) {
  if (/\/wiki\//.test(source)) {
    return { token: extractFeishuWikiToken(source), objType: 'wiki' }
  }

  const match = source.match(/\/(docx|doc|base|sheets)\/([^/?#]+)/)
  if (match) return { objType: match[1], token: match[2] }

  return { token: source, objType: 'docx' }
}

async function resolveSource(source: string) {
  const parsed = extractSourceToken(source)
  if (parsed.objType !== 'wiki') return parsed

  const data = await feishuRequest<FeishuNodeInfo>(
    `/wiki/v2/spaces/get_node?token=${encodeURIComponent(parsed.token)}`
  )
  const node = data.data?.node
  if (!node?.obj_token || !node.obj_type) {
    throw new Error(`Feishu wiki node did not return an object token for source: ${source}`)
  }
  return { token: node.obj_token, objType: node.obj_type }
}

async function getDocxBlocks(documentId: string, blockId: string): Promise<FeishuBlock[]> {
  return withDocxSlot(async () => {
    const blocks: FeishuBlock[] = []
    let pageToken: string | undefined

    do {
      const query = new URLSearchParams({
        page_size: '500',
        document_revision_id: '-1'
      })
      if (pageToken) query.set('page_token', pageToken)

      const data = await feishuRequest<FeishuBlockChildren>(
        `/docx/v1/documents/${documentId}/blocks/${blockId}/children?${query}`
      )
      blocks.push(...(data.data?.items || []))
      pageToken = data.data?.has_more ? data.data.page_token : undefined
    } while (pageToken)

    return blocks
  })
}

async function getDocxBlockTree(documentId: string, blockId: string): Promise<FeishuBlock[]> {
  const blocks = await getDocxBlocks(documentId, blockId)

  return await Promise.all(
    blocks.map(async (block) => {
      if (block.block_id && block.children?.length) {
        block.childrenBlocks = await getDocxBlockTree(documentId, block.block_id)
      }
      return block
    })
  )
}

function getMediaExtension(contentType: string) {
  if (contentType.includes('image/png')) return 'png'
  if (contentType.includes('image/jpeg')) return 'jpg'
  if (contentType.includes('image/gif')) return 'gif'
  if (contentType.includes('image/webp')) return 'webp'
  if (contentType.includes('image/svg')) return 'svg'
  return 'bin'
}

function writeFeishuMediaAsset(filename: string, buffer: Buffer) {
  const cwd = process.cwd()
  const targets = [
    { dir: resolve(cwd, 'public', 'feishu-assets'), required: true },
    { dir: resolve(cwd, 'dist', 'feishu-assets'), required: existsSync(resolve(cwd, 'dist')) },
    {
      dir: resolve(cwd, '.vercel', 'output', 'static', 'feishu-assets'),
      required: existsSync(resolve(cwd, '.vercel', 'output', 'static'))
    }
  ]

  for (const target of targets) {
    if (!target.required) continue
    const filePath = resolve(target.dir, filename)
    mkdirSync(target.dir, { recursive: true })
    if (!existsSync(filePath)) writeFileSync(filePath, buffer)
  }
}

async function resolveFeishuImage(image: { token?: string }): Promise<string> {
  if (!image.token) return ''
  if (mediaCache.has(image.token)) return mediaCache.get(image.token)!

  const request = (async () => {
    const token = await getTenantAccessToken()
    const response = await fetch(
      `https://open.feishu.cn/open-apis/drive/v1/medias/${image.token}/download`,
      {
        headers: {
          authorization: `Bearer ${token}`
        }
      }
    )

    if (!response.ok) {
      throw new Error(`Feishu image download failed (${image.token}): ${response.status}`)
    }

    const contentType = response.headers.get('content-type') || ''
    const extension = getMediaExtension(contentType)
    const filename = `${image.token}.${extension}`
    const buffer = Buffer.from(await response.arrayBuffer())
    writeFeishuMediaAsset(filename, buffer)

    return `/feishu-assets/${filename}`
  })()

  mediaCache.set(image.token, request)
  return request
}

async function getDocxMarkdown(documentId: string): Promise<string> {
  const blocks = await getDocxBlockTree(documentId, documentId)
  return await docxBlocksToMarkdown(blocks, { resolveImage: resolveFeishuImage })
}

export async function getPageContent(source: string): Promise<string> {
  if (markdownCache.has(source)) return markdownCache.get(source)!

  const request = (async () => {
    const resolved = await resolveSource(source)
    if (resolved.objType !== 'docx') {
      throw new Error(`Unsupported Feishu content object type: ${resolved.objType}`)
    }

    return await getDocxMarkdown(resolved.token)
  })()

  markdownCache.set(source, request)
  return request
}
