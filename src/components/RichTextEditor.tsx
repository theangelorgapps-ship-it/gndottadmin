import { useEffect, useId, useRef, useState } from 'react'
import { EditorContent, useEditor, useEditorState, type Editor } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import Placeholder from '@tiptap/extension-placeholder'
import { Bold, Italic, Underline, List, ListOrdered, Quote, Link as LinkIcon, Undo2, Redo2, RemoveFormatting, Unlink } from 'lucide-react'
import { sanitizeContentHtml } from '../lib/rich-text'
import '../rich-text-editor.css'

type Props = { id: string; label: string; value: string; onChange: (html: string) => void; disabled?: boolean; required?: boolean; initialFocus?: boolean; placeholder?: string }

function editorState(current: Editor | null) {
  if (!current) return null
  const { $from } = current.state.selection
  const block = $from.depth ? $from.parent : current.state.doc.firstChild
  return {
    bold: current.isActive('bold'), italic: current.isActive('italic'), underline: current.isActive('underline'),
    bullets: current.isActive('bulletList'), ordered: current.isActive('orderedList'), quote: current.isActive('blockquote'), link: current.isActive('link'),
    heading: block?.type.name === 'heading' ? String(block.attrs.level) : 'p',
    undo: current.can().undo(), redo: current.can().redo(), words: current.getText().trim().split(/\s+/).filter(Boolean).length,
  }
}

