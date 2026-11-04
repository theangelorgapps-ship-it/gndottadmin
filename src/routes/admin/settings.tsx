import { createFileRoute, useRouter } from '@tanstack/react-router'
import { useState } from 'react'
import { adminGetSettings, adminSaveSetting } from '../../lib/admin'

export const Route = createFileRoute('/admin/settings')({
  loader: async () => await adminGetSettings(),
  component: AdminSettings,
})

function AdminSettings() {
  const groups = Route.useLoaderData()
  const router = useRouter()
  const [savedId, setSavedId] = useState<number | null>(null)
  const [values, setValues] = useState<Record<number, string>>({})

  async function save(id: number) {
    const val = values[id]
    if (val === undefined) return
    await adminSaveSetting({ data: { id, val: val } })
    setSavedId(id)
    setTimeout(() => setSavedId(null), 2000)
    router.invalidate()
  }

  const groupNames = Object.keys(groups)
  return (
    <div>
      <div className="breadcrumb">Dashboard <span className="sep">/</span> <span className="here">Settings</span></div>
      {groupNames.length === 0 && <div className="empty">No settings found.</div>}
      {groupNames.map((g) => (
        <div className="settings-group" key={g}>
          <h3>{g.replace(/_/g, ' ')}</h3>
          {(groups as any)[g].map((s: any) => (
            <div className="setting-row" key={s.id}>
              <span className="s-name">{s.name}</span>
              <input
                value={values[s.id] ?? s.val ?? ''}
                onChange={(e) => setValues({ ...values, [s.id]: e.target.value })}
              />
              <button className="btn btn-dark btn-xs" onClick={() => save(s.id)}>
                {savedId === s.id ? 'Saved' : 'Save'}
              </button>
            </div>
          ))}
        </div>
      ))}
    </div>
  )
}
