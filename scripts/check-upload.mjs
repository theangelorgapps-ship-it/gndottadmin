import { readFileSync, existsSync } from 'node:fs'

const fails = []
const card = 'src/components/ui/file-upload-card.tsx'
if (!existsSync(card)) fails.push('file-upload-card.tsx missing')
else {
  const src = readFileSync(card, 'utf8')
  for (const n of ['UploadedFile', 'onFilesChange', 'Progress']) {
    if (!src.includes(n)) fails.push(`file-upload-card.tsx missing: ${n}`)
  }
}
const ml = readFileSync('src/routes/admin/media-library.tsx', 'utf8')
if (!ml.includes('file-upload-card')) fails.push('media-library not using FileUploadCard')
if (!ml.includes('XMLHttpRequest')) fails.push('media-library upload has no real progress (XMLHttpRequest)')
if (fails.length) { console.error(fails.join('\n')); process.exit(1) }
console.log('upload ok')
