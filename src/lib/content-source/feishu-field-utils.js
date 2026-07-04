const PUBLISHED_STATUS = 'published'

export const FEISHU_REGISTRY_FIELD_NAMES = [
  'Title',
  'Type',
  'Status',
  'Lang',
  'Slug',
  'Source',
  'Date',
  'Tags',
  'Category',
  'Cover',
  'Description',
  'Order',
  'Image',
  'Site',
  'GitHub',
  'Doc',
  'Release'
]

export function extractFeishuWikiToken(url) {
  const match = String(url || '').match(/\/wiki\/([^/?#]+)/)
  if (!match) {
    throw new Error(`Unable to extract Feishu wiki token from URL: ${url}`)
  }
  return match[1]
}

export function readFeishuFieldValue(value) {
  if (value == null) return undefined

  if (typeof value === 'string' || typeof value === 'boolean') {
    return value
  }

  if (typeof value === 'number') {
    if (value > 10_000_000_000) {
      return new Date(value).toISOString().slice(0, 10)
    }
    return value
  }

  if (Array.isArray(value)) {
    if (value.every((item) => item && typeof item === 'object' && 'name' in item)) {
      return value.map((item) => item.name).filter(Boolean)
    }
    if (value.every((item) => item && typeof item === 'object' && 'text' in item)) {
      return value.map((item) => item.text || '').join('')
    }
    return value.map(readFeishuFieldValue).filter((item) => item !== undefined)
  }

  if (typeof value === 'object') {
    if (typeof value.link === 'string' && value.link) return value.link
    if (typeof value.url === 'string' && value.url) return value.url
    if (typeof value.text === 'string') return value.text
    if (typeof value.name === 'string') return value.name
    if (Array.isArray(value.link_record_ids)) return value.link_record_ids
  }

  return undefined
}

function getField(fields, names) {
  for (const name of Array.isArray(names) ? names : [names]) {
    if (Object.prototype.hasOwnProperty.call(fields, name)) {
      return readFeishuFieldValue(fields[name])
    }
  }
  return undefined
}

function asString(value, fieldName, required = true) {
  const normalized = Array.isArray(value) ? value.join('') : value
  if (typeof normalized === 'string' && normalized.trim()) return normalized.trim()
  if (typeof normalized === 'number') return String(normalized)
  if (!required) return undefined
  throw new Error(`Missing required Feishu registry field: ${fieldName}`)
}

function asStringArray(value) {
  if (Array.isArray(value)) {
    return value.map((item) => String(item).trim()).filter(Boolean)
  }
  if (typeof value === 'string' && value.trim()) {
    return value.split(',').map((item) => item.trim()).filter(Boolean)
  }
  return []
}

function asNumber(value) {
  if (typeof value === 'number') return value
  if (typeof value === 'string' && value.trim()) {
    const parsed = Number(value)
    return Number.isFinite(parsed) ? parsed : undefined
  }
  return undefined
}

function asDate(value, fieldName) {
  if (value instanceof Date) return value
  const normalized = asString(value, fieldName)
  const date = new Date(normalized)
  if (Number.isNaN(date.valueOf())) {
    throw new Error(`Invalid date in Feishu registry field: ${fieldName}`)
  }
  return date
}

function asLang(value) {
  const lang = asString(value, 'Lang').toLowerCase()
  if (lang !== 'zh' && lang !== 'en') {
    throw new Error(`Unsupported Feishu Lang value: ${lang}`)
  }
  return lang
}

function baseEntry(record, fields) {
  return {
    id: record.record_id,
    title: asString(getField(fields, 'Title'), 'Title'),
    type: asString(getField(fields, 'Type'), 'Type'),
    lang: asLang(getField(fields, 'Lang'))
  }
}

export function normalizeFeishuRecord(record) {
  const fields = record?.fields || {}
  const status = String(getField(fields, 'Status') || '').trim().toLowerCase()
  if (status !== PUBLISHED_STATUS) return null

  const base = baseEntry(record, fields)

  if (base.type === 'Post') {
    const source = asString(getField(fields, 'Source'), 'Source')
    return {
      ...base,
      type: 'Post',
      slug: asString(getField(fields, 'Slug'), 'Slug'),
      source,
      date: asDate(getField(fields, 'Date'), 'Date'),
      tags: asStringArray(getField(fields, ['Tags', 'Tag'])),
      category: asString(getField(fields, 'Category'), 'Category', false),
      cover: asString(getField(fields, 'Cover'), 'Cover', false)
    }
  }

  if (base.type === 'Page' || base.type === 'Note') {
    return {
      ...base,
      type: base.type,
      slug: asString(getField(fields, 'Slug'), 'Slug'),
      source: asString(getField(fields, 'Source'), 'Source'),
      ...(base.type === 'Note'
        ? { category: asString(getField(fields, 'Category'), 'Category', false) }
        : {})
    }
  }

  if (base.type === 'Project') {
    return {
      ...base,
      type: 'Project',
      description: asString(getField(fields, 'Description'), 'Description', false),
      image: asString(getField(fields, 'Image'), 'Image', false),
      order: asNumber(getField(fields, 'Order')),
      site: asString(getField(fields, 'Site'), 'Site', false),
      github: asString(getField(fields, 'GitHub'), 'GitHub', false),
      doc: asString(getField(fields, 'Doc'), 'Doc', false),
      release: asString(getField(fields, 'Release'), 'Release', false),
      category: asString(getField(fields, 'Category'), 'Category', false)
    }
  }

  throw new Error(`Unsupported Feishu registry Type value: ${base.type}`)
}
