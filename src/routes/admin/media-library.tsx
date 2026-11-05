import { createFileRoute, useRouter } from '@tanstack/react-router'
import { useState } from 'react'
import { adminListR2Media, adminDeleteR2Object } from '../../lib/admin'

export const Route = createFileRoute('/admin/media-library')({
  loader: async () => await adminListR2Media(),
  component: Page,
})

function fmtSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / 1024 / 1024).toFixed(2)} MB`
}

function Page() {
  const data = Route.useLoaderData() as any
  const router = useRouter()
  const [query, setQuery] = useState('')
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const objects = (data?.objects ?? []).filter((o: any) => o.key.toLowerCase().includes(query.toLowerCase()))
  const isImage = (k: string) => /\.(jpe?g|png|webp|gif|svg)$/i.test(k)

  return (
    <div>
      <div className="breadcrumb">Dashboard <span className="sep">/</span> <span className="here">Media Library</span></div>
      <div className="toolbar">
        <input type="search" placeholder="Search files…" value={query} onChange={(e) => setQuery(e.target.value)} />
        <span className="spacer" />
        <label className="btn btn-primary" style={{ cursor: 'pointer' }}>
          {uploading ? 'Uploading…' : '+ Upload File'}
          <input
            type="file"
            style={{ display: 'none' }}
            disabled={uploading}
            onChange={async (e) => {
              const f = e.target.files?.[0]
              if (!f) return
              setUploading(true)
              setError(null)
              const fd = new FormData()
              fd.append('file', f)
              const res = await fetch('/api/upload', { method: 'POST', body: fd })
              const json: any = await res.json().catch(() => null)
              setUploading(false)
              if (json?.ok) router.invalidate()
              else setError(json?.error ?? 'Upload failed')
              e.target.value = ''
            }}
          />
        </label>
      </div>
      {data?.ok === false && <div className="empty" style={{ padding: 20 }}>{data.error}</div>}
      {error && <div className="error" style={{ marginBottom: 12 }}>{error}</div>}
      {data?.truncated && <p style={{ color: 'var(--muted-2)', fontSize: 13 }}>Showing first 200 objects (bucket has more).</p>}
      <table className="admin-table">
        <thead>
          <tr><th>File</th><th>Type</th><th>Size</th><th>Uploaded</th><th style={{ width: 170 }}></th></tr>
        </thead>
        <tbody>
          {objects.map((o: any) => (
            <tr key={o.key}>
              <td>
                <div className="cell-main">
                  {isImage(o.key) && <img src={o.url} alt="" />}
                  <div>
                    <div className="cell-title" style={{ maxWidth: 340, overflow: 'hidden', textOverflow: 'ellipsis' }}>{o.key}</div>
                    <div className="cell-sub"><a href={o.url} target="_blank" rel="noreferrer">{o.url}</a></div>
                  </div>
                </div>
              </td>
              <td>{o.key.split('.').pop()?.toUpperCase() ?? '—'}</td>
              <td>{fmtSize(o.size)}</td>
              <td>{o.uploaded ? String(o.uploaded).slice(0, 16).replace('T', ' ') : '—'}</td>
              <td>
                <div className="row-actions">
                  <button className="btn btn-dark btn-xs" onClick={() => { navigator.clipboard?.writeText(`${location.origin}${o.url}`).catch(() => null) }}>Copy URL</button>
                  <button
                    className="btn-danger"
                    onClick={async () => {
                      if (!confirm(`Delete ${o.key} from storage?`)) return
                      await adminDeleteR2Object({ data: o.key })
                      router.invalidate()
                    }}
                  >Delete</button>
                </div>
              </td>
            </tr>
          ))}
          {objects.length === 0 && data?.ok && (
            <tr><td colSpan={5} style={{ textAlign: 'center', padding: 30 }}>No files in storage yet. Upload one above.</td></tr>
          )}
        </tbody>
      </table>
    </div>
  )
}
