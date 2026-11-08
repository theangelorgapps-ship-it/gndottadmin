// Novu (https://github.com/novuhq/novu) notification plumbing.
// Config lives in the settings table (appconfig type): novu_api_key,
// novu_application_id, novu_backend_url — editable under
// Settings → Notification Configuration in the admin panel.

import { all } from './db'

export interface NovuConfig {
  apiKey: string
  applicationId: string
  backendUrl: string
}

export async function getNovuConfig(): Promise<NovuConfig | null> {
  const rows = await all<any>(
    `SELECT name, val FROM settings WHERE name IN ('novu_api_key', 'novu_application_id', 'novu_backend_url') AND deleted_at IS NULL`,
  ).catch(() => [])
  const map = Object.fromEntries(rows.map((r) => [r.name, (r.val ?? '').trim()]))
  if (!map.novu_api_key) return null
  return {
    apiKey: map.novu_api_key,
    applicationId: map.novu_application_id || '',
    backendUrl: (map.novu_backend_url || 'https://api.novu.co').replace(/\/$/, ''),
  }
}

/** Trigger a Novu workflow event. No-op (returns false) when Novu is not configured. */
export async function novuTrigger(
  workflowId: string,
  subscriberId: string,
  payload: Record<string, unknown> = {},
): Promise<boolean> {
  const cfg = await getNovuConfig()
  if (!cfg) return false
  const res = await fetch(`${cfg.backendUrl}/v1/events/trigger`, {
    method: 'POST',
    headers: {
      Authorization: `ApiKey ${cfg.apiKey}`,
      'Content-Type': 'application/json',
      ...(cfg.applicationId ? { 'Novu-Application-Id': cfg.applicationId } : {}),
    },
    body: JSON.stringify({ name: workflowId, to: { subscriberId }, payload }),
  })
  return res.ok
}
