import { expect, test } from 'vitest'
import { initial, reducer } from './recorderState'
import type { Action } from './recorderState'

const run = (...actions: Action[]) => actions.reduce(reducer, initial)
const ready: Action = { type: 'ready', id: 'a', max_ms: 1000 }
const final = (id: number, text: string): Action => ({ type: 'final', segment: { id, seq: id, text } })

test('interims replace each other and a final clears them', () => {
  const s = run({ type: 'connect' }, ready, { type: 'interim', text: 'मैं' },
    { type: 'interim', text: 'मैं office' })
  expect(s.interim).toBe('मैं office')
  const t = reducer(s, final(1, 'मैं office जा रहा हूँ'))
  expect(t.interim).toBe('')
  expect(t.finals.map((f) => f.text)).toEqual(['मैं office जा रहा हूँ'])
})

test('losing the socket keeps text and reports it', () => {
  const s = run({ type: 'connect' }, ready, final(1, 'hi'), { type: 'closed' })
  expect(s.phase).toBe('done')
  expect(s.interrupted).toBe(true)
  expect(s.finals).toHaveLength(1)
  expect(s.error).toMatch(/Connection lost/)
})

test('close after done is not an error, and a new recording resets', () => {
  const s = run({ type: 'connect' }, ready, { type: 'limit' },
    { type: 'done', id: 'a', status: 'completed' }, { type: 'closed' })
  expect(s.error).toBeNull()
  expect(s.limited).toBe(true)
  expect(reducer(s, { type: 'connect' }).limited).toBe(false)
})
