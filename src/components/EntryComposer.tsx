import { useEffect, useMemo, useRef, useState } from 'react'
import { dictationSupported, useDictation } from '../journal/dictation'
import { addEntry, type NewEntry } from '../journal/store'

type Props = {
  draft: NewEntry
  heading: string
  onClose: () => void
  onSaved?: () => void
}

/** Write a journal entry: words (typed or dictated), photos and short clips. */
export function EntryComposer({ draft, heading, onClose, onSaved }: Props) {
  const [title, setTitle] = useState(draft.title ?? '')
  const [body, setBody] = useState(draft.body ?? '')
  const [files, setFiles] = useState<File[]>([])
  const [saving, setSaving] = useState(false)
  const [problem, setProblem] = useState<string | null>(null)
  const fileInput = useRef<HTMLInputElement>(null)
  const dictation = useDictation((text) => setBody((b) => (b ? `${b} ${text}` : text)))

  const save = async () => {
    setSaving(true)
    dictation.stop()
    const err = await addEntry(
      { ...draft, title: title.trim() || undefined, body: body.trim() || undefined },
      files,
    )
    setSaving(false)
    if (err) return setProblem(err)
    onSaved?.()
    onClose()
  }

  return (
    <div className="composer" role="dialog" aria-modal="true" aria-labelledby="composer-title">
      <div className="composer__head">
        <button type="button" className="btn btn--quiet" onClick={onClose}>
          Cancel
        </button>
        <h2 id="composer-title" className="composer__title">
          {heading}
        </h2>
        <button type="button" className="btn btn--primary" onClick={save} disabled={saving}>
          {saving ? 'Saving…' : 'Save'}
        </button>
      </div>

      <label className="field">
        <span className="field__label">
          {draft.kind === 'stay' ? 'Where are you staying?' : 'Title'}
        </span>
        <input
          className="field__input"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder={draft.kind === 'stay' ? 'e.g. K’s House Kyoto' : 'Optional'}
        />
      </label>

      <label className="field">
        <span className="field__label">What happened?</span>
        <textarea
          className="field__input field__input--body"
          value={dictation.interim ? `${body} ${dictation.interim}` : body}
          onChange={(e) => setBody(e.target.value)}
          placeholder="Write it down, or tap Talk and say it."
          rows={6}
        />
      </label>

      <div className="composer__tools">
        {dictationSupported ? (
          <button
            type="button"
            className={`btn${dictation.listening ? ' btn--recording' : ''}`}
            onClick={dictation.listening ? dictation.stop : dictation.start}
            aria-pressed={dictation.listening}
          >
            {dictation.listening ? 'Stop talking' : 'Talk'}
          </button>
        ) : (
          <p className="composer__hint">Tip: tap the microphone on your keyboard to dictate.</p>
        )}
        <button type="button" className="btn" onClick={() => fileInput.current?.click()}>
          Add photos or clips
        </button>
        <input
          ref={fileInput}
          type="file"
          accept="image/*,video/*"
          multiple
          hidden
          onChange={(e) => {
            setProblem(null)
            setFiles((f) => [...f, ...Array.from(e.target.files ?? [])])
            e.target.value = ''
          }}
        />
      </div>

      {dictation.error && <p className="composer__problem">{dictation.error}</p>}
      {problem && <p className="composer__problem">{problem}</p>}

      {files.length > 0 && (
        <ul className="thumbs" aria-label="Attached media">
          {files.map((f, i) => (
            <li key={`${f.name}-${i}`} className="thumbs__item">
              <Preview file={f} />
              <button
                type="button"
                className="thumbs__remove"
                aria-label="Remove"
                onClick={() => setFiles((all) => all.filter((_, j) => j !== i))}
              >
                ×
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

function Preview({ file }: { file: File }) {
  const src = useMemo(() => URL.createObjectURL(file), [file])
  useEffect(() => () => URL.revokeObjectURL(src), [src])
  return file.type.startsWith('video/') ? (
    <video src={src} muted playsInline />
  ) : (
    <img src={src} alt="" />
  )
}
