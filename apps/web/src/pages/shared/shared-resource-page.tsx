import { useState } from 'react'
import { Link, useParams, useSearchParams } from 'react-router-dom'
import { PageShell } from '@/components/layout/page-shell'
import { PdfPreview } from '@/components/pdf-preview'
import { Button } from '@/components/ui/button'
import {
  useSharedFileViewUrl,
  useSharedResource,
} from '@/features/sharing/use-sharing'

function formatBytes(size: string): string {
  const value = Number(size)
  if (!Number.isFinite(value)) {
    return size
  }
  if (value < 1024) {
    return `${value} B`
  }
  if (value < 1024 * 1024) {
    return `${(value / 1024).toFixed(1)} KB`
  }
  return `${(value / (1024 * 1024)).toFixed(1)} MB`
}

export function SharedResourcePage() {
  const { token } = useParams<{ token: string }>()
  const [searchParams, setSearchParams] = useSearchParams()
  const folderId = searchParams.get('folderId')
  const shared = useSharedResource(token, folderId)
  const [previewFileId, setPreviewFileId] = useState<string | null>(null)
  const fileView = useSharedFileViewUrl(token, previewFileId)

  if (!token) {
    return (
      <PageShell title="Shared resource">
        <p className="text-sm text-muted-foreground">Missing share token.</p>
      </PageShell>
    )
  }

  if (shared.isPending) {
    return (
      <PageShell title="Shared resource" description="Loading…">
        <p className="text-sm text-muted-foreground">Please wait a moment.</p>
      </PageShell>
    )
  }

  if (shared.isError || !shared.data) {
    return (
      <PageShell title="Shared resource">
        <p className="text-sm text-muted-foreground">
          This share link is invalid, expired, or revoked.
        </p>
        <Link
          className="mt-4 inline-block text-sm font-semibold text-primary underline-offset-4 hover:underline"
          to="/"
        >
          Go home
        </Link>
      </PageShell>
    )
  }

  const data = shared.data
  const singleFileViewUrl =
    data.file && data.viewUrl ? data.viewUrl : fileView.data?.url
  const singleFile = data.file ?? fileView.data?.file ?? null

  return (
    <PageShell
      title={singleFile?.name ?? data.folder?.name ?? data.dataRoom.name}
      description="Read-only shared access"
    >
      {data.breadcrumbs.length > 0 ? (
        <nav className="mb-6 flex flex-wrap items-center gap-1 text-sm text-muted-foreground">
          {data.breadcrumbs.map((crumb, index) => (
            <span key={crumb.id} className="inline-flex items-center gap-1">
              {index > 0 ? <span className="opacity-40">/</span> : null}
              <button
                type="button"
                className="rounded-md px-1 font-medium transition-colors hover:bg-accent hover:text-ink"
                onClick={() => {
                  setPreviewFileId(null)
                  const rootId = data.breadcrumbs[0]?.id
                  if (crumb.id === rootId) {
                    setSearchParams({})
                    return
                  }
                  setSearchParams({ folderId: crumb.id })
                }}
              >
                {crumb.name}
              </button>
            </span>
          ))}
        </nav>
      ) : null}

      {singleFile && singleFileViewUrl ? (
        <section className="surface-panel space-y-5 p-6 sm:p-7">
          {previewFileId ? (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setPreviewFileId(null)}
            >
              Back to folder
            </Button>
          ) : null}
          <p className="text-sm text-muted-foreground">
            {singleFile.mimeType} · {formatBytes(singleFile.size)}
          </p>
          <Button asChild>
            <a href={singleFileViewUrl} target="_blank" rel="noreferrer">
              Open in new tab
            </a>
          </Button>
          <PdfPreview url={singleFileViewUrl} title={singleFile.name} />
        </section>
      ) : (
        <section className="surface-panel p-6 sm:p-7">
          <div className="space-y-8">
            <div>
              <h2 className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                Folders
              </h2>
              {data.folders.length === 0 ? (
                <p className="mt-3 text-sm text-muted-foreground">No folders.</p>
              ) : (
                <ul className="mt-3 divide-y divide-border/70 overflow-hidden rounded-2xl border border-border/80 bg-surface/60">
                  {data.folders.map((folder) => (
                    <li key={folder.id} className="px-4 py-3.5">
                      <button
                        type="button"
                        className="flex items-center gap-3 font-medium text-ink hover:underline"
                        onClick={() => {
                          setPreviewFileId(null)
                          setSearchParams({ folderId: folder.id })
                        }}
                      >
                        <span className="inline-flex h-9 w-9 items-center justify-center rounded-lg bg-accent text-xs font-semibold text-accent-foreground">
                          DIR
                        </span>
                        {folder.name}
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
            <div>
              <h2 className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                Files
              </h2>
              {data.files.length === 0 ? (
                <p className="mt-3 text-sm text-muted-foreground">No files.</p>
              ) : (
                <ul className="mt-3 divide-y divide-border/70 overflow-hidden rounded-2xl border border-border/80 bg-surface/60">
                  {data.files.map((file) => (
                    <li
                      key={file.id}
                      className="flex flex-col gap-3 px-4 py-3.5 sm:flex-row sm:items-center sm:justify-between"
                    >
                      <div className="flex items-center gap-3">
                        <span className="inline-flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10 text-xs font-semibold text-primary">
                          PDF
                        </span>
                        <div>
                          <p className="font-medium text-ink">{file.name}</p>
                          <p className="text-sm text-muted-foreground">
                            {formatBytes(file.size)}
                          </p>
                        </div>
                      </div>
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        onClick={() => setPreviewFileId(file.id)}
                      >
                        Open
                      </Button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
            {fileView.isError ? (
              <p className="text-sm text-[#9b2c2c]">
                Could not open that file for this share link.
              </p>
            ) : null}
            {fileView.isPending && previewFileId ? (
              <p className="text-sm text-muted-foreground">Opening file…</p>
            ) : null}
          </div>
        </section>
      )}
    </PageShell>
  )
}
