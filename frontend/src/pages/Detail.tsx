import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { api, clock } from '../api'
import { speak, stopSpeaking } from '../speech'

function Editable({ value, label, multiline, onSave }: {
  value: string; label: string; multiline?: boolean; onSave: (v: string) => Promise<unknown>
}) {
  const [draft, setDraft] = useState<string | null>(null)
  if (draft === null)
    return (
      <div className="flex items-start gap-3">
        <span className="min-w-0 flex-1 break-words">{value}</span>
        <button className="btn" aria-label={`Edit ${label}`} onClick={() => setDraft(value)}>Edit</button>
      </div>
    )
  const save = () => onSave(draft.trim()).then(() => setDraft(null), () => {})
  return (
    <form className="space-y-2" onSubmit={(e) => { e.preventDefault(); void save() }}>
      {multiline
        ? <textarea autoFocus rows={3} aria-label={label} className="field" value={draft} onChange={(e) => setDraft(e.target.value)} />
        : <input autoFocus maxLength={200} aria-label={label} className="field" value={draft} onChange={(e) => setDraft(e.target.value)} />}
      <div className="flex gap-2">
        <button className="btn btn-primary" disabled={!draft.trim()}>Save</button>
        <button type="button" className="btn" onClick={() => setDraft(null)}>Cancel</button>
      </div>
    </form>
  )
}

export default function Detail() {
  const id = useParams().id!
  const navigate = useNavigate()
  const queries = useQueryClient()
  const [speaking, setSpeaking] = useState(false)
  const [note, setNote] = useState<string | null>(null)
  const { data, error } = useQuery({ queryKey: ['item', id], queryFn: () => api.get(id) })
  const edit = useMutation({
    mutationFn: (job: () => Promise<unknown>) => job(),
    onSuccess: () => Promise.all([
      queries.invalidateQueries({ queryKey: ['item', id] }),
      queries.invalidateQueries({ queryKey: ['list'] }),
    ]),
  })
  const remove = useMutation({
    mutationFn: () => api.remove(id),
    onSuccess: async () => {
      await queries.invalidateQueries({ queryKey: ['list'] })
      navigate('/history')
    },
  })
  useEffect(() => stopSpeaking, [])

  if (error) return <p role="alert" className="text-danger">{error.message}</p>
  if (!data) return <p className="text-muted">Loading…</p>

  const texts = data.segments.map((s) => s.text)
  const readAloud = async () => {
    if (speaking) { stopSpeaking(); setSpeaking(false); return }
    setSpeaking(true)
    setNote(await speak(texts, () => setSpeaking(false)))
  }
  const copy = () => navigator.clipboard.writeText(texts.join('\n'))
    .then(() => setNote('Copied.'), () => setNote('Could not copy.'))
  const download = () => {
    const url = URL.createObjectURL(new Blob(['\ufeff', texts.join('\n')], { type: 'text/plain;charset=utf-8' }))
    const a = document.createElement('a')
    a.href = url
    a.download = `${data.title.replace(/[\\/:*?"<>|]/g, '-')}.txt`
    a.click()
    setTimeout(() => URL.revokeObjectURL(url), 1000)
  }
  const problem = edit.error ?? remove.error

  return (
    <>
      <h1 className="mb-1 text-2xl font-bold">
        <Editable label="title" value={data.title} onSave={(v) => edit.mutateAsync(() => api.rename(id, v))} />
      </h1>
      <p className="mb-4 text-sm text-muted">
        {new Date(data.created_at).toLocaleString()} · {clock(data.duration_ms)} · {data.status}
      </p>
      <div className="mb-4 flex flex-wrap gap-2">
        <button className="btn btn-primary" disabled={!texts.length} onClick={() => void readAloud()}>{speaking ? 'Stop reading' : 'Read aloud'}</button>
        <button className="btn" disabled={!texts.length} onClick={() => void copy()}>Copy</button>
        <button className="btn" disabled={!texts.length} onClick={download}>Download .txt</button>
        <button className="btn btn-danger" disabled={remove.isPending} onClick={() => confirm('Delete this transcription?') && remove.mutate()}>Delete</button>
      </div>
      {note && <p role="status" className="mb-3 text-sm">{note}</p>}
      {problem && <p role="alert" className="mb-3 text-sm text-danger">{problem.message}</p>}
      {!texts.length && <p className="text-muted">No text was captured.</p>}
      <ol className="divide-y divide-line border-y border-line empty:hidden">
        {data.segments.map((s) => (
          <li key={s.id} className="py-4">
            <div className="mb-1 flex items-center gap-3 text-sm text-muted">
              <span className="tabular-nums">{clock(s.start_ms)}–{clock(s.end_ms)}</span>
              {s.text !== s.original_text && <span title={s.original_text}>edited</span>}
              <button className="ml-auto cursor-pointer text-danger hover:underline" aria-label={`Delete segment ${s.seq}`}
                onClick={() => confirm('Delete this segment?') && edit.mutate(() => api.removeSegment(id, s.id))}>Remove</button>
            </div>
            <Editable multiline label={`segment ${s.seq}`} value={s.text}
              onSave={(v) => edit.mutateAsync(() => api.editSegment(id, s.id, v))} />
          </li>
        ))}
      </ol>
    </>
  )
}
