import { fileUrl } from '../../api/client.js'

// Round avatar with the person's / startup's image, or their initial
export function Avatar({ name = '?', src, size = 40, square = false }) {
  const radius = square ? 'rounded-lg' : 'rounded-full'
  const initial = name.trim().charAt(0).toUpperCase() || '?'
  return src ? (
    <img src={fileUrl(src)} alt="" style={{ width: size, height: size }} className={`shrink-0 object-cover ${radius}`} />
  ) : (
    <span
      aria-hidden="true"
      style={{ width: size, height: size, fontSize: size * 0.4 }}
      className={`grid shrink-0 place-items-center bg-brand-soft font-semibold text-brand ${radius}`}
    >
      {initial}
    </span>
  )
}

// The other side of a connection: a startup summary or an investor summary -> one display shape
export const personOf = (cp) => {
  if (!cp) return { name: 'Account unavailable', sub: '', image: undefined, square: false }
  const isStartup = cp.sector !== undefined || cp.founderName !== undefined
  return {
    name: cp.name,
    image: isStartup ? cp.logo : cp.photo,
    square: isStartup,
    sub: isStartup
      ? [cp.founderName && `Founder: ${cp.founderName}`, cp.city].filter(Boolean).join(' · ')
      : [cp.designation, cp.organisationName].filter(Boolean).join(', '),
  }
}

export function Person({ cp, size = 40 }) {
  const p = personOf(cp)
  return (
    <div className="flex min-w-0 items-center gap-3">
      <Avatar name={p.name} src={p.image} size={size} square={p.square} />
      <div className="min-w-0">
        <p className="truncate font-semibold text-ink">{p.name}</p>
        {p.sub && <p className="truncate text-sm text-ink-soft">{p.sub}</p>}
      </div>
    </div>
  )
}
