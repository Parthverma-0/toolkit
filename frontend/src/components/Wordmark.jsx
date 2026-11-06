const SIZES = {
  sm: { text: 'text-xl', mark: 22, gap: 'gap-1.5' },
  md: { text: 'text-[34px]', mark: 34, gap: 'gap-2' },
  lg: { text: 'text-5xl', mark: 46, gap: 'gap-2.5' },
}

// Brand mark: two slanted blue bars
function Mark({ size }) {
  return (
    <svg width={size} height={size} viewBox="0 0 34 34" aria-hidden="true" className="shrink-0">
      <rect x="3" y="12" width="14" height="22" rx="4" transform="rotate(45 10 23)" fill="#60a5fa" />
      <rect x="13" y="1" width="14" height="28" rx="4" transform="rotate(45 20 15)" fill="#2563eb" />
    </svg>
  )
}

export default function Wordmark({ size = 'lg', className = '' }) {
  const s = SIZES[size]
  return (
    <span className={`inline-flex items-center ${s.gap} font-display leading-none font-extrabold tracking-[-0.03em] ${s.text} ${className}`}>
      <Mark size={s.mark} />
      <span>
        <span className="text-[#0f1b3d]">Tool</span>
        <span className="text-brand">Kit</span>
      </span>
    </span>
  )
}
