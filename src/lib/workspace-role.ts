export type WorkspaceRole = 'admin' | 'moderator'
type RoleDatabase = { prepare(sql: string): { bind(...values: unknown[]): { first(): Promise<unknown> } } }

/** Call after account eligibility checks; channel authorization remains at each handler. */
export async function workspaceRoleFor(db: RoleDatabase, user: { id: number | string; user_type: string }): Promise<WorkspaceRole | null> {
  if (['admin', 'demo_admin'].includes(user.user_type)) return 'admin'
  const assigned = await db.prepare(`SELECT 1 FROM live_chat_moderators m JOIN live_tv_channel c ON c.id=m.channel_id
    WHERE m.user_id=? AND c.deleted_at IS NULL LIMIT 1`).bind(Number(user.id)).first()
  return assigned ? 'moderator' : null
}
