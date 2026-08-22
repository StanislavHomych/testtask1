import { PageShell } from '@/components/layout/page-shell'
import { useCurrentUser } from '@/features/auth/use-current-user'
import { CreateDataRoomForm } from '@/features/data-rooms/create-data-room-form'
import { DataRoomList } from '@/features/data-rooms/data-room-list'
import { CheckCircle2, FileText, LockKeyhole, Share2 } from 'lucide-react'

export function DashboardPage() {
  const { data: currentUser, isPending, isError } = useCurrentUser()

  return (
    <PageShell
      title="Data rooms"
      description={
        isPending
          ? 'Preparing your secure workspace…'
          : isError
            ? 'Your account is signed in, but the workspace is temporarily unavailable.'
            : `Welcome${currentUser?.email ? `, ${currentUser.email}` : ''}. Keep documents organized and share access safely.`
      }
    >
      <div className="grid gap-7 lg:grid-cols-[minmax(0,1fr)_340px] lg:items-start">
        <section aria-labelledby="rooms-heading">
          <div className="mb-4">
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">
              Workspace
            </p>
            <h2
              id="rooms-heading"
              className="mt-1 font-display text-2xl font-semibold text-ink"
            >
              Your rooms
            </h2>
          </div>
          <DataRoomList />
        </section>

        <aside className="space-y-5 lg:sticky lg:top-6">
          <section className="surface-panel overflow-hidden">
            <div className="bg-primary px-6 py-5 text-primary-foreground">
              <p className="text-xs font-semibold uppercase tracking-[0.14em] opacity-75">
                Start here
              </p>
              <h2 className="mt-1 font-display text-xl font-semibold">
                Create a data room
              </h2>
              <p className="mt-2 text-sm leading-relaxed opacity-80">
                Give the workspace a clear project or deal name.
              </p>
            </div>
            <div className="p-6">
              <CreateDataRoomForm />
            </div>
          </section>

          <section className="rounded-[1.25rem] border border-border/70 bg-surface/55 p-5">
            <p className="text-sm font-semibold text-ink">How Vault works</p>
            <ol className="mt-4 space-y-3 text-sm text-muted-foreground">
              {[
                [FileText, 'Create folders and upload PDF documents'],
                [Share2, 'Invite viewers or create a public link'],
                [LockKeyhole, 'Revoke access whenever you need'],
              ].map(([Icon, label], index) => {
                const StepIcon = Icon as typeof FileText
                return (
                  <li key={label as string} className="flex gap-3">
                    <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-accent text-primary">
                      <StepIcon className="h-4 w-4" aria-hidden="true" />
                    </span>
                    <span className="pt-1.5">
                      <span className="sr-only">Step {index + 1}: </span>
                      {label as string}
                    </span>
                  </li>
                )
              })}
            </ol>
            <div className="mt-4 flex items-center gap-2 border-t border-border/70 pt-4 text-xs font-medium text-muted-foreground">
              <CheckCircle2 className="h-4 w-4 text-primary" />
              Files stay private until you share them.
            </div>
          </section>
        </aside>
      </div>
    </PageShell>
  )
}
