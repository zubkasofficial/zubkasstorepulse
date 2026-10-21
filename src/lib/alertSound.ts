let audioCtx: AudioContext | null = null

function getCtx(): AudioContext | null {
  if (typeof window === 'undefined') return null
  if (!audioCtx) {
    const Ctor = window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
    if (!Ctor) return null
    audioCtx = new Ctor()
  }
  if (audioCtx.state === 'suspended') {
    audioCtx.resume().catch(() => {})
  }
  return audioCtx
}

function playTone(freq: number, start: number, duration: number, gain: number, type: OscillatorType = 'sine'): void {
  const ctx = getCtx()
  if (!ctx) return
  const osc = ctx.createOscillator()
  const g = ctx.createGain()
  osc.type = type
  osc.frequency.value = freq
  const t0 = ctx.currentTime + start
  g.gain.setValueAtTime(0, t0)
  g.gain.linearRampToValueAtTime(gain, t0 + 0.02)
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + duration)
  osc.connect(g)
  g.connect(ctx.destination)
  osc.start(t0)
  osc.stop(t0 + duration + 0.05)
}

let beepCooldown = 0

export function playBeep(): void {
  const now = Date.now()
  if (now < beepCooldown) return
  beepCooldown = now + 250
  playTone(1320, 0, 0.12, 0.18, 'sine')
}

export function playOrderChime(): void {
  playTone(880, 0, 0.18, 0.22, 'sine')
  playTone(1175, 0.12, 0.18, 0.22, 'sine')
  playTone(1568, 0.24, 0.32, 0.22, 'sine')
}

export function unlockAudio(): void {
  getCtx()
}
