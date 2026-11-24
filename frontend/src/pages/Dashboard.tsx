import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useEffect, useState } from 'react'
import type { FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { api, clock } from '../api'

export default function Dashboard() {
  const [input, setInput] = useState('')
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)
  const [adding, setAdding] = useState(false)
  const [title, setTitle] = useState('')
  const [text, setText] = useState('')
  const queries = useQueryClient()

  useEffect(() => {
    const timer = setTimeout(() => {
      if (input !== search) { setSearch(input); setPage(1) }
    }, 300)
    return () => clearTimeout(timer)
  }, [input, search])

  const { data, error, isPending } = useQuery({
    queryKey: ['list', search, page],
    queryFn: () => api.list(search, page),
    placeholderData: keepPreviousData,
  })
  const refresh = () => queries.invalidateQueries({ queryKey: ['list'] })
  const remove = useMutation({
    mutationFn: api.remove,
    onSuccess: () => {
      if (data?.results.length === 1 && page > 1) setPage(page - 1)
      return refresh()
    },
  })
  const create = useMutation({
    mutationFn: () => api.create(title, text),
    onSuccess: () => { setAdding(false); setTitle(''); setText(''); return refresh() },
  })
  const submit = (e: FormEvent) => { e.preventDefault(); create.mutate() }
  const problem = error ?? remove.error ?? create.error

  return (
    <>
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <h1 className="mr-auto text-2xl font-bold">History</h1>
        <button className="btn" onClick={() => setAdding(!adding)}>{adding ? 'Cancel' : 'Add manually'}</button>
      </div>
      {adding && (
        <form onSubmit={submit} className="mb-6 space-y-3 rounded-lg border border-line bg-white p-4">
          <input aria-label="Title" placeholder="Title" required maxLength={200} className="field" value={title} onChange={(e) => setTitle(e.target.value)} />
          <textarea aria-label="Text" placeholder="Text" rows={3} className="field" value={text} onChange={(e) => setText(e.target.value)} />
          <button className="btn btn-primary" disabled={create.isPending}>Save</button>
        </form>
      )}
      <input type="search" aria-label="Search" placeholder="Search titles and text" className="field mb-4" value={input} onChange={(e) => setInput(e.target.value)} />
      {problem && <p role="alert" className="mb-3 text-sm text-danger">{problem.message}</p>}
      {isPending && !error && <p className="text-muted">Loading…</p>}
      {data?.count === 0 && (
        <p className="text-muted">{search ? 'Nothing matches your search.' : 'No transcriptions yet.'}</p>
      )}
      <ul className="divide-y divide-line border-y border-line empty:hidden">
        {data?.results.map((item) => (
          <li key={item.id} className="flex items-start gap-4 py-4">
            <Link to={`/history/${item.id}`} className="min-w-0 flex-1">
              <span className="block truncate font-semibold">{item.title}</span>
              <span className="block truncate text-muted">{item.preview ?? 'No text'}</span>
              <span className="text-sm text-muted">
                {new Date(item.created_at).toLocaleString()} · {clock(item.duration_ms)}
                {item.status !== 'completed' && ` · ${item.status}`}
              </span>
            </Link>
            <button className="btn btn-danger" disabled={remove.isPending} aria-label={`Delete ${item.title}`}
              onClick={() => confirm(`Delete "${item.title}"?`) && remove.mutate(item.id)}>Delete</button>
          </li>
        ))}
      </ul>
      {data && (data.next || data.previous) && (
        <div className="mt-4 flex items-center gap-3">
          <button className="btn" disabled={!data.previous} onClick={() => setPage(page - 1)}>Previous</button>
          <span className="text-sm text-muted">Page {page}</span>
          <button className="btn" disabled={!data.next} onClick={() => setPage(page + 1)}>Next</button>
        </div>
      )}
    </>
  )
}
