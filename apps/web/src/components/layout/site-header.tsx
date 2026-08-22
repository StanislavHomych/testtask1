import { Link } from 'react-router-dom'
import { AuthControls } from '@/features/auth/auth-controls'
import { cn } from '@/lib/utils'

export function BrandMark({ className }: { className?: string }) {
  return (
    <Link
      to="/"
      className={cn(
        'font-display text-xl font-bold tracking-tight transition-opacity hover:opacity-80',
        className,
      )}
    >
      Vault
    </Link>
  )
}

export function SiteHeader({
  compact = false,
  tone = 'default',
}: {
  compact?: boolean
  tone?: 'default' | 'on-media'
}) {
  const onMedia = tone === 'on-media'

  return (
    <header
      className={cn(
        'flex items-center justify-between gap-6',
        compact ? 'py-2' : 'py-1',
      )}
    >
      <BrandMark className={onMedia ? 'text-white' : 'text-ink'} />
      <div className={onMedia ? '[&_button]:text-white' : undefined}>
        <AuthControls tone={onMedia ? 'on-media' : 'default'} />
      </div>
    </header>
  )
}
