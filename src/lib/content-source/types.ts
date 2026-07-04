export type ContentRegistryType = 'Post' | 'Page' | 'Project' | 'Note'
export type ContentLang = 'zh' | 'en'

export interface ContentPost {
  id: string
  title: string
  type: 'Post'
  lang: ContentLang
  slug: string
  source: string
  date: Date
  tags: string[]
  category?: string
  cover?: string
}

export interface ContentPageEntry {
  id: string
  title: string
  type: 'Page'
  lang: ContentLang
  slug: string
  source: string
}

export interface ContentNoteEntry {
  id: string
  title: string
  type: 'Note'
  lang: ContentLang
  slug: string
  source: string
  category?: string
}

export interface ContentProject {
  id: string
  title: string
  type: 'Project'
  lang: ContentLang
  description?: string
  image?: string
  order?: number
  site?: string
  github?: string
  doc?: string
  release?: string
  category?: string
}

export type ContentEntry =
  | ContentPost
  | ContentPageEntry
  | ContentNoteEntry
  | ContentProject
