import { FolderOpen, Images } from 'lucide-react'
export type GalleryFolder = { folder: string; count: number; cover: string | null }
/** Real catalog covers, with a small lift on hover; no fabricated assets or counts. */
export function InteractiveFolderGallery({ folders, selected, onSelect }: { folders: GalleryFolder[]; selected: string; onSelect: (folder: string) => void }) {
  return <div className="media-folders" aria-label="Media folders">
    <button type="button" className={'media-folder media-folder-all' + (!selected ? ' selected' : '')} onClick={() => onSelect('')} aria-pressed={!selected}>
      <span className="media-folder-cover"><Images size={40} aria-hidden="true"/><span className="media-folder-rim"/></span><span className="media-folder-label"><strong>All files</strong><small>{folders.reduce((n, f) => n + Number(f.count), 0)} files</small></span>
    </button>
    {folders.map(folder => <button type="button" key={folder.folder} className={'media-folder' + (selected === folder.folder ? ' selected' : '')} onClick={() => onSelect(folder.folder)} aria-pressed={selected === folder.folder}>
      <span className="media-folder-cover">{folder.cover ? <img src={folder.cover} alt="" loading="lazy"/> : <FolderOpen size={40} aria-hidden="true"/>}<span className="media-folder-rim"/></span>
      <span className="media-folder-label"><strong>{folder.folder === 'legacy-20261105' ? 'Migrated library' : folder.folder}</strong><small>{folder.count} files</small></span>
    </button>)}
  </div>
}
