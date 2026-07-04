import { useEffect, useRef } from 'react'

const FOCUSABLE =
  'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])'

/**
 * Accessibility helper for modal dialogs:
 *  - closes on Escape
 *  - moves focus into the dialog on open
 *  - traps Tab focus inside the dialog
 *  - restores focus to the previously-focused element on close
 *
 * Attach the returned ref to the dialog container element and give it
 * `role="dialog"` + `aria-modal="true"`.
 */
export function useModalA11y<T extends HTMLElement = HTMLDivElement>(onClose: () => void) {
  const ref = useRef<T>(null)

  useEffect(() => {
    const prevFocus = document.activeElement as HTMLElement | null
    const container = ref.current

    const focusables = (): HTMLElement[] =>
      container
        ? Array.from(container.querySelectorAll<HTMLElement>(FOCUSABLE)).filter((el) => el.offsetParent !== null)
        : []

    // Move focus into the dialog — prefer an explicit [data-autofocus] target
    const preferred = container?.querySelector<HTMLElement>('[data-autofocus]')
    const first = preferred ?? focusables()[0]
    if (first) first.focus()
    else container?.focus()

    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); onClose(); return }
      if (e.key !== 'Tab') return
      const items = focusables()
      if (items.length === 0) return
      const firstEl = items[0]
      const lastEl = items[items.length - 1]
      const active = document.activeElement as HTMLElement | null
      if (e.shiftKey) {
        if (active === firstEl || !container?.contains(active)) { e.preventDefault(); lastEl.focus() }
      } else if (active === lastEl || !container?.contains(active)) {
        e.preventDefault(); firstEl.focus()
      }
    }

    // Capture phase so the trap wins over App-level global shortcuts
    document.addEventListener('keydown', onKey, true)
    return () => {
      document.removeEventListener('keydown', onKey, true)
      prevFocus?.focus?.()
    }
  }, [onClose])

  return ref
}
