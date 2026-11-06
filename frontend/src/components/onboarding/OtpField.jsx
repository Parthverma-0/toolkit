import { useEffect, useState } from 'react'
import { ErrorText, TextInput } from '../ui/Field.jsx'
import { errorMessage, post } from '../../api/client.js'

const RESEND_SECONDS = 60 // matches backend otp.resendCooldownSeconds

// Input + "Send code" -> 6-digit code -> verified, via POST /api/auth/otp/send and /otp/verify.
// `toTarget` turns the typed value into what the backend expects (e.g. +91 phone).
// onVerified(responseBody) fires after the backend accepts the code.
export default function OtpField({
  id, channel, value, onChange, verified, onVerified, validate, toTarget = (v) => v.trim(), prefix, error, ...inputProps
}) {
  const [sentCode, setSentCode] = useState(false)
  const [busy, setBusy] = useState(false)
  const [code, setCode] = useState('')
  const [codeError, setCodeError] = useState('')
  const [localError, setLocalError] = useState('')
  const [cooldown, setCooldown] = useState(0)

  useEffect(() => {
    if (!cooldown) return undefined
    const timer = setTimeout(() => setCooldown((s) => s - 1), 1000)
    return () => clearTimeout(timer)
  }, [cooldown])

  const handleChange = (e) => {
    onChange(e.target.value)
    setSentCode(false)
    setCode('')
    setCodeError('')
    setLocalError('')
  }

  const send = async () => {
    const err = validate(value)
    if (err) return setLocalError(err)
    setLocalError('')
    setBusy(true)
    try {
      await post('/auth/otp/send', { channel, target: toTarget(value) })
      setSentCode(true)
      setCode('')
      setCodeError('')
      setCooldown(RESEND_SECONDS)
    } catch (e) {
      setLocalError(errorMessage(e))
    } finally {
      setBusy(false)
    }
  }

  const verify = async () => {
    setBusy(true)
    try {
      const res = await post('/auth/otp/verify', { channel, target: toTarget(value), code })
      setSentCode(false)
      setCode('')
      onVerified(res)
    } catch (e) {
      setCodeError(errorMessage(e, 'That code is incorrect. Try again.'))
    } finally {
      setBusy(false)
    }
  }

  const shownError = localError || error

  return (
    <div>
      <div className="flex gap-2">
        <div className="relative flex-1">
          {prefix && (
            <span className="pointer-events-none absolute inset-y-0 left-4 flex items-center text-base text-ink-soft">{prefix}</span>
          )}
          <TextInput id={id} value={value} onChange={handleChange} error={shownError} className={prefix ? 'pl-12!' : ''} {...inputProps} />
        </div>
        {verified ? (
          <span className="inline-flex shrink-0 items-center rounded-lg bg-emerald-50 px-4 text-base font-semibold text-emerald-700">
            Verified
          </span>
        ) : (
          <button
            type="button"
            onClick={send}
            disabled={cooldown > 0 || busy}
            className="shrink-0 rounded-lg border-[1.5px] border-brand bg-white px-4 text-base font-bold text-brand transition
              hover:bg-[#dce8ff] disabled:cursor-not-allowed disabled:opacity-60"
          >
            {cooldown > 0 ? `Resend in ${cooldown}s` : sentCode ? 'Resend code' : 'Send code'}
          </button>
        )}
      </div>
      <ErrorText>{shownError}</ErrorText>

      {sentCode && !verified && (
        <div className="mt-3 rounded-lg border border-line bg-sidebar p-4">
          <p className="text-sm text-ink-soft">
            Enter the 6-digit code we sent to {channel === 'phone' ? 'your phone' : 'this email'}.
            {import.meta.env.DEV && <span className="font-medium text-ink"> (Dev: without SMTP / SMS the code is printed in the backend console.)</span>}
          </p>
          <div className="mt-2 flex gap-2">
            <TextInput
              value={code}
              onChange={(e) => { setCode(e.target.value.replace(/\D/g, '').slice(0, 6)); setCodeError('') }}
              inputMode="numeric"
              autoComplete="one-time-code"
              placeholder="000000"
              aria-label="Verification code"
              error={codeError}
              className="font-mono tracking-[0.4em]"
            />
            <button
              type="button"
              onClick={verify}
              disabled={code.length !== 6 || busy}
              className="shrink-0 rounded-lg bg-brand px-5 text-base font-bold text-white transition hover:bg-brand-dark disabled:opacity-50"
            >
              Verify
            </button>
          </div>
          <ErrorText>{codeError}</ErrorText>
        </div>
      )}
    </div>
  )
}
