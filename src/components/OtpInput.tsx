import { useEffect, useRef } from 'react'

type OtpInputProps = {
  value: string
  onChange: (next: string) => void
  length?: number
  disabled?: boolean
}

export default function OtpInput({ value, onChange, length = 6, disabled = false }: OtpInputProps) {
  const inputsRef = useRef<(HTMLInputElement | null)[]>([])

  useEffect(() => {
    inputsRef.current[0]?.focus()
  }, [])

  const chars = Array.from({ length }, (_, i) => value[i] ?? '')

  const focusAt = (i: number) => {
    const el = inputsRef.current[i]
    if (el) {
      el.focus()
      el.select()
    }
  }

  const handleChange = (i: number, raw: string) => {
    const digit = raw.replace(/\D/g, '').slice(-1)
    const next = chars.slice()
    next[i] = digit
    const joined = next.join('')
    onChange(joined)
    if (digit && i < length - 1) focusAt(i + 1)
  }

  const handleKeyDown = (i: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Backspace') {
      if (chars[i]) {
        const next = chars.slice()
        next[i] = ''
        onChange(next.join(''))
      } else if (i > 0) {
        focusAt(i - 1)
      }
    } else if (e.key === 'ArrowLeft' && i > 0) {
      focusAt(i - 1)
    } else if (e.key === 'ArrowRight' && i < length - 1) {
      focusAt(i + 1)
    } else if (e.key === 'Enter') {
      const form = e.currentTarget.form
      form?.requestSubmit()
    }
  }

  const handlePaste = (e: React.ClipboardEvent<HTMLInputElement>) => {
    e.preventDefault()
    const pasted = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, length)
    if (!pasted) return
    onChange(pasted.padEnd(length, '').slice(0, length).trimEnd())
    const lastIndex = Math.min(pasted.length, length - 1)
    focusAt(lastIndex)
  }

  return (
    <div className="flex items-center justify-between gap-2" onPaste={handlePaste}>
      {chars.map((c, i) => (
        <input
          key={i}
          ref={(el) => {
            inputsRef.current[i] = el
          }}
          type="text"
          inputMode="numeric"
          autoComplete="one-time-code"
          maxLength={1}
          value={c}
          disabled={disabled}
          onChange={(e) => handleChange(i, e.target.value)}
          onKeyDown={(e) => handleKeyDown(i, e)}
          onFocus={(e) => e.target.select()}
          aria-label={`Digit ${i + 1}`}
          className="h-14 w-12 rounded-xl border border-slate-200 bg-white text-center text-lg font-semibold text-slate-900 shadow-sm transition
                     focus:border-brand focus:ring-2 focus:ring-brand/20 focus:outline-none disabled:opacity-50 sm:w-14"
        />
      ))}
    </div>
  )
}