/** Semantic HTML editor with native keyboard shortcuts, accessible controls, and safe paste/save markup. */
export function RichTextEditor({ id, label, value, onChange, disabled = false, required = false, initialFocus = false, placeholder = 'Write your content…' }: Props) {
  const helpId = useId(); const linkId = useId(); const onChangeRef = useRef(onChange)
  onChangeRef.current = onChange
  const [linkOpen, setLinkOpen] = useState(false); const [link, setLink] = useState(''); const [error, setError] = useState('')
  const editor = useEditor({
    extensions: [StarterKit.configure({ link: { openOnClick: false, autolink: false, protocols: ['mailto'], HTMLAttributes: { rel: 'noopener noreferrer', target: '_blank' } } }), Placeholder.configure({ placeholder })],
    content: sanitizeContentHtml(value), immediatelyRender: false, editable: !disabled,
    editorProps: {
      attributes: { id, role: 'textbox', 'aria-label': label, 'aria-multiline': 'true', 'aria-required': String(required), 'aria-describedby': helpId, ...(initialFocus ? { 'data-initial-focus': 'true' } : {}) },
      transformPastedHTML: html => sanitizeContentHtml(html),
    },
    onUpdate: ({ editor: current }) => onChangeRef.current(current.isEmpty ? '' : sanitizeContentHtml(current.getHTML())),
  })
  const selectedState = useEditorState({ editor, selector: ({ editor: current }) => editorState(current) })
  // The first editor instance exists before its first transaction; mount EditorContent immediately.
  const state = selectedState ?? editorState(editor)
  useEffect(() => { if (editor && editor.isEditable === disabled) editor.setEditable(!disabled) }, [editor, disabled])
  useEffect(() => {
    if (!editor) return
    const safe = sanitizeContentHtml(value)
    // Parent echoes of editor changes must not reset the selection or undo history.
    if (safe !== sanitizeContentHtml(editor.getHTML()) && !(safe === '' && editor.isEmpty)) editor.commands.setContent(safe, { emitUpdate: false })
  }, [editor, value])
  function applyLink() {
    if (!editor) return
    const raw = link.trim(); const href = /^[a-z][a-z\d+.-]*:|^\//i.test(raw) ? raw : `https://${raw}`
    if (!raw) { editor.chain().focus().extendMarkRange('link').unsetLink().run(); setLinkOpen(false); return }
    if (!/^(https?:\/\/|mailto:|\/(?!\/))/i.test(href) || /[\x00-\x20]/.test(href)) { setError('Use an https://, http://, mailto: or /page link.'); return }
    if (!editor.chain().focus().extendMarkRange('link').setLink({ href }).run()) { setError('Enter a valid link.'); return }
    setLinkOpen(false); setError('')
  }
  if (!editor || !state) return <div className="rich-text-editor rich-text-loading" role="status">Opening editor…</div>
  const controls = [
    { label: 'Undo', icon: Undo2, run: () => editor.chain().focus().undo().run(), unavailable: !state.undo },
    { label: 'Redo', icon: Redo2, run: () => editor.chain().focus().redo().run(), unavailable: !state.redo },
    { label: 'Bold', icon: Bold, run: () => editor.chain().focus().toggleBold().run(), active: state.bold },
    { label: 'Italic', icon: Italic, run: () => editor.chain().focus().toggleItalic().run(), active: state.italic },
    { label: 'Underline', icon: Underline, run: () => editor.chain().focus().toggleUnderline().run(), active: state.underline },
    { label: 'Bullet list', icon: List, run: () => editor.chain().focus().toggleBulletList().run(), active: state.bullets },
    { label: 'Numbered list', icon: ListOrdered, run: () => editor.chain().focus().toggleOrderedList().run(), active: state.ordered },
    { label: 'Quote', icon: Quote, run: () => editor.chain().focus().toggleBlockquote().run(), active: state.quote },
    { label: 'Clear formatting', icon: RemoveFormatting, run: () => editor.chain().focus().unsetAllMarks().clearNodes().run() },
  ]
  return <div className="rich-text-editor" aria-disabled={disabled || undefined}>
    <div className="rich-text-toolbar" role="group" aria-label={`${label} formatting`}>
      <label className="sr-only" htmlFor={`${id}-format`}>Text style</label><select id={`${id}-format`} value={state.heading} disabled={disabled} onChange={event => { const level = event.target.value; if (level === 'p') editor.chain().focus().setParagraph().run(); else editor.chain().focus().setHeading({ level: Number(level) as 1 | 2 | 3 | 4 | 5 | 6 }).run() }}><option value="p">Paragraph</option>{[1, 2, 3, 4, 5, 6].map(level => <option key={level} value={level}>Heading {level}</option>)}</select>
      {controls.map(control => <button key={control.label} type="button" title={control.label} aria-label={control.label} aria-pressed={control.active} disabled={disabled || control.unavailable} onMouseDown={event => event.preventDefault()} onClick={control.run}><control.icon size={17}/></button>)}
      <button type="button" title="Edit link" aria-label="Edit link" aria-expanded={linkOpen} aria-controls={linkId} aria-pressed={state.link} disabled={disabled} onMouseDown={event => event.preventDefault()} onClick={() => { setLink(editor.getAttributes('link').href ?? ''); setError(''); setLinkOpen(value => !value) }}><LinkIcon size={17}/></button>
      {state.link && <button type="button" title="Remove link" aria-label="Remove link" disabled={disabled} onMouseDown={event => event.preventDefault()} onClick={() => editor.chain().focus().extendMarkRange('link').unsetLink().run()}><Unlink size={17}/></button>}
    </div>
    {linkOpen && <div id={linkId} className="rich-text-link" onKeyDown={event => { if (event.key === 'Escape') { event.preventDefault(); event.stopPropagation(); setLinkOpen(false); editor.commands.focus() } }}><label htmlFor={`${linkId}-url`}>Link address</label><div><input id={`${linkId}-url`} type="url" autoFocus placeholder="https://example.com" value={link} disabled={disabled} onChange={event => setLink(event.target.value)} onKeyDown={event => { if (event.key === 'Enter') { event.preventDefault(); applyLink() } }}/><button type="button" className="btn btn-primary btn-sm" disabled={disabled} onClick={applyLink}>Apply</button><button type="button" className="btn btn-dark btn-sm" onClick={() => { setLinkOpen(false); editor.commands.focus() }}>Cancel</button></div>{error && <p role="alert">{error}</p>}</div>}
    <EditorContent editor={editor}/>
    <div id={helpId} className="rich-text-help"><span>Format text with the toolbar or use ⌘/Ctrl+B and ⌘/Ctrl+I.</span><span>{state.words} {state.words === 1 ? 'word' : 'words'}</span></div>
  </div>
}
