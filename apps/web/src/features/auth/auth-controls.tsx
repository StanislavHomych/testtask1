import { Show, SignInButton, SignUpButton, UserButton } from '@clerk/react'
import { Button } from '@/components/ui/button'

export function AuthControls({
  tone = 'default',
}: {
  tone?: 'default' | 'on-media'
}) {
  const onMedia = tone === 'on-media'

  return (
    <div className="flex items-center gap-2">
      <Show when="signed-out">
        <SignInButton mode="modal">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className={
              onMedia
                ? 'text-white hover:bg-white/15 hover:text-white'
                : undefined
            }
          >
            Log in
          </Button>
        </SignInButton>
        <SignUpButton mode="modal">
          <Button
            type="button"
            size="sm"
            className={
              onMedia
                ? 'bg-white text-ink hover:bg-white/90'
                : undefined
            }
          >
            Get started
          </Button>
        </SignUpButton>
      </Show>
      <Show when="signed-in">
        <UserButton
          appearance={{
            elements: {
              avatarBox: onMedia
                ? 'h-9 w-9 ring-2 ring-white/50'
                : 'h-9 w-9 ring-2 ring-border',
            },
          }}
        />
      </Show>
    </div>
  )
}
