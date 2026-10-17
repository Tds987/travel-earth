import { useEffect, useRef, useState } from 'react'

// Web Speech API (Safari on iPhone ships it as webkitSpeechRecognition).
type Recognition = {
  lang: string
  continuous: boolean
  interimResults: boolean
  start: () => void
  stop: () => void
  onresult:
    | ((e: {
        resultIndex: number
        results: ArrayLike<{ isFinal: boolean; 0: { transcript: string } }>
      }) => void)
    | null
  onend: (() => void) | null
  onerror: ((e: { error: string }) => void) | null
}

const Ctor =
  (window as unknown as Record<string, new () => Recognition>).SpeechRecognition ??
  (window as unknown as Record<string, new () => Recognition>).webkitSpeechRecognition

export const dictationSupported = Boolean(Ctor)

/** Talk to type: final phrases are appended through `onText`. */
export function useDictation(onText: (text: string) => void) {
  const [listening, setListening] = useState(false)
  const [interim, setInterim] = useState('')
  const [error, setError] = useState<string | null>(null)
  const rec = useRef<Recognition | null>(null)
  const onTextRef = useRef(onText)
  useEffect(() => {
    onTextRef.current = onText
  })

  useEffect(() => () => rec.current?.stop(), [])

  const start = () => {
    if (!Ctor) return
    setError(null)
    const r = new Ctor()
    r.lang = 'en-US'
    r.continuous = true
    r.interimResults = true
    r.onresult = (e) => {
      let live = ''
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const res = e.results[i]
        if (res.isFinal) onTextRef.current(res[0].transcript.trim())
        else live += res[0].transcript
      }
      setInterim(live)
    }
    r.onerror = (e) =>
      setError(
        e.error === 'not-allowed' ? 'Allow microphone access to dictate.' : 'Dictation stopped.',
      )
    r.onend = () => {
      setListening(false)
      setInterim('')
    }
    rec.current = r
    r.start()
    setListening(true)
  }

  const stop = () => rec.current?.stop()

  return { listening, interim, error, start, stop }
}
