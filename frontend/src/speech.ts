const hasDevanagari = (text: string) => /[\u0900-\u097F]/.test(text)

/** Chrome fills the voice list asynchronously, so wait briefly for it. */
function loadVoices(): Promise<SpeechSynthesisVoice[]> {
  const now = speechSynthesis.getVoices()
  if (now.length) return Promise.resolve(now)
  return new Promise((resolve) => {
    const finish = () => resolve(speechSynthesis.getVoices())
    speechSynthesis.addEventListener('voiceschanged', finish, { once: true })
    setTimeout(finish, 1000)
  })
}

/** Speak each text in turn. Returns a warning to show, or null. */
export async function speak(texts: string[], onEnd: () => void): Promise<string | null> {
  if (!('speechSynthesis' in window)) {
    onEnd()
    return 'This browser cannot read text aloud.'
  }
  speechSynthesis.cancel()
  const voices = await loadVoices()
  const find = (lang: string) =>
    voices.find((v) => v.lang.replace('_', '-').toLowerCase().startsWith(lang))
  let missingHindi = false
  texts.forEach((text, i) => {
    const hindi = hasDevanagari(text)
    const utterance = new SpeechSynthesisUtterance(text)
    utterance.lang = hindi ? 'hi-IN' : 'en-IN'
    const voice = hindi ? find('hi') : (find('en-in') ?? find('en'))
    if (voice) utterance.voice = voice
    else if (hindi) missingHindi = true
    utterance.onerror = () => onEnd()
    if (i === texts.length - 1) utterance.onend = () => onEnd()
    speechSynthesis.speak(utterance)
  })
  return missingHindi
    ? 'No Hindi voice is installed on this device, so Hindi may be skipped or mispronounced.'
    : null
}

export const stopSpeaking = () => window.speechSynthesis?.cancel()
