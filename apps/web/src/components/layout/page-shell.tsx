import type { PropsWithChildren, ReactNode } from 'react'
import { SiteHeader } from '@/components/layout/site-header'

interface PageShellProps extends PropsWithChildren {
  title: string
  description?: ReactNode
  actions?: ReactNode
}

export function PageShell({
  title,
  description,
  actions,
  children,
}: PageShellProps) {
  return (
    <div className="app-grain min-h-screen">
      <div className="mx-auto max-w-6xl px-5 pb-16 pt-4 sm:px-8">
        <SiteHeader compact />
        <div className="mt-8 mb-10 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div className="max-w-2xl animate-rise">
            <h1 className="font-display text-4xl font-semibold tracking-tight text-ink sm:text-5xl">
              {title}
            </h1>
            {description ? (
              <div className="mt-3 max-w-xl text-base leading-relaxed text-muted-foreground">
                {description}
              </div>
            ) : null}
          </div>
          {actions ? (
            <div className="animate-rise-delay shrink-0">{actions}</div>
          ) : null}
        </div>
        <div className="animate-rise-delay-2">{children}</div>
      </div>
    </div>
  )
}
