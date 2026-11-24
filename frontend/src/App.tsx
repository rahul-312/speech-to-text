import { useQueryClient } from '@tanstack/react-query'
import { useEffect, useState } from 'react'
import type { FormEvent } from 'react'
import { Link, NavLink, Route, Routes } from 'react-router-dom'
import { api, setPasscode } from './api'
import Dashboard from './pages/Dashboard'
import Detail from './pages/Detail'
import Record from './pages/Record'

function PasscodeDialog({ onDone }: { onDone: () => void }) {
  const [value, setValue] = useState('')
  const [error, setError] = useState('')
  const submit = async (e: FormEvent) => {
    e.preventDefault()
    setPasscode(value)
    try {
      await api.list('', 1)
      onDone()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not sign in')
    }
  }
  return (
    <div role="dialog" aria-modal="true" aria-labelledby="pc" className="fixed inset-0 z-10 grid place-items-center bg-ink/40 p-4">
      <form onSubmit={submit} className="w-full max-w-sm rounded-lg bg-white p-6">
        <label id="pc" htmlFor="passcode" className="font-semibold">Enter the passcode</label>
        <input id="passcode" autoFocus type="password" className="field my-3" value={value} onChange={(e) => setValue(e.target.value)} />
        {error && <p role="alert" className="mb-3 text-sm text-danger">{error}</p>}
        <button className="btn btn-primary">Continue</button>
      </form>
    </div>
  )
}

export default function App() {
  const [locked, setLocked] = useState(false)
  const queries = useQueryClient()
  useEffect(() => {
    const lock = () => setLocked(true)
    window.addEventListener('passcode-required', lock)
    api.list('', 1).catch(() => {}) // asks for the passcode up front, before recording
    return () => window.removeEventListener('passcode-required', lock)
  }, [])
  const tab = ({ isActive }: { isActive: boolean }) =>
    `py-3 border-b-2 ${isActive ? 'border-accent font-semibold' : 'border-transparent text-muted'}`
  return (
    <>
      <header className="border-b border-line bg-white">
        <nav className="mx-auto flex max-w-3xl items-center gap-6 px-4">
          <Link to="/" className="mr-auto font-bold">Speech to Text</Link>
          <NavLink to="/" end className={tab}>Record</NavLink>
          <NavLink to="/history" className={tab}>History</NavLink>
        </nav>
      </header>
      <main className="mx-auto max-w-3xl px-4 py-8">
        <Routes>
          <Route path="/" element={<Record />} />
          <Route path="/history" element={<Dashboard />} />
          <Route path="/history/:id" element={<Detail />} />
          <Route path="*" element={<p>Page not found.</p>} />
        </Routes>
      </main>
      {locked && <PasscodeDialog onDone={() => { setLocked(false); void queries.invalidateQueries() }} />}
    </>
  )
}
