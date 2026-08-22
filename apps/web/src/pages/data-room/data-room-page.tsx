import { Link, useParams } from 'react-router-dom'
import { PageShell } from '@/components/layout/page-shell'
import { DataRoomSettings } from '@/features/data-rooms/data-room-settings'
import { useDataRoom } from '@/features/data-rooms/use-data-rooms'
import { FolderBrowser } from '@/features/folders/folder-browser'
import { SharePanel } from '@/features/sharing/share-panel'

export function DataRoomPage() {
  const { dataRoomId } = useParams<{ dataRoomId: string }>()
  const { data: dataRoom, isPending, isError } = useDataRoom(dataRoomId ?? '')

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
          ? 'You own this room. Upload, organize, and share with confidence.'
          : 'Shared access — you can browse and open available PDFs.'
      }
      actions={
        <Link
          to="/"
          className="text-sm font-semibold text-muted-foreground underline-offset-4 hover:text-ink hover:underline"
        >
          All rooms
        </Link>
      }
    >
      {dataRoom.rootFolderId ? (
        <div className="mb-8">
          <FolderBrowser
            key={dataRoom.rootFolderId}
            rootFolderId={dataRoom.rootFolderId}
            canManageShares={dataRoom.role === 'OWNER'}
          />
        </div>
      ) : (
        <section className="surface-panel mb-8 p-6 text-sm text-muted-foreground">
          This data room has no root folder yet.
        </section>
      )}

      {dataRoom.role === 'OWNER' ? (
        <section className="surface-panel mb-8 p-6 sm:p-7">
          <SharePanel
            resourceType="DATA_ROOM"
            resourceId={dataRoom.id}
            title="Share this room"
          />
        </section>
      ) : null}

      <DataRoomSettings dataRoom={dataRoom} />
    </PageShell>
  )
}
