import { useEffect, useId, useLayoutEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { Check, ChevronDown } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

export interface MenuSelectOption {
  value: string
  label: string
  description?: string
}

interface MenuSelectProps {
  label: string
  placeholder?: string
  options: MenuSelectOption[]
  disabled?: boolean
  emptyMessage?: string
  onSelect: (value: string) => void
}

export function MenuSelect({
  label,
  placeholder = 'Choose…',
  options,
  disabled = false,
  emptyMessage = 'No destinations available',
  onSelect,
}: MenuSelectProps) {
  const [open, setOpen] = useState(false)
  const [coords, setCoords] = useState({ top: 0, left: 0, width: 256 })
  const triggerRef = useRef<HTMLButtonElement>(null)
  const menuRef = useRef<HTMLDivElement>(null)
  const listId = useId()

  function updatePosition() {
    const trigger = triggerRef.current
    if (!trigger) {
      return
    }
    const rect = trigger.getBoundingClientRect()
    const width = 272
    const left = Math.min(
      Math.max(12, rect.right - width),
      window.innerWidth - width - 12,
    )
    const top = rect.bottom + 8
    setCoords({ top, left, width })
  }

  useLayoutEffect(() => {
    if (!open) {
      return
    }
    updatePosition()
  }, [open])

  useEffect(() => {
    if (!open) {
      return
    }

    function onPointerDown(event: MouseEvent) {
      const target = event.target as Node
      if (
        triggerRef.current?.contains(target) ||
        menuRef.current?.contains(target)
      ) {
        return
      }
      setOpen(false)
    }

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        setOpen(false)
      }
    }

    window.addEventListener('mousedown', onPointerDown)
    window.addEventListener('keydown', onKeyDown)
    window.addEventListener('resize', updatePosition)
    window.addEventListener('scroll', updatePosition, true)
    return () => {
      window.removeEventListener('mousedown', onPointerDown)
      window.removeEventListener('keydown', onKeyDown)
      window.removeEventListener('resize', updatePosition)
      window.removeEventListener('scroll', updatePosition, true)
    }
  }, [open])

  return (
    <div className="relative z-20">
      <Button
        ref={triggerRef}
        type="button"
        size="sm"
        variant="outline"
        disabled={disabled}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={listId}
        onClick={() => setOpen((value) => !value)}
      >
        {label}
        <ChevronDown className="ml-1.5 h-3.5 w-3.5 opacity-70" />
      </Button>

      {open && typeof document !== 'undefined'
        ? createPortal(
            <div
              ref={menuRef}
              id={listId}
              role="listbox"
              aria-label={placeholder}
              style={{
                top: coords.top,
                left: coords.left,
                width: coords.width,
              }}
              className="fixed z-[80] overflow-hidden rounded-2xl border border-border/80 bg-[color:var(--card)] p-1.5 shadow-[0_24px_50px_-20px_rgba(15,28,22,0.5)]"
            >
              <p className="px-3 py-2 text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                {placeholder}
              </p>
              {options.length === 0 ? (
                <p className="px-3 py-3 text-sm text-muted-foreground">
                  {emptyMessage}
                </p>
              ) : (
                <ul className="max-h-64 overflow-auto">
                  {options.map((option) => (
                    <li key={option.value}>
                      <button
                        type="button"
                        role="option"
                        className={cn(
                          'flex w-full items-start gap-2 rounded-xl px-3 py-2.5 text-left transition-colors hover:bg-accent',
                        )}
                        onClick={() => {
                          setOpen(false)
                          onSelect(option.value)
                        }}
                      >
                        <Check className="mt-0.5 h-3.5 w-3.5 shrink-0 text-primary opacity-0" />
                        <span>
                          <span className="block text-sm font-semibold text-ink">
                            {option.label}
                          </span>
                          {option.description ? (
                            <span className="mt-0.5 block text-xs text-muted-foreground">
                              {option.description}
                            </span>
                          ) : null}
                        </span>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>,
            document.body,
          )
        : null}
    </div>
  )
}
