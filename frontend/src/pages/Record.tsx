import { useQueryClient } from '@tanstack/react-query'
import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { clock } from '../api'
import { useRecorder } from '../useRecorder'

export default function Record() {
  const { state, elapsed, level, start, stop } = useRecorder()
  const [title, setTitle] = useState('')
  const [slow, setSlow] = useState(false)
  const end = useRef<HTMLDivElement>(null)
  const queries = useQueryClient()
  const { phase } = state
  const busy = phase !== 'idle' && phase !== 'done'
  const left = state.maxMs - elapsed

  useEffect(() => { end.current?.scrollIntoView({ block: 'nearest' }) }, [state.finals, state.interim])
  useEffect(() => {
    if (phase === 'done') void queries.invalidateQueries({ queryKey: ['list'] })
    if (phase !== 'connecting') return
    const timer = setTimeout(() => setSlow(true), 4000)
    return () => { clearTimeout(timer); setSlow(false) }
  }, [phase, queries])

  return (
    <>
      <h1 className="mb-4 text-2xl font-bold">Speak, and see it written</h1>
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <input aria-label="Title (optional)" placeholder="Title (optional)" maxLength={200} disabled={busy}
          className="field flex-1 basis-56" value={title} onChange={(e) => setTitle(e.target.value)} />
        {phase === 'recording' || phase === 'stopping' ? (
          <button className="btn btn-danger px-5 py-2" onClick={stop} disabled={phase === 'stopping'}>
            {phase === 'stopping' ? 'Finishing…' : 'Stop'}
          </button>
        ) : (
          <button className="btn btn-primary px-5 py-2" disabled={busy} onClick={() => void start(title)}>
            {phase === 'connecting' ? 'Connecting…' : 'Start recording'}
          </button>
        )}
      </div>

      <div className="mb-3 flex items-center gap-3 text-sm text-muted">
        <span className="tabular-nums">{clock(elapsed)} / {clock(state.maxMs)}</span>
        <div className="h-1.5 flex-1 overflow-hidden rounded bg-line" aria-hidden="true">
          <div className="h-full bg-accent" style={{ width: `${Math.min(100, level * 140)}%` }} />
        </div>
      </div>
      {phase === 'recording' && left <= 60_000 && (
        <p role="status" className="mb-3 text-sm text-danger">Recording stops in {clock(Math.max(0, left))}</p>
      )}
      {slow && <p role="status" className="mb-3 text-sm text-muted">The server may be waking up. This can take a minute.</p>}
      {state.error && <p role="alert" className="mb-3 text-sm text-danger">{state.error}</p>}
      {state.limited && <p role="status" className="mb-3 text-sm">Reached the {clock(state.maxMs)} limit.</p>}

      <section aria-label="Live transcript" aria-live="polite"
        className="h-[50vh] overflow-y-auto rounded-lg border border-line bg-white p-5 text-lg leading-relaxed">
        {!state.finals.length && !state.interim && (
          <p className="text-muted">{phase === 'recording' ? 'Listening…' : 'Your words appear here. Mix Hindi and English freely.'}</p>
        )}
        {state.finals.map((f) => <span key={f.id}>{f.text} </span>)}
        {state.interim && <span className="text-muted">{state.interim}</span>}
        <div ref={end} />
      </section>
      {phase === 'done' && state.id && (
        <p className="mt-4">
          {state.interrupted ? 'Recording was interrupted; the text so far was saved. ' : 'Saved. '}
          <Link className="text-accent underline" to={`/history/${state.id}`}>Open transcription</Link>
        </p>
      )}
    </>
  )
}
