interface Option<T extends string> {
  value: T
  label: string
}

interface Props<T extends string> {
  options: Option<T>[]
  value?: T
  onChange: (value: T) => void
  label: string
  size?: 'sm' | 'md'
  invalid?: boolean
}

/** Pill-style radio group (the "Przód / Tył", "Kobieta / Mężczyzna" switches). */
export default function Segmented<T extends string>({ options, value, onChange, label, size = 'md', invalid }: Props<T>) {
  return (
    <div
      role="radiogroup"
      aria-label={label}
      className={`inline-flex rounded-full border bg-white p-0.5 ${invalid ? 'border-red-400 ring-2 ring-red-100' : 'border-slate-300'}`}
    >
      {options.map((o) => {
        const checked = o.value === value
        return (
          <button
            key={o.value}
            type="button"
            role="radio"
            aria-checked={checked}
            onClick={() => onChange(o.value)}
            className={`rounded-full font-medium transition-colors ${size === 'sm' ? 'px-3 py-1 text-sm' : 'px-4 py-1.5 text-sm sm:text-base'} ${
              checked ? 'bg-teal-700 text-white shadow-sm' : 'text-slate-700 hover:bg-slate-100'
            }`}
          >
            {o.label}
          </button>
        )
      })}
    </div>
  )
}
