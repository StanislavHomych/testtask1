import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  useCreateShare,
  useRevokeShare,
  useShares,
} from '@/features/sharing/use-sharing'
import { ApiError } from '@/lib/api/api-error'
import type { ResourceType } from '@/types/domain'

export function SharePanel({
  resourceType,
  resourceId,
  title = 'Sharing',
}: {
  resourceType: ResourceType
  resourceId: string
  title?: string
}) {
  const [email, setEmail] = useState('')
  const [createdPublicLink, setCreatedPublicLink] = useState<string | null>(
    null,
  )
  const [copied, setCopied] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const shares = useShares(resourceType, resourceId)
  const createShare = useCreateShare(resourceType, resourceId)
  const revokeShare = useRevokeShare(resourceType, resourceId)

  async function run(action: () => Promise<unknown>) {
    setError(null)
    try {
      await action()
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Something went wrong')
    }
  }

  return (
    <div>
      <h3 className="font-display text-xl font-semibold text-ink">{title}</h3>
      <p className="mt-2 max-w-2xl text-sm leading-relaxed text-muted-foreground">
        Choose how people should get read-only access. You stay in control and
        can revoke access at any time.
      </p>

      <div className="mt-6 grid gap-4 lg:grid-cols-2">
        <form
          className="rounded-2xl border border-border/80 bg-surface/60 p-5"
          onSubmit={(event) => {
            event.preventDefault()
            if (!email.trim()) {
              return
            }
            void run(async () => {
              await createShare.mutateAsync({
                audience: 'USER',
                email: email.trim(),
              })
              setEmail('')
            })
          }}
        >
          <p className="font-semibold text-ink">Invite a teammate</p>
          <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
            Best when you know who needs access. They must have signed in once.
          </p>
          <label
            htmlFor={`share-email-${resourceId}`}
            className="mt-4 mb-2 block text-xs font-semibold text-ink"
          >
            Teammate email
          </label>
          <Input
            id={`share-email-${resourceId}`}
            type="email"
            placeholder="colleague@example.com"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
          />
          <Button
            className="mt-3 w-full"
            type="submit"
            disabled={createShare.isPending}
          >
            {createShare.isPending ? 'Sharing…' : 'Invite viewer'}
          </Button>
        </form>

        <div className="rounded-2xl border border-border/80 bg-surface/60 p-5">
          <p className="font-semibold text-ink">Create a public link</p>
          <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
            Anyone with the link can view this room. No sign-in required.
          </p>
          <Button
            className="mt-4 w-full"
            type="button"
            variant="outline"
            disabled={createShare.isPending}
            onClick={() => {
              void run(async () => {
                const share = await createShare.mutateAsync({
                  audience: 'PUBLIC',
                })
                if (share.publicToken) {
                  const url = `${window.location.origin}/shared/${share.publicToken}`
                  setCreatedPublicLink(url)
                }
              })
            }}
          >
            Generate read-only link
          </Button>
        </div>
      </div>

      {createdPublicLink ? (
        <div className="mt-4 space-y-3 rounded-2xl border border-border/80 bg-accent/40 px-4 py-3 text-sm">
          <p className="break-all">
            Public link (shown once):{' '}
            <a
              className="font-semibold text-primary underline-offset-2 hover:underline"
              href={createdPublicLink}
            >
              {createdPublicLink}
            </a>
          </p>
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={() => {
              void navigator.clipboard.writeText(createdPublicLink).then(() => {
                setCopied(true)
                window.setTimeout(() => setCopied(false), 2000)
              })
            }}
          >
            {copied ? 'Copied' : 'Copy link'}
          </Button>
        </div>
      ) : null}

      {error ? <p className="mt-3 text-sm text-[#9b2c2c]">{error}</p> : null}

      <div className="mt-8 flex items-center justify-between gap-3">
        <h4 className="font-display text-lg font-semibold text-ink">
          People and links with access
        </h4>
        <span className="text-xs font-medium text-muted-foreground">
          {(shares.data?.items ?? []).length} active
        </span>
      </div>
      <ul className="mt-3 divide-y divide-border/70 overflow-hidden rounded-2xl border border-border/80 bg-surface/60">
        {(shares.data?.items ?? []).map((share) => (
          <li
            key={share.id}
            className="flex flex-col gap-2 px-4 py-3.5 sm:flex-row sm:items-center sm:justify-between"
          >
            <div className="text-sm">
              <p className="font-medium text-ink">
                {share.isPublic
                  ? 'Public link'
                  : (share.userEmail ?? 'User share')}
              </p>
              <p className="text-muted-foreground">
                {share.role} · created{' '}
                {new Date(share.createdAt).toLocaleString()}
              </p>
            </div>
            <Button
              type="button"
              size="sm"
              variant="destructive"
              disabled={revokeShare.isPending}
              onClick={() => {
                void run(async () => {
                  await revokeShare.mutateAsync(share.id)
                })
              }}
            >
              Revoke
            </Button>
          </li>
        ))}
        {shares.data?.items.length === 0 ? (
          <li className="px-4 py-4 text-sm text-muted-foreground">
            No active shares yet.
          </li>
        ) : null}
      </ul>
    </div>
  )
}
