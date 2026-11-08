import { createFileRoute, useRouter } from '@tanstack/react-router'
import { useRef, useState } from 'react'
import { adminListR2Media, adminDeleteR2Object } from '../../lib/admin'
import { useConfirm } from '../../lib/confirm'
import { useToast } from '../../lib/toast'
import { FileUploadCard, type UploadedFile } from '../../components/ui/file-upload-card'

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
  const confirmAction = useConfirm()
  const notify = useToast()
  const [query, setQuery] = useState('')
  const [uploads, setUploads] = useState<UploadedFile[]>([])
  const [error, setError] = useState<string | null>(null)
  const xhrMap = useRef(new Map<string, XMLHttpRequest>())

  const patchUpload = (id: string, patch: Partial<UploadedFile>) =>
    setUploads((prev) => prev.map((u) => (u.id === id ? { ...u, ...patch } : u)))

  function startUploads(newFiles: File[]) {
    for (const f of newFiles) {
      const id = `${f.name}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`
      setUploads((prev) => [...prev, { id, file: f, progress: 0, status: 'uploading' }])
      const fd = new FormData()
      fd.append('file', f)
      const xhr = new XMLHttpRequest()
      xhrMap.current.set(id, xhr)
      xhr.upload.onprogress = (ev) => {
        if (ev.lengthComputable) {
          patchUpload(id, { progress: Math.round((ev.loaded / ev.total) * 100) })
        }
      }
      xhr.onload = () => {
        xhrMap.current.delete(id)
        let json: any = null
        try { json = JSON.parse(xhr.responseText) } catch { /* non-JSON */ }
        if (xhr.status >= 200 && xhr.status < 300 && json?.ok) {
          patchUpload(id, { progress: 100, status: 'completed' })
          notify({ title: 'Upload complete', description: f.name, variant: 'success' })
          router.invalidate()
        } else {
          patchUpload(id, { status: 'error' })
          notify({ title: 'Upload failed', description: json?.error ?? f.name, variant: 'destructive' })
        }
      }
      xhr.onerror = () => {
        xhrMap.current.delete(id)
        patchUpload(id, { status: 'error' })
        notify({ title: 'Upload failed', description: f.name, variant: 'destructive' })
      }
      xhr.open('POST', '/api/upload')
      xhr.send(fd)
    }
  }

  function removeUpload(id: string) {
    xhrMap.current.get(id)?.abort()
    xhrMap.current.delete(id)
    setUploads((prev) => prev.filter((u) => u.id !== id))
  }

  const objects = (data?.objects ?? []).filter((o: any) => o.key.toLowerCase().includes(query.toLowerCase()))
  const isImage = (k: string) => /\.(jpe?g|png|webp|gif|svg)$/i.test(k)

  return (
    <div>
      <div className="breadcrumb">Dashboard <span className="sep">/</span> <span className="here">Media Library</span></div>
      <div className="toolbar">
        <input type="search" placeholder="Search files…" value={query} onChange={(e) => setQuery(e.target.value)} />
        <span className="spacer" />
      </div>
      <FileUploadCard
        files={uploads}
        onFilesChange={startUploads}
        onFileRemove={removeUpload}
        style={{ maxWidth: 'none', marginBottom: 18 }}
      />
      {data?.ok === false && <div className="empty" style={{ padding: 20 }}>{data.error}</div>}
      {error && <div className="error" style={{ marginBottom: 12 }}>{error}</div>}
      {data?.truncated && <p style={{ color: 'var(--muted-2)', fontSize: 13 }}>Showing first 200 objects (bucket has more).</p>}
      <div className="table-scroll">
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
                      const ok = await confirmAction({
                        title: `Delete ${o.key}?`,
                        description: 'The file will be permanently removed from storage.',
                        approveLabel: 'Delete',
                      })
                      if (!ok) return
                      try {
                        await adminDeleteR2Object({ data: o.key })
                        notify({ title: 'File deleted', description: o.key, variant: 'success' })
                        router.invalidate()
                      } catch (e: any) {
                        notify({ title: 'Delete failed', description: e?.message ?? 'Could not delete the file.', variant: 'destructive' })
                      }
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
    </div>
  )
}
