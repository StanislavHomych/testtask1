import { useMemo, useRef, useState } from 'react'
import { PdfPreview } from '@/components/pdf-preview'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  useCreateFolder,
  useDeleteFolder,
  useFolderContents,
  useMoveFolder,
  useRenameFolder,
} from '@/features/folders/use-folders'
import {
  useDeleteFile,
  useMoveFile,
  useOpenFile,
  useRenameFile,
  useUploadPdf,
} from '@/features/files/use-files'
import { SharePanel } from '@/features/sharing/share-panel'
import { ApiError } from '@/lib/api/api-error'
import { useApiRequest } from '@/lib/api/use-api-request'
import type {
  FileSummary,
  FolderContentsResponse,
  FolderSummary,
} from '@/types/domain'

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

const selectClassName =
  'h-9 rounded-lg border border-border bg-surface px-2 text-xs font-medium text-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring/30'

export function FolderBrowser({
  rootFolderId,
  canManageShares,
}: {
  rootFolderId: string
  canManageShares: boolean
}) {
  const [folderId, setFolderId] = useState(rootFolderId)
  const [newFolderName, setNewFolderName] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [extraFolders, setExtraFolders] = useState<FolderSummary[]>([])
  const [extraFiles, setExtraFiles] = useState<FileSummary[]>([])
  const [foldersCursor, setFoldersCursor] = useState<string | null>(null)
  const [filesCursor, setFilesCursor] = useState<string | null>(null)
  const [preview, setPreview] = useState<{ url: string; title: string } | null>(
    null,
  )
  const fileInputRef = useRef<HTMLInputElement>(null)
  const request = useApiRequest()

  function openFolder(nextFolderId: string) {
    setExtraFolders([])
    setExtraFiles([])
    setFoldersCursor(null)
    setFilesCursor(null)
    setPreview(null)
    setFolderId(nextFolderId)
  }

  const contents = useFolderContents(folderId)
  const createFolder = useCreateFolder(folderId)
  const renameFolder = useRenameFolder(folderId)
  const deleteFolder = useDeleteFolder(folderId)
  const moveFolder = useMoveFolder(folderId)
  const uploadPdf = useUploadPdf(folderId)
  const renameFile = useRenameFile(folderId)
  const deleteFile = useDeleteFile(folderId)
  const moveFile = useMoveFile(folderId)
  const openFile = useOpenFile()

  const canWrite = contents.data?.canWrite ?? false
  const breadcrumbs = contents.data?.breadcrumbs ?? []
  const parentFolderId =
    breadcrumbs.length > 1 ? breadcrumbs[breadcrumbs.length - 2]?.id : null
  const listedFolders = [
    ...(contents.data?.folders.items ?? []),
    ...extraFolders,
  ]
  const listedFiles = [...(contents.data?.files.items ?? []), ...extraFiles]
  const nextFoldersCursor =
    foldersCursor ?? contents.data?.folders.nextCursor ?? null
  const nextFilesCursor = filesCursor ?? contents.data?.files.nextCursor ?? null

  const title = useMemo(
    () => contents.data?.folder.name ?? 'Folder',
    [contents.data?.folder.name],
  )

  async function run(action: () => Promise<unknown>) {
    setError(null)
    try {
      await action()
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Something went wrong')
    }
  }

  async function loadMoreFolders() {
    if (!nextFoldersCursor) {
      return
    }
    await run(async () => {
      const page = await request<FolderContentsResponse>(
        `/folders/${folderId}/contents?foldersCursor=${encodeURIComponent(nextFoldersCursor)}`,
      )
      setExtraFolders((current) => [...current, ...page.folders.items])
      setFoldersCursor(page.folders.nextCursor)
    })
  }

  async function loadMoreFiles() {
    if (!nextFilesCursor) {
      return
    }
    await run(async () => {
      const page = await request<FolderContentsResponse>(
        `/folders/${folderId}/contents?filesCursor=${encodeURIComponent(nextFilesCursor)}`,
      )
      setExtraFiles((current) => [...current, ...page.files.items])
      setFilesCursor(page.files.nextCursor)
    })
  }

  return (
    <section className="surface-panel p-5 text-card-foreground sm:p-7">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h2 className="font-display text-2xl font-semibold tracking-tight text-ink">
            {title}
          </h2>
          <nav className="mt-3 flex flex-wrap items-center gap-1 text-sm text-muted-foreground">
            {breadcrumbs.map((crumb, index) => (
              <span key={crumb.id} className="inline-flex items-center gap-1">
                {index > 0 ? <span className="opacity-40">/</span> : null}
                <button
                  type="button"
                  className="rounded-md px-1 font-medium transition-colors hover:bg-accent hover:text-ink"
                  onClick={() => openFolder(crumb.id)}
                >
                  {crumb.name}
                </button>
              </span>
            ))}
          </nav>
        </div>
        {canWrite ? (
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={uploadPdf.isPending}
              onClick={() => fileInputRef.current?.click()}
            >
              {uploadPdf.isPending ? 'Uploading…' : 'Upload PDF'}
            </Button>
            <input
              ref={fileInputRef}
              type="file"
              accept="application/pdf,.pdf"
              className="hidden"
              onChange={(event) => {
                const file = event.target.files?.[0]
                event.target.value = ''
                if (!file) {
                  return
                }
                void run(async () => {
                  await uploadPdf.mutateAsync(file)
                })
              }}
            />
          </div>
        ) : null}
      </div>

      {canWrite ? (
        <form
          className="mt-5 flex flex-col gap-2 sm:flex-row"
          onSubmit={(event) => {
            event.preventDefault()
            const name = newFolderName.trim()
            if (!name) {
              return
            }
            void run(async () => {
              await createFolder.mutateAsync(name)
              setNewFolderName('')
            })
          }}
        >
          <Input
            placeholder="New folder name"
            value={newFolderName}
            onChange={(event) => setNewFolderName(event.target.value)}
          />
          <Button type="submit" disabled={createFolder.isPending}>
            {createFolder.isPending ? 'Creating…' : 'Create folder'}
          </Button>
        </form>
      ) : null}

      {error ? <p className="mt-4 text-sm text-[#9b2c2c]">{error}</p> : null}

      {contents.isPending ? (
        <p className="mt-8 text-sm text-muted-foreground">Loading contents…</p>
      ) : null}

      {contents.isError ? (
        <p className="mt-8 text-sm text-muted-foreground">
          Could not load this folder.
        </p>
      ) : null}

      {contents.data ? (
        <div className="mt-8 space-y-8">
          <div>
            <h3 className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">
              Folders
            </h3>
            {listedFolders.length === 0 ? (
              <p className="mt-3 text-sm text-muted-foreground">No folders.</p>
            ) : (
              <ul className="mt-3 divide-y divide-border/70 overflow-hidden rounded-2xl border border-border/80 bg-surface/60">
                {listedFolders.map((folder) => (
                  <li
                    key={folder.id}
                    className="flex flex-col gap-3 px-4 py-3.5 sm:flex-row sm:items-center sm:justify-between"
                  >
                    <button
                      type="button"
                      className="flex items-center gap-3 text-left"
                      onClick={() => openFolder(folder.id)}
                    >
                      <span className="inline-flex h-9 w-9 items-center justify-center rounded-lg bg-accent text-xs font-semibold text-accent-foreground">
                        DIR
                      </span>
                      <span className="font-medium text-ink hover:underline">
                        {folder.name}
                      </span>
                    </button>
                    {canWrite ? (
                      <div className="flex flex-wrap gap-2">
                        <select
                          className={selectClassName}
                          defaultValue=""
                          aria-label={`Move ${folder.name}`}
                          onChange={(event) => {
                            const targetParentId = event.target.value
                            event.target.value = ''
                            if (!targetParentId) {
                              return
                            }
                            void run(async () => {
                              await moveFolder.mutateAsync({
                                folderId: folder.id,
                                targetParentId,
                              })
                            })
                          }}
                        >
                          <option value="">Move to…</option>
                          {parentFolderId ? (
                            <option value={parentFolderId}>Parent folder</option>
                          ) : null}
                          {listedFolders
                            .filter((item) => item.id !== folder.id)
                            .map((item) => (
                              <option key={item.id} value={item.id}>
                                {item.name}
                              </option>
                            ))}
                        </select>
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          onClick={() => {
                            const name = window.prompt(
                              'Rename folder',
                              folder.name,
                            )
                            if (!name?.trim()) {
                              return
                            }
                            void run(async () => {
                              await renameFolder.mutateAsync({
                                folderId: folder.id,
                                name: name.trim(),
                              })
                            })
                          }}
                        >
                          Rename
                        </Button>
                        <Button
                          type="button"
                          size="sm"
                          variant="destructive"
                          onClick={() => {
                            if (
                              !window.confirm(
                                `Delete folder "${folder.name}" and its contents?`,
                              )
                            ) {
                              return
                            }
                            void run(async () => {
                              await deleteFolder.mutateAsync(folder.id)
                            })
                          }}
                        >
                          Delete
                        </Button>
                      </div>
                    ) : null}
                  </li>
                ))}
              </ul>
            )}
            {nextFoldersCursor ? (
              <Button
                className="mt-3"
                type="button"
                size="sm"
                variant="soft"
                onClick={() => {
                  void loadMoreFolders()
                }}
              >
                Load more folders
              </Button>
            ) : null}
          </div>

          <div>
            <h3 className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">
              Files
            </h3>
            {listedFiles.length === 0 ? (
              <p className="mt-3 text-sm text-muted-foreground">No files.</p>
            ) : (
              <ul className="mt-3 divide-y divide-border/70 overflow-hidden rounded-2xl border border-border/80 bg-surface/60">
                {listedFiles.map((file) => (
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
                        <p className="text-xs text-muted-foreground">
                          {file.status ?? 'AVAILABLE'} · {formatBytes(file.size)}
                        </p>
                      </div>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {file.status === 'AVAILABLE' || !file.status ? (
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          disabled={openFile.isPending}
                          onClick={() => {
                            void run(async () => {
                              const result = await openFile.mutateAsync(file.id)
                              setPreview({ url: result.url, title: file.name })
                            })
                          }}
                        >
                          Open
                        </Button>
                      ) : null}
                      {canWrite ? (
                        <>
                          <select
                            className={selectClassName}
                            defaultValue=""
                            aria-label={`Move ${file.name}`}
                            onChange={(event) => {
                              const targetFolderId = event.target.value
                              event.target.value = ''
                              if (!targetFolderId) {
                                return
                              }
                              void run(async () => {
                                await moveFile.mutateAsync({
                                  fileId: file.id,
                                  targetFolderId,
                                })
                              })
                            }}
                          >
                            <option value="">Move to…</option>
                            {parentFolderId ? (
                              <option value={parentFolderId}>
                                Parent folder
                              </option>
                            ) : null}
                            {listedFolders.map((item) => (
                              <option key={item.id} value={item.id}>
                                {item.name}
                              </option>
                            ))}
                          </select>
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            onClick={() => {
                              const name = window.prompt(
                                'Rename file',
                                file.name,
                              )
                              if (!name?.trim()) {
                                return
                              }
                              void run(async () => {
                                await renameFile.mutateAsync({
                                  fileId: file.id,
                                  name: name.trim(),
                                })
                              })
                            }}
                          >
                            Rename
                          </Button>
                          <Button
                            type="button"
                            size="sm"
                            variant="destructive"
                            onClick={() => {
                              if (
                                !window.confirm(`Delete file "${file.name}"?`)
                              ) {
                                return
                              }
                              void run(async () => {
                                await deleteFile.mutateAsync(file.id)
                              })
                            }}
                          >
                            Delete
                          </Button>
                        </>
                      ) : null}
                    </div>
                  </li>
                ))}
              </ul>
            )}
            {nextFilesCursor ? (
              <Button
                className="mt-3"
                type="button"
                size="sm"
                variant="soft"
                onClick={() => {
                  void loadMoreFiles()
                }}
              >
                Load more files
              </Button>
            ) : null}
          </div>

          {preview ? (
            <div>
              <h3 className="mb-3 font-display text-lg font-semibold text-ink">
                Preview · {preview.title}
              </h3>
              <PdfPreview url={preview.url} title={preview.title} />
            </div>
          ) : null}
        </div>
      ) : null}

      {canManageShares ? (
        <div className="mt-10 border-t border-border/80 pt-8">
          <SharePanel resourceType="FOLDER" resourceId={folderId} />
        </div>
      ) : null}
    </section>
  )
}
