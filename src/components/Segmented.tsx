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
  /** Stretch to the container's width, segments sharing it equally. */
  full?: boolean
}

/** Segmented radio group (the "Przód / Tył", "Kobieta / Mężczyzna" switches): a rounded track, the chosen segment green. */
export default function Segmented<T extends string>({ options, value, onChange, label, size = 'md', invalid, full }: Props<T>) {
  return (
    <div
      role="radiogroup"
      aria-label={label}
      className={`${full ? 'flex w-full' : 'inline-flex'} gap-1 rounded-xl border p-1 ${invalid ? 'border-alarm' : 'border-line-2'}`}
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
            className={`rounded-lg transition-colors ${full ? 'flex-1' : ''} ${size === 'sm' ? 'min-h-9 px-3 text-[0.9375rem]' : 'min-h-10 px-4 text-base'} ${
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
