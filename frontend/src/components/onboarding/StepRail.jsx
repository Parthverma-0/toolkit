// Vertical step list on desktop, compact progress bar on mobile.
// Completed steps are clickable so users can jump back and edit.
// `current === steps.length` means every step is complete.
export default function StepRail({ steps, current, onSelect }) {
  const finished = current >= steps.length
  const shown = Math.min(current, steps.length - 1)
  return (
    <>
      <div className="lg:hidden">
        <p className="text-xs font-semibold tracking-wider text-brand uppercase">
          {finished ? 'All steps complete' : `Step ${shown + 1} of ${steps.length}`}
        </p>
        <p className="mt-0.5 font-display text-lg font-bold text-ink">{finished ? 'Profile submitted' : steps[shown].title}</p>
        <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-line">
          <div className="h-full rounded-full bg-brand transition-all" style={{ width: `${(Math.min(current + 1, steps.length) / steps.length) * 100}%` }} />
        </div>
      </div>

      <ol className="hidden lg:block">
        {steps.map((step, i) => {
          const done = i < current
          const active = i === current
          return (
            <li key={step.title} className="relative pb-8 last:pb-0">
              {i < steps.length - 1 && (
                <span className={`absolute top-9 left-[15px] h-[calc(100%-2.75rem)] w-px ${done ? 'bg-brand' : 'bg-line'}`} />
              )}
              <button
                type="button"
                disabled={!done}
                onClick={() => onSelect(i)}
                className="group flex w-full gap-3.5 text-left disabled:cursor-default"
              >
                <span
                  className={`flex size-8 shrink-0 items-center justify-center rounded-full border text-sm font-semibold transition
                    ${active ? 'border-brand bg-brand text-white shadow-[0_6px_16px_-6px_rgba(37,99,235,0.9)]'
                      : done ? 'border-brand bg-white text-brand group-hover:bg-brand-soft'
                        : 'border-line bg-white text-ink-soft'}`}
                >
                  {i + 1}
                </span>
                <span className="pt-1">
                  <span className={`block text-sm font-semibold ${active || done ? 'text-ink' : 'text-ink-soft'}`}>{step.title}</span>
                  <span className="block text-xs text-ink-soft">{step.description}</span>
                </span>
              </button>
            </li>
          )
        })}
      </ol>
    </>
  )
}
