import { useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { Files, Settings, Share2, ShieldCheck } from 'lucide-react'
import { PageShell } from '@/components/layout/page-shell'
import { DataRoomSettings } from '@/features/data-rooms/data-room-settings'
import { useDataRoom } from '@/features/data-rooms/use-data-rooms'
import { FolderBrowser } from '@/features/folders/folder-browser'
import { SharePanel } from '@/features/sharing/share-panel'

export function DataRoomPage() {
  const { dataRoomId } = useParams<{ dataRoomId: string }>()
  const { data: dataRoom, isPending, isError } = useDataRoom(dataRoomId ?? '')
  const [activeTab, setActiveTab] = useState<'files' | 'sharing' | 'settings'>(
    'files',
  )

  if (!dataRoomId) {
    return (
      <PageShell title="Data room">
        <p className="text-sm text-muted-foreground">Missing data room id.</p>
      </PageShell>
    )
  }

  if (isPending) {
    return (
      <PageShell title="Data room" description="Loading…">
        <p className="text-sm text-muted-foreground">Please wait a moment.</p>
      </PageShell>
    )
  }

  if (isError || !dataRoom) {
    return (
      <PageShell title="Data room">
        <p className="text-sm text-muted-foreground">
          This data room is missing or you do not have access.
        </p>
        <Link className="mt-4 inline-block text-sm font-semibold text-primary underline-offset-4 hover:underline" to="/">
          Back to rooms
        </Link>
      </PageShell>
    )
  }

  return (
    <PageShell
      title={dataRoom.name}
      description={
        dataRoom.role === 'OWNER'
          ? 'Securely organize documents and control who can view them.'
          : 'Read-only access — you can browse folders and open available PDFs.'
      }
      actions={
        <Link
          to="/"
          className="inline-flex h-10 items-center rounded-xl border border-border bg-surface/70 px-4 text-sm font-semibold text-foreground transition-colors hover:bg-accent"
        >
          ← All rooms
        </Link>
      }
    >
      <section className="mb-6 overflow-hidden rounded-[1.25rem] border border-border/70 bg-surface/65">
        <div className="flex flex-col gap-4 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
              <ShieldCheck className="h-5 w-5" aria-hidden="true" />
            </span>
            <div>
              <p className="text-sm font-semibold text-ink">
                {dataRoom.role === 'OWNER' ? 'You own this room' : 'Shared room'}
              </p>
              <p className="text-xs text-muted-foreground">
                {dataRoom.role === 'OWNER'
                  ? 'Only people you invite can access it'
                  : 'Your access is view only'}
              </p>
            </div>
          </div>
          <span className="w-fit rounded-full bg-accent px-3 py-1 text-xs font-semibold text-accent-foreground">
            {dataRoom.role === 'OWNER' ? 'Private by default' : 'Viewer'}
          </span>
        </div>
      </section>

      <div
        className="mb-6 flex gap-1 overflow-x-auto rounded-xl border border-border/70 bg-surface/70 p-1"
        role="tablist"
        aria-label="Data room sections"
      >
        {[
          { id: 'files', label: 'Documents', icon: Files },
          ...(dataRoom.role === 'OWNER'
            ? [
                { id: 'sharing', label: 'Sharing', icon: Share2 },
                { id: 'settings', label: 'Settings', icon: Settings },
              ]
            : []),
        ].map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            type="button"
            role="tab"
            aria-selected={activeTab === id}
            className={`inline-flex min-w-fit items-center gap-2 rounded-lg px-4 py-2.5 text-sm font-semibold transition-colors ${
              activeTab === id
                ? 'bg-primary text-primary-foreground shadow-sm'
                : 'text-muted-foreground hover:bg-accent hover:text-ink'
            }`}
            onClick={() =>
              setActiveTab(id as 'files' | 'sharing' | 'settings')
            }
          >
            <Icon className="h-4 w-4" aria-hidden="true" />
            {label}
          </button>
        ))}
      </div>

      {activeTab === 'files' ? (
        dataRoom.rootFolderId ? (
          <FolderBrowser
            key={dataRoom.rootFolderId}
            rootFolderId={dataRoom.rootFolderId}
          />
        ) : (
          <section className="surface-panel p-8 text-center text-sm text-muted-foreground">
            This data room has no document folder yet.
          </section>
        )
      ) : null}

      {activeTab === 'sharing' && dataRoom.role === 'OWNER' ? (
        <section className="surface-panel p-6 sm:p-8">
          <SharePanel
            resourceType="DATA_ROOM"
            resourceId={dataRoom.id}
            title="Who can access this room?"
          />
        </section>
      ) : null}

      {activeTab === 'settings' ? (
        <DataRoomSettings dataRoom={dataRoom} />
      ) : null}
    </PageShell>
  )
}
