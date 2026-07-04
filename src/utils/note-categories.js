function normalizeCategory(category) {
  return typeof category === 'string' && category.trim() ? category.trim() : undefined
}

export function getNoteCategoryGroups(notes) {
  const counts = new Map()

  for (const note of notes) {
    const category = normalizeCategory(note.category)
    if (!category) continue
    counts.set(category, (counts.get(category) || 0) + 1)
  }

  return [...counts.entries()]
    .map(([category, count]) => ({
      category,
      count,
      hrefSegment: encodeURIComponent(category)
    }))
    .sort((a, b) => a.category.localeCompare(b.category))
}

export function getNoteCategoryItems(notes, category) {
  const normalized = normalizeCategory(category)
  if (!normalized) return []

  return notes
    .filter((note) => normalizeCategory(note.category) === normalized)
    .sort((a, b) => a.title.localeCompare(b.title))
}

export function getNotesWithoutCategory(notes) {
  return notes
    .filter((note) => !normalizeCategory(note.category))
    .sort((a, b) => a.title.localeCompare(b.title))
}
