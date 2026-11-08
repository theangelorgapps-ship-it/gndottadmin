import { readFileSync } from 'node:fs'

const fails = []
const s = readFileSync('src/routes/admin/settings.tsx', 'utf8')
if (!s.includes('uploadSettingImage')) fails.push('settings has no upload handler for image fields')
if (!/kind === 'image'[\s\S]*Upload/.test(s)) fails.push('image fields render no Upload control')
const css = readFileSync('src/styles.css', 'utf8')
if (!css.includes('.img-preview-lg')) fails.push('styles.css missing enlarged preview class .img-preview-lg')
if (fails.length) { console.error(fails.join('\n')); process.exit(1) }
console.log('imgupload ok')
