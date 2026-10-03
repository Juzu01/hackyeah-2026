// The atlas's sheet: a bottom sheet on phones (drag handle, slides in and out,
// grows smoothly with its content) and a floating card on the right on wide
// screens. Its element is what the viewer keeps the selection clear of.

import { useLayoutEffect, useRef, useState, type KeyboardEvent, type ReactNode, type Ref } from 'react'

interface Props {
  label: string
  children: ReactNode
  /** Dragged down far enough, or Escape. */
  onDismiss(): void
  /** Dragged up. */
  onExpand?(): void
  /** Sliding out; the parent unmounts it afterwards (see usePresence). */
  closing?: boolean
  /** A dimmed backdrop that closes the sheet when tapped (the info sheet). */
  modal?: boolean
  className?: string
  ref?: Ref<HTMLElement>
}

const DISMISS_PX = 70
const EXPAND_PX = 36

export default function Sheet({ label, children, onDismiss, onExpand, closing, modal, className = '', ref }: Props) {
  const inner = useRef<HTMLDivElement>(null)
  const [height, setHeight] = useState<number>()
  const [drag, setDrag] = useState(0)
  const start = useRef<{ id: number; y: number } | null>(null)

  // The body's height follows the content, so it can animate when the content changes.
  useLayoutEffect(() => {
    const el = inner.current!
    const measure = () => setHeight(el.offsetHeight)
    measure()
    const observer = new ResizeObserver(measure)
    observer.observe(el)
    return () => observer.disconnect()
  }, [])

  const onKeyDown = (e: KeyboardEvent) => {
    if (e.key !== 'Escape') return
    // Don't let the viewer also take Escape as "deselect".
    e.stopPropagation()
    onDismiss()
  }

  return (
    <>
      {modal && <div className={`sheet-scrim ${closing ? 'is-closing' : ''}`} onClick={onDismiss} aria-hidden="true" />}
      <section
        ref={ref}
        aria-label={label}
        role={modal ? 'dialog' : 'region'}
        aria-modal={modal || undefined}
        onKeyDown={onKeyDown}
        className={`sheet ${closing ? 'is-closing' : ''} ${drag ? 'is-dragging' : ''} ${className}`}
        style={drag ? { transform: `translateY(${drag > 0 ? drag : drag * 0.25}px)` } : undefined}
      >
        <div
          className="sheet-grip"
          aria-hidden="true"
          onPointerDown={(e) => {
            e.currentTarget.setPointerCapture(e.pointerId)
            start.current = { id: e.pointerId, y: e.clientY }
          }}
          onPointerMove={(e) => {
            if (start.current?.id === e.pointerId) setDrag(e.clientY - start.current.y)
          }}
          onPointerUp={(e) => {
            if (start.current?.id !== e.pointerId) return
            const dy = e.clientY - start.current.y
            start.current = null
            setDrag(0)
            if (dy > DISMISS_PX) onDismiss()
            else if (dy < -EXPAND_PX) onExpand?.()
          }}
          onPointerCancel={() => {
            start.current = null
            setDrag(0)
          }}
        >
          <span />
        </div>
        <div className="sheet-body" style={height === undefined ? undefined : { height }}>
          <div ref={inner} className="sheet-content">
            {children}
          </div>
        </div>
      </section>
    </>
  )
}
