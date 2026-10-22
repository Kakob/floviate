'use client'

import { useEffect, type ReactNode } from 'react'

/** A centered dialog over the page. Escape or a click outside closes it. */
export function Modal({ label, wide = false, onClose, children }: { label: string; wide?: boolean; onClose: () => void; children: ReactNode }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={label}
      className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-stone-900/30 p-4 pt-[6vh]"
      onPointerDown={e => e.target === e.currentTarget && onClose()}
    >
      <div className={`w-full ${wide ? 'max-w-2xl' : 'max-w-lg'}`}>{children}</div>
    </div>
  )
}
