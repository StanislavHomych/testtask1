import { useEffect, useId, useRef, useState } from 'react'
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
  const rootRef = useRef<HTMLDivElement>(null)
  const listId = useId()

  useEffect(() => {
    if (!open) {
      return
    }

    function onPointerDown(event: MouseEvent) {
      if (!rootRef.current?.contains(event.target as Node)) {
        setOpen(false)
      }
    }

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        setOpen(false)
      }
    }

    window.addEventListener('mousedown', onPointerDown)
    window.addEventListener('keydown', onKeyDown)
    return () => {
      window.removeEventListener('mousedown', onPointerDown)
      window.removeEventListener('keydown', onKeyDown)
    }
  }, [open])

  return (
    <div ref={rootRef} className="relative">
      <Button
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

      {open ? (
        <div
          id={listId}
          role="listbox"
          aria-label={placeholder}
          className="absolute right-0 z-40 mt-2 w-64 overflow-hidden rounded-2xl border border-border/80 bg-[color:var(--card)] p-1.5 shadow-[0_18px_40px_-24px_rgba(15,28,22,0.55)]"
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
        </div>
      ) : null}
    </div>
  )
}
