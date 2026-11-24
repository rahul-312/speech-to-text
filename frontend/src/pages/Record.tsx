import { useQueryClient } from '@tanstack/react-query'
import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { clock } from '../api'
import { Chevron, Letter, Mic, Page, Square, Wave } from '../icons'
import { useRecorder } from '../useRecorder'

export default function Record() {
  const { state, elapsed, level, start, stop } = useRecorder()
  const [title, setTitle] = useState('')
  const [slow, setSlow] = useState(false)
  const box = useRef<HTMLElement>(null)
  const queries = useQueryClient()
  const { phase } = state
  const busy = phase !== 'idle' && phase !== 'done'
  const active = phase === 'recording' || phase === 'stopping'
  const locked = phase === 'connecting' || phase === 'stopping'
  const toggle = () => { if (active) stop(); else void start(title) }
  const left = state.maxMs - elapsed

  useEffect(() => { box.current?.scrollTo({ top: box.current.scrollHeight }) }, [state.finals, state.interim])
  useEffect(() => {
    if (phase === 'done') void queries.invalidateQueries({ queryKey: ['list'] })
    if (phase !== 'connecting') return
    const timer = setTimeout(() => setSlow(true), 4000)
    return () => { clearTimeout(timer); setSlow(false) }
  }, [phase, queries])

  return (
    <>
      <div className="mb-8 text-center">
        <div className="relative isolate mx-auto mt-5 mb-11 grid size-18 place-items-center rounded-2xl bg-linear-to-b from-[#d3e8df] to-[#c3ded3] text-accent">
          <span aria-hidden="true" className="absolute -inset-4 -z-10 rounded-full bg-accent/5 transition-transform duration-150 motion-reduce:transition-none"
            style={{ transform: phase === 'recording' ? `scale(${1 + Math.min(0.28, level * 0.5)})` : undefined }} />
          <span aria-hidden="true" className="absolute -inset-8 -z-20 rounded-full bg-accent/4" />
          {phase === 'recording' && [0, 1].map((i) => (
            <span key={i} aria-hidden="true" className="mic-ripple absolute -inset-4 -z-20 rounded-full bg-accent/15"
              style={{ animationDelay: `${i}s` }} />
          ))}
          <Mic className="size-11" />
        </div>
        <h1 className="text-3xl font-bold sm:text-4xl">Your voice, <span className="text-accent">your words.</span></h1>
        <p className="mt-2 text-lg text-muted">Turn conversations into text, effortlessly.</p>
      </div>
      <div className="mx-auto mb-5 flex max-w-4xl flex-wrap items-center gap-4 rounded-3xl border border-line bg-white p-4 shadow-xl shadow-ink/5">
        <div className="relative flex-1 basis-56">
          <span className="pointer-events-none absolute left-4 top-1/2 grid size-9 -translate-y-1/2 place-items-center rounded-full bg-ink/5 text-muted">
            <Letter className="size-5" />
          </span>
          <input aria-label="Title (optional)" placeholder="Title (optional)..." maxLength={200} disabled={busy}
            className="field rounded-3xl border-accent/25 py-4 pl-16" value={title} onChange={(e) => setTitle(e.target.value)} />
        </div>
        <div className="grid h-14 place-items-center border-x border-line px-4 max-sm:hidden" aria-hidden="true">
          <Wave className="size-9 text-[#3cc8a0] transition-transform duration-150 motion-reduce:transition-none"
            style={{ transform: phase === 'recording' ? `scaleY(${0.6 + Math.min(0.7, level * 1.4)})` : undefined }} />
        </div>
        <button className={`btn flex items-center justify-center gap-3 rounded-3xl px-6 py-4 text-base shadow-lg max-sm:w-full ${active
          ? 'btn-danger shadow-danger/10'
          : 'border-transparent bg-linear-to-br from-[#25a57c] to-[#0b5c46] text-white shadow-accent/30 hover:border-transparent hover:brightness-110'}`}
          disabled={locked} onClick={toggle}>
          {active ? <Square className="size-5" /> : <Mic className="size-6" />}
          <span>{phase === 'connecting' ? 'Connecting…' : phase === 'stopping' ? (state.polishing ? 'Polishing…' : 'Finishing…') : active ? 'Stop Recording' : 'Start Recording'}</span>
          {!active && <Chevron className="ml-2 size-5" />}
        </button>
      </div>
      <div className="mx-auto max-w-4xl rounded-3xl border border-line bg-white p-4 shadow-xl shadow-ink/5">
      {active && (
      <div className="mb-4 flex items-center gap-4 px-1 text-sm">
        <button aria-label="Stop" disabled={locked} onClick={toggle}
          className="grid size-9 cursor-pointer place-items-center rounded-full bg-accent/10 text-accent hover:bg-accent/20 disabled:cursor-default disabled:opacity-50">
          <Square className="size-4" />
        </button>
        <span className="tabular-nums">{clock(elapsed)} / {clock(state.maxMs)}</span>
        <div className="h-2.5 flex-1 overflow-hidden rounded-full bg-line" aria-hidden="true">
          <div className="h-full rounded-full bg-accent transition-[width]" style={{ width: `${Math.min(100, (elapsed / state.maxMs) * 100)}%` }} />
        </div>
        {phase === 'recording' && (
          <Mic className="size-5 text-accent" style={{ opacity: 0.25 + Math.min(0.75, level * 2) }} />
        )}
      </div>
      )}
      {phase === 'recording' && left <= 60_000 && (
        <p role="status" className="mb-3 text-sm text-danger">Recording stops in {clock(Math.max(0, left))}</p>
      )}
      {slow && <p role="status" className="mb-3 text-sm text-muted">The server may be waking up. This can take a minute.</p>}
      {state.error && <p role="alert" className="mb-3 text-sm text-danger">{state.error}</p>}
      {state.limited && <p role="status" className="mb-3 text-sm">Reached the {clock(state.maxMs)} limit.</p>}

      <section ref={box} aria-label="Live transcript" aria-live="polite"
        className="h-[26vh] min-h-56 overflow-y-auto rounded-xl border border-dashed border-line bg-paper p-5 text-lg leading-relaxed">
        {!state.finals.length && !state.interim && (
          <div className="grid h-full place-content-center justify-items-center text-center">
            <Page className="mb-3 w-21" />
            <p className="font-semibold">{phase === 'recording' ? 'Listening…' : 'Ready when you are.'}</p>
            <p className="text-base text-muted">Your transcript will appear here as you speak.</p>
            <p className="text-base text-muted">Speak naturally in Hindi, English, or both.</p>
          </div>
        )}
        {state.finals.map((f) => <span key={f.id}>{f.text} </span>)}
        {state.interim && <span className="text-muted">{state.interim}</span>}
      </section>
      </div>
      {phase === 'done' && state.id && (
        <p className="mt-4">
          {state.interrupted ? 'Recording was interrupted; the text so far was saved. ' : 'Saved. '}
          <Link className="text-accent underline" to={`/history/${state.id}`}>Open transcription</Link>
        </p>
      )}
    </>
  )
}
