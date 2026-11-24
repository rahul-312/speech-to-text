import { useQueryClient } from '@tanstack/react-query'
import { useEffect, useState } from 'react'
import type { FormEvent } from 'react'
import { Link, NavLink, Route, Routes } from 'react-router-dom'
import { api, setPasscode } from './api'
import { Clock, Mic, Wave, Waves } from './icons'
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
    `flex items-center gap-2 border-b-2 px-3 py-5 text-sm sm:px-6 ${isActive ? 'border-accent font-semibold text-accent' : 'border-transparent hover:text-accent'}`
  return (
    <>
      <Waves />
      <header className="border-b border-line bg-white">
        <nav className="flex items-center gap-2 px-4 sm:px-10">
          <Link to="/" className="mr-auto flex items-center gap-3 text-lg font-semibold">
            <Wave className="size-8 text-accent" />
            <span className="max-sm:sr-only">Speech to Text</span>
          </Link>
          <NavLink to="/" end className={tab}><Mic className="size-5" />Record</NavLink>
          <NavLink to="/history" className={tab}><Clock className="size-5" />History</NavLink>
        </nav>
      </header>
      <main className="mx-auto max-w-5xl px-4 py-8">
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
