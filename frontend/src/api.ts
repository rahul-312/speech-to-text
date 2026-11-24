export type Status = 'recording' | 'completed' | 'interrupted'
export interface Segment {
  id: number
  seq: number
  text: string
  original_text: string
  start_ms: number
  end_ms: number
}
interface Base {
  id: string
  title: string
  status: Status
  duration_ms: number
  created_at: string
}
export interface ListItem extends Base { preview: string | null }
export interface Transcription extends Base { segments: Segment[] }
export interface Page { count: number; next: string | null; previous: string | null; results: ListItem[] }

export class ApiError extends Error {
  status: number
  constructor(status: number, message: string) {
    super(message)
    this.status = status
  }
}

const KEY = 'stt-passcode'
export const getPasscode = () => sessionStorage.getItem(KEY) ?? ''
export const setPasscode = (value: string) => sessionStorage.setItem(KEY, value)

async function request<T>(path: string, method = 'GET', body?: unknown): Promise<T> {
  const res = await fetch(`/api/${path}`, {
    method,
    headers: {
      // Headers must be ASCII; a non-ASCII passcode would make fetch throw.
      'X-Passcode': getPasscode().replace(/[^\x20-\x7e]/g, ''),
      ...(body !== undefined && { 'Content-Type': 'application/json' }),
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  })
  if (res.status === 403) window.dispatchEvent(new Event('passcode-required'))
  if (!res.ok) {
    const data = await res.json().catch(() => null)
    const first = data && Object.values(data).flat()[0]
    throw new ApiError(res.status, typeof first === 'string' ? first : `Request failed (${res.status})`)
  }
  return res.status === 204 ? (undefined as T) : res.json()
}

export const api = {
  list: (search: string, page: number) =>
    request<Page>(`transcriptions?${new URLSearchParams({ search, page: String(page) })}`),
  get: (id: string) => request<Transcription>(`transcriptions/${id}`),
  create: (title: string, text: string) =>
    request<Transcription>('transcriptions', 'POST', { title, text }),
  rename: (id: string, title: string) =>
    request<Transcription>(`transcriptions/${id}`, 'PATCH', { title }),
  remove: (id: string) => request<void>(`transcriptions/${id}`, 'DELETE'),
  editSegment: (id: string, segment: number, text: string) =>
    request<Segment>(`transcriptions/${id}/segments/${segment}`, 'PATCH', { text }),
  removeSegment: (id: string, segment: number) =>
    request<void>(`transcriptions/${id}/segments/${segment}`, 'DELETE'),
}

export const clock = (ms: number) => {
  const s = Math.floor(ms / 1000)
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`
}
