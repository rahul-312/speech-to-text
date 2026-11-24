export type Phase = 'idle' | 'connecting' | 'recording' | 'stopping' | 'done'
export interface RecorderState {
  phase: Phase
  id: string | null
  maxMs: number
  finals: { id: number; text: string }[]
  interim: string
  limited: boolean
  interrupted: boolean
  error: string | null
}
export type ServerEvent =
  | { type: 'ready'; id: string; max_ms: number }
  | { type: 'interim'; text: string }
  | { type: 'final'; segment: { id: number; seq: number; text: string } }
  | { type: 'limit' }
  | { type: 'error'; message: string; code?: string }
  | { type: 'done'; id: string; status: string }
export type Action =
  | ServerEvent
  | { type: 'connect' }
  | { type: 'stopping' }
  | { type: 'closed' }

export const initial: RecorderState = {
  phase: 'idle', id: null, maxMs: 540_000, finals: [], interim: '',
  limited: false, interrupted: false, error: null,
}

export function reducer(s: RecorderState, a: Action): RecorderState {
  switch (a.type) {
    case 'connect': return { ...initial, phase: 'connecting' }
    case 'ready': return { ...s, phase: 'recording', id: a.id, maxMs: a.max_ms }
    case 'interim': return { ...s, interim: a.text }
    case 'final': return { ...s, interim: '', finals: [...s.finals, a.segment] }
    case 'stopping': return s.phase === 'recording' ? { ...s, phase: 'stopping' } : s
    case 'limit': return { ...s, limited: true, phase: 'stopping' }
    case 'error': return { ...s, error: a.message }
    case 'done': return { ...s, phase: 'done', interim: '', interrupted: a.status !== 'completed' }
    case 'closed':
      if (s.phase === 'done') return s
      return {
        ...s,
        phase: s.id ? 'done' : 'idle',
        interrupted: s.id !== null,
        error: s.error ?? 'Connection lost. Finalized text was saved.',
      }
  }
}
