type Lookup = (sql: string, ...params: any[]) => Promise<any>

export function groupedType(entity: string): 'tvshow' | 'teaching' | null {
  if (['seasons', 'series', 'episodes'].includes(entity)) return 'tvshow'
  if (['teaching-volumes', 'teaching-episodes'].includes(entity)) return 'teaching'
  return null
}

export function isSeriesEntity(entity: string) {
  return ['seasons', 'series', 'teaching-volumes'].includes(entity)
}

export async function assertGroupedRecord(entity: string, row: any, first: Lookup) {
  const type = groupedType(entity)
  if (!type) return
  if (!row || row.deleted_at) throw new Error('Record not found.')
  const parent = await first('SELECT id FROM entertainments WHERE id = ? AND type = ? AND deleted_at IS NULL', row.entertainment_id, type)
  if (!parent) throw new Error('Record does not belong to this content type.')
}

export async function validateGroupedValues(entity: string, values: Record<string, any>, current: any, first: Lookup) {
  const type = groupedType(entity)
  if (!type) return
  const merged = { ...current, ...values }
  if (!String(merged.name ?? '').trim()) throw new Error('Name is required.')
  const parentId = Number(merged.entertainment_id)
  if (!Number.isSafeInteger(parentId) || parentId < 1) throw new Error(type === 'teaching' ? 'Select a teaching.' : 'Select a TV show.')
  const parent = await first('SELECT id FROM entertainments WHERE id = ? AND type = ? AND deleted_at IS NULL', parentId, type)
  if (!parent) throw new Error('Select a valid parent of the correct content type.')
  values.entertainment_id = parentId
  if (isSeriesEntity(entity)) {
    const number = Number(merged.season_number ?? merged.season_index)
    if (!Number.isSafeInteger(number) || number < 1) throw new Error('Series or volume number must be a positive whole number.')
    values.season_number = number
    values.season_index = String(number)
    if (current && Number(current.entertainment_id) !== parentId) {
      const linked = await first('SELECT id FROM episodes WHERE season_id = ? AND deleted_at IS NULL LIMIT 1', current.id)
      if (linked) throw new Error('Reassign the episodes before moving this series or volume to another title.')
    }
    const duplicate = await first('SELECT id FROM seasons WHERE entertainment_id = ? AND COALESCE(season_number, CAST(season_index AS INTEGER)) = ? AND deleted_at IS NULL AND id != ? LIMIT 1', parentId, number, current?.id ?? 0)
    if (duplicate) throw new Error('This title already has that series or volume number.')
  } else {
    const groupId = merged.season_id == null || merged.season_id === '' ? null : Number(merged.season_id)
    if (groupId !== null) {
      if (!Number.isSafeInteger(groupId) || groupId < 1) throw new Error('Select a valid series or volume.')
      const group = await first('SELECT id FROM seasons WHERE id = ? AND entertainment_id = ? AND deleted_at IS NULL', groupId, parentId)
      if (!group) throw new Error('The selected series or volume does not belong to this title.')
    }
    values.season_id = groupId
  }
}
