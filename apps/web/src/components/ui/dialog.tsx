import { useEffect, type PropsWithChildren, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

interface DialogProps extends PropsWithChildren {
  open: boolean
  title: string
  description?: ReactNode
  onClose: () => void
  className?: string
  footer?: ReactNode
}

export function Dialog({
  open,
  title,
  description,
  onClose,
  className,
  footer,
  children,
}: DialogProps) {
  useEffect(() => {
    if (!open) {
      return
    }

    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        onClose()
      }
    }

    window.addEventListener('keydown', onKeyDown)
    return () => {
      document.body.style.overflow = previousOverflow
      window.removeEventListener('keydown', onKeyDown)
    }
  }, [open, onClose])

  if (!open || typeof document === 'undefined') {
    return null
  }

  return createPortal(
    <div className="fixed inset-0 z-[90] flex items-end justify-center p-4 sm:items-center">
      <button
        type="button"
        aria-label="Close dialog"
        className="absolute inset-0 bg-[#0f1c16]/45 backdrop-blur-[2px]"
        onClick={onClose}
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="vault-dialog-title"
        className={cn(
          'relative z-10 w-full max-w-md animate-rise overflow-hidden rounded-[1.35rem] border border-border/80 bg-[color:var(--card)] shadow-[0_28px_70px_-36px_rgba(15,28,22,0.55)]',
          className,
        )}
      >
        <div className="flex items-start justify-between gap-4 border-b border-border/70 px-5 py-4 sm:px-6">
          <div>
            <h2
              id="vault-dialog-title"
              className="font-display text-xl font-semibold text-ink"
            >
              {title}
            </h2>
            {description ? (
              <div className="mt-1.5 text-sm leading-relaxed text-muted-foreground">
                {description}
              </div>
            ) : null}
          </div>
          <Button
            type="button"
            size="sm"
            variant="ghost"
            aria-label="Close"
            className="shrink-0 px-2"
            onClick={onClose}
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
        <div className="px-5 py-5 sm:px-6">{children}</div>
        {footer ? (
          <div className="flex flex-col-reverse gap-2 border-t border-border/70 bg-surface/55 px-5 py-4 sm:flex-row sm:justify-end sm:px-6">
            {footer}
          </div>
        ) : null}
      </div>
    </div>,
    document.body,
  )
}
