import { PageShell } from '@/components/layout/page-shell'
import { useCurrentUser } from '@/features/auth/use-current-user'
import { CreateDataRoomForm } from '@/features/data-rooms/create-data-room-form'
import { DataRoomList } from '@/features/data-rooms/data-room-list'

export function DashboardPage() {
  const { data: currentUser, isPending, isError } = useCurrentUser()

  return (
    <PageShell
      title="Your rooms"
      description={
        isPending
          ? 'Syncing your account…'
          : isError
            ? 'Signed in, but the API could not sync your local user yet.'
            : `Welcome back${currentUser?.email ? `, ${currentUser.email}` : ''}. Open a room or create a new one.`
      }
    >
      <div className="grid gap-8 lg:grid-cols-[0.9fr_1.1fr]">
        <section className="surface-panel p-6 sm:p-7">
          <h2 className="font-display text-xl font-semibold text-ink">
            Create a data room
          </h2>
          <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
            Start with a name. Vault creates a root folder you can fill with
            nested structure and PDFs.
          </p>
          <div className="mt-5">
            <CreateDataRoomForm />
          </div>
        </section>

        <section>
          <div className="mb-4 flex items-end justify-between gap-3">
            <h2 className="font-display text-xl font-semibold text-ink">
              All rooms
            </h2>
          </div>
          <DataRoomList />
        </section>
      </div>
    </PageShell>
  )
}
