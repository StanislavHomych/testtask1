import { useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { Files, Search, Settings, Share2, ShieldCheck } from 'lucide-react'
import { PageShell } from '@/components/layout/page-shell'
import { PdfPreview } from '@/components/pdf-preview'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { DataRoomSettings } from '@/features/data-rooms/data-room-settings'
import { useDataRoom } from '@/features/data-rooms/use-data-rooms'
import { useOpenFile } from '@/features/files/use-files'
import { FolderBrowser } from '@/features/folders/folder-browser'
import { SharePanel } from '@/features/sharing/share-panel'
import { ApiError } from '@/lib/api/api-error'
import { useApiRequest } from '@/lib/api/use-api-request'
import type { FileSummary } from '@/types/domain'

export function DataRoomPage() {
  const { dataRoomId } = useParams<{ dataRoomId: string }>()
  const { data: dataRoom, isPending, isError } = useDataRoom(dataRoomId ?? '')
  const [activeTab, setActiveTab] = useState<'files' | 'sharing' | 'settings'>(
    'files',
  )
  const [searchQuery, setSearchQuery] = useState('')
  const [searchResults, setSearchResults] = useState<FileSummary[] | null>(null)
  const [searchBusy, setSearchBusy] = useState(false)
  const [searchError, setSearchError] = useState<string | null>(null)
  const [preview, setPreview] = useState<{ url: string; title: string } | null>(
    null,
  )
  const request = useApiRequest()
  const openFile = useOpenFile()

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
        <Link
          className="mt-4 inline-block text-sm font-semibold text-primary underline-offset-4 hover:underline"
          to="/"
        >
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

      <form
        className="mb-6 flex flex-col gap-3 sm:flex-row"
        onSubmit={(event) => {
          event.preventDefault()
          const q = searchQuery.trim()
          if (!q) {
            setSearchResults(null)
            return
          }
          setSearchBusy(true)
          setSearchError(null)
          void request<{ items: FileSummary[] }>(
            `/data-rooms/${dataRoom.id}/search?q=${encodeURIComponent(q)}`,
          )
            .then((result) => setSearchResults(result.items))
            .catch((err) => {
              setSearchError(
                err instanceof ApiError ? err.message : 'Search failed',
              )
            })
            .finally(() => setSearchBusy(false))
        }}
      >
        <div className="relative min-w-0 flex-1">
          <Search className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            className="pl-9"
            placeholder="Search PDFs in this room by filename"
            value={searchQuery}
            onChange={(event) => setSearchQuery(event.target.value)}
          />
        </div>
        <Button type="submit" disabled={searchBusy}>
          {searchBusy ? 'Searching…' : 'Search'}
        </Button>
        {searchResults ? (
          <Button
            type="button"
            variant="ghost"
            onClick={() => {
              setSearchResults(null)
              setSearchQuery('')
              setPreview(null)
            }}
          >
            Clear
          </Button>
        ) : null}
      </form>

      {searchError ? (
        <p className="mb-4 text-sm text-[#9b2c2c]">{searchError}</p>
      ) : null}

      {searchResults ? (
        <section className="surface-panel mb-6 p-6">
          <h2 className="font-display text-lg font-semibold text-ink">
            Search results
          </h2>
          {searchResults.length === 0 ? (
            <p className="mt-3 text-sm text-muted-foreground">
              No matching PDFs.
            </p>
          ) : (
            <ul className="mt-4 divide-y divide-border/70 overflow-hidden rounded-2xl border border-border/80">
              {searchResults.map((file) => (
                <li
                  key={file.id}
                  className="flex flex-col gap-3 px-4 py-3 sm:flex-row sm:items-center sm:justify-between"
                >
                  <div>
                    <p className="font-medium text-ink">{file.name}</p>
                    <p className="text-xs text-muted-foreground">
                      v{file.currentVersion ?? 1}
                    </p>
                  </div>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      void openFile.mutateAsync(file.id).then((result) => {
                        setPreview({ url: result.url, title: file.name })
                      })
                    }}
                  >
                    Open
                  </Button>
                </li>
              ))}
            </ul>
          )}
          {preview ? (
            <div className="mt-6">
              <PdfPreview url={preview.url} title={preview.title} />
            </div>
          ) : null}
        </section>
      ) : null}

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
            dataRoomId={dataRoom.id}
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
