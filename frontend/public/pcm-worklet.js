// Averages the mic's native rate down to 16 kHz and emits 100 ms Int16 chunks.
const TARGET = 16000
const CHUNK = 1600

class PcmWorklet extends AudioWorkletProcessor {
  constructor() {
    super()
    this.ratio = sampleRate / TARGET
    this.sum = 0
    this.weight = 0
    this.out = new Int16Array(CHUNK)
    this.n = 0
    this.port.onmessage = () => {
      if (this.n) this.port.postMessage(this.out.slice(0, this.n).buffer)
      this.n = 0
      this.port.postMessage('flushed')
    }
  }

  process(inputs) {
    const input = inputs[0][0]
    if (!input) return true
    for (const sample of input) {
      let left = 1 // share of this input sample still to be consumed
      while (this.weight + left >= this.ratio) {
        const take = this.ratio - this.weight
        this.push((this.sum + sample * take) / this.ratio)
        left -= take
        this.sum = 0
        this.weight = 0
      }
      this.sum += sample * left
      this.weight += left
    }
    return true
  }

  push(value) {
    const v = Math.max(-1, Math.min(1, value))
    this.out[this.n++] = v < 0 ? v * 0x8000 : v * 0x7fff
    if (this.n === CHUNK) {
      this.port.postMessage(this.out.slice().buffer)
      this.n = 0
    }
  }
}
registerProcessor('pcm-worklet', PcmWorklet)
