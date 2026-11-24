import { useCallback, useEffect, useReducer, useRef, useState } from 'react'
import { getPasscode } from './api'
import { initial, reducer } from './recorderState'
import type { ServerEvent } from './recorderState'

interface Live {
  ws?: WebSocket
  ctx?: AudioContext
  stream?: MediaStream
  node?: AudioWorkletNode
}

function releaseMic(live: Live) {
  live.stream?.getTracks().forEach((t) => t.stop())
  if (live.ctx && live.ctx.state !== 'closed') void live.ctx.close()
  live.stream = live.ctx = live.node = undefined
}

function micError(error: unknown): string {
  const name = error instanceof DOMException ? error.name : ''
  if (name === 'NotAllowedError') return 'Microphone access was blocked. Allow it and try again.'
  if (name === 'NotFoundError') return 'No microphone was found.'
  return 'Could not start the microphone.'
}

export function useRecorder() {
  const [state, dispatch] = useReducer(reducer, initial)
  const [elapsed, setElapsed] = useState(0)
  const [level, setLevel] = useState(0)
  const ref = useRef<Live>({})

  const start = useCallback(async (title: string) => {
    const live: Live = {}
    ref.current = live
    dispatch({ type: 'connect' })
    setElapsed(0)
    try {
      if (!navigator.mediaDevices) throw new Error('insecure context')
      live.stream = await navigator.mediaDevices.getUserMedia({
        audio: { channelCount: 1, echoCancellation: true, noiseSuppression: true },
      })
      live.ctx = new AudioContext()
      await live.ctx.resume()
      await live.ctx.audioWorklet.addModule('/pcm-worklet.js')
    } catch (error) {
      releaseMic(live)
      dispatch({ type: 'error', message: micError(error) })
      dispatch({ type: 'closed' })
      return
    }
    if (ref.current !== live) return releaseMic(live) // page was left meanwhile

    const scheme = location.protocol === 'https:' ? 'wss' : 'ws'
    const ws = new WebSocket(`${scheme}://${location.host}/ws/transcribe`)
    ws.binaryType = 'arraybuffer'
    live.ws = ws
    ws.onopen = () =>
      ws.send(JSON.stringify({ type: 'start', passcode: getPasscode(), title }))
    ws.onmessage = (message) => {
      const event = JSON.parse(message.data) as ServerEvent
      if (event.type === 'error' && event.code === 'passcode')
        window.dispatchEvent(new Event('passcode-required'))
      dispatch(event)
      if (event.type === 'limit') releaseMic(live)
      if (event.type !== 'ready' || !live.ctx || !live.stream) return
      const node = new AudioWorkletNode(live.ctx, 'pcm-worklet')
      live.node = node
      let sent = 0
      node.port.onmessage = ({ data }) => {
        if (ws.readyState !== WebSocket.OPEN) return
        if (data === 'flushed') {
          ws.send(JSON.stringify({ type: 'stop' }))
          releaseMic(live)
          return
        }
        ws.send(data)
        const pcm = new Int16Array(data as ArrayBuffer)
        sent += pcm.length
        setElapsed(sent / 16)
        let peak = 0
        for (const v of pcm) peak = Math.max(peak, Math.abs(v))
        setLevel(peak / 32768)
      }
      live.ctx.createMediaStreamSource(live.stream).connect(node)
      node.connect(live.ctx.destination) // outputs silence; keeps the graph running
    }
    ws.onclose = () => {
      releaseMic(live)
      setLevel(0)
      if (ref.current === live) dispatch({ type: 'closed' })
    }
  }, [])

  const stop = useCallback(() => {
    dispatch({ type: 'stopping' })
    setLevel(0)
    const { node, ws } = ref.current
    if (node) node.port.postMessage('flush') // sends the last partial chunk, then "stop"
    else if (ws?.readyState === WebSocket.OPEN) ws.send(JSON.stringify({ type: 'stop' }))
  }, [])

  useEffect(
    () => () => {
      const live = ref.current
      ref.current = {}
      releaseMic(live)
      live.ws?.close()
    },
    [],
  )

  return { state, elapsed, level, start, stop }
}
