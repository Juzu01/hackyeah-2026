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

/** Square segmented radio group (the "Przód / Tył", "Kobieta / Mężczyzna" switches); the chosen segment is green. */
export default function Segmented<T extends string>({ options, value, onChange, label, size = 'md', invalid }: Props<T>) {
  return (
    <div
      role="radiogroup"
      aria-label={label}
      className={`inline-flex border ${invalid ? 'border-alarm' : 'border-line-2'}`}
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
            className={`border-l border-line-2 first:border-l-0 transition-colors ${size === 'sm' ? 'min-h-10 px-3 text-[0.9375rem]' : 'min-h-11 px-4 text-base'} ${
              checked ? 'bg-green font-bold text-green-ink' : 'font-medium text-ink hover:bg-s2'
            }`}
          >
            {o.label}
          </button>
        )
      })}
    </div>
  )
}
