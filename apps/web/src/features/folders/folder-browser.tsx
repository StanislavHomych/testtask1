import { useMemo, useRef, useState } from 'react'
import {
  ChevronRight,
  FileText,
  FileUp,
  Folder,
  FolderOpen,
  FolderPlus,
} from 'lucide-react'
import { PdfPreview } from '@/components/pdf-preview'
import { Button } from '@/components/ui/button'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'
import { Input } from '@/components/ui/input'
import { MenuSelect } from '@/components/ui/menu-select'
import { PromptDialog } from '@/components/ui/prompt-dialog'
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
  useRetryUpload,
  useUploadPdf,
} from '@/features/files/use-files'
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

function fileStatusLabel(status?: string | null): string {
  switch (status) {
    case 'PENDING_UPLOAD':
      return 'Upload incomplete'
    case 'FAILED':
      return 'Upload failed'
    case 'AVAILABLE':
    case undefined:
    case null:
      return 'Ready'
    default:
      return status
  }
}

type DialogState =
  | { type: 'idle' }
  | { type: 'rename-folder'; folder: FolderSummary }
  | { type: 'delete-folder'; folder: FolderSummary }
  | { type: 'rename-file'; file: FileSummary }
  | { type: 'delete-file'; file: FileSummary }

export function FolderBrowser({ rootFolderId }: { rootFolderId: string }) {
  const [folderId, setFolderId] = useState(rootFolderId)
  const [newFolderName, setNewFolderName] = useState('')
  const [showNewFolder, setShowNewFolder] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [extraFolders, setExtraFolders] = useState<FolderSummary[]>([])
  const [extraFiles, setExtraFiles] = useState<FileSummary[]>([])
  const [foldersCursor, setFoldersCursor] = useState<string | null>(null)
  const [filesCursor, setFilesCursor] = useState<string | null>(null)
  const [preview, setPreview] = useState<{ url: string; title: string } | null>(
    null,
  )
  const [dialog, setDialog] = useState<DialogState>({ type: 'idle' })
  const [dialogBusy, setDialogBusy] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const retryInputRef = useRef<HTMLInputElement>(null)
  const [retryFileId, setRetryFileId] = useState<string | null>(null)
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
  const retryUpload = useRetryUpload(folderId)
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

  const sharedMoveOptions = [
    ...(parentFolderId
      ? [
          {
            value: parentFolderId,
            label: 'Parent folder',
            description: 'Move one level up',
          },
        ]
      : []),
    ...listedFolders.map((item) => ({
      value: item.id,
      label: item.name,
      description: 'Folder in this location',
    })),
  ]

  async function run(action: () => Promise<unknown>) {
    setError(null)
    try {
      await action()
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Something went wrong')
    }
  }

  async function runDialog(action: () => Promise<unknown>) {
    setDialogBusy(true)
    setError(null)
    try {
      await action()
      setDialog({ type: 'idle' })
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Something went wrong')
    } finally {
      setDialogBusy(false)
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
    <section className="surface-panel overflow-hidden text-card-foreground">
      <div className="border-b border-border/70 bg-surface/75 px-5 py-5 sm:px-7">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">
              Current folder
            </p>
            <h2 className="mt-1 flex items-center gap-2 font-display text-2xl font-semibold tracking-tight text-ink">
              <FolderOpen className="h-5 w-5 text-primary" aria-hidden="true" />
              {title}
            </h2>
            <nav
              className="mt-3 flex flex-wrap items-center gap-1 text-sm text-muted-foreground"
              aria-label="Folder path"
            >
              {breadcrumbs.map((crumb, index) => (
                <span key={crumb.id} className="inline-flex items-center gap-1">
                  {index > 0 ? (
                    <ChevronRight className="h-3.5 w-3.5 opacity-40" />
                  ) : null}
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
                onClick={() => setShowNewFolder((value) => !value)}
              >
                <FolderPlus className="mr-1.5 h-4 w-4" aria-hidden="true" />
                New folder
              </Button>
              <Button
                type="button"
                size="sm"
                disabled={uploadPdf.isPending}
                onClick={() => fileInputRef.current?.click()}
              >
                <FileUp className="mr-1.5 h-4 w-4" aria-hidden="true" />
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
              <input
                ref={retryInputRef}
                type="file"
                accept="application/pdf,.pdf"
                className="hidden"
                onChange={(event) => {
                  const file = event.target.files?.[0]
                  const fileId = retryFileId
                  event.target.value = ''
                  setRetryFileId(null)
                  if (!file || !fileId) {
                    return
                  }
                  void run(async () => {
                    await retryUpload.mutateAsync({ fileId, file })
                  })
                }}
              />
            </div>
          ) : null}
        </div>
      </div>

      {canWrite && showNewFolder ? (
        <form
          className="flex flex-col gap-3 border-b border-border/70 bg-accent/25 px-5 py-4 sm:flex-row sm:items-center sm:px-7"
          onSubmit={(event) => {
            event.preventDefault()
            const name = newFolderName.trim()
            if (!name) {
              return
            }
            void run(async () => {
              await createFolder.mutateAsync(name)
              setNewFolderName('')
              setShowNewFolder(false)
            })
          }}
        >
          <Input
            placeholder="e.g. Financial documents"
            value={newFolderName}
            onChange={(event) => setNewFolderName(event.target.value)}
          />
          <Button type="submit" disabled={createFolder.isPending}>
            {createFolder.isPending ? 'Creating…' : 'Create folder'}
          </Button>
          <Button
            type="button"
            variant="ghost"
            onClick={() => {
              setNewFolderName('')
              setShowNewFolder(false)
            }}
          >
            Cancel
          </Button>
        </form>
      ) : null}

      {error ? (
        <div className="mx-5 mt-5 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-[#9b2c2c] sm:mx-7">
          {error}
        </div>
      ) : null}

      {contents.isPending ? (
        <p className="px-7 py-12 text-center text-sm text-muted-foreground">
          Loading documents…
        </p>
      ) : null}

      {contents.isError ? (
        <p className="px-7 py-12 text-center text-sm text-muted-foreground">
          Could not load this folder.
        </p>
      ) : null}

      {contents.data ? (
        <div className="space-y-8 px-5 py-6 sm:px-7 sm:py-7">
          <div>
            <div className="flex items-center justify-between gap-3">
              <h3 className="font-display text-lg font-semibold text-ink">
                Folders
              </h3>
              <span className="text-xs font-medium text-muted-foreground">
                {listedFolders.length} shown
              </span>
            </div>
            {listedFolders.length === 0 ? (
              <div className="mt-3 rounded-2xl border border-dashed border-border bg-surface/45 px-5 py-7 text-center">
                <Folder className="mx-auto h-6 w-6 text-muted-foreground/60" />
                <p className="mt-2 text-sm font-medium text-ink">
                  No folders here
                </p>
                <p className="mt-1 text-xs text-muted-foreground">
                  Create one to group related documents.
                </p>
              </div>
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
                        <Folder className="h-4 w-4" aria-hidden="true" />
                      </span>
                      <span className="font-medium text-ink hover:underline">
                        {folder.name}
                      </span>
                    </button>
                    {canWrite ? (
                      <div className="flex flex-wrap gap-2">
                        <MenuSelect
                          label="Move"
                          placeholder="Move folder to"
                          options={sharedMoveOptions.filter(
                            (option) => option.value !== folder.id,
                          )}
                          emptyMessage="No other folders to move into"
                          onSelect={(targetParentId) => {
                            void run(async () => {
                              await moveFolder.mutateAsync({
                                folderId: folder.id,
                                targetParentId,
                              })
                            })
                          }}
                        />
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          onClick={() =>
                            setDialog({ type: 'rename-folder', folder })
                          }
                        >
                          Rename
                        </Button>
                        <Button
                          type="button"
                          size="sm"
                          variant="destructive"
                          onClick={() =>
                            setDialog({ type: 'delete-folder', folder })
                          }
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
            <div className="flex items-center justify-between gap-3">
              <h3 className="font-display text-lg font-semibold text-ink">
                PDF documents
              </h3>
              <span className="text-xs font-medium text-muted-foreground">
                {listedFiles.length} shown
              </span>
            </div>
            {listedFiles.length === 0 ? (
              <div className="mt-3 rounded-2xl border border-dashed border-border bg-surface/45 px-5 py-8 text-center">
                <FileText className="mx-auto h-7 w-7 text-muted-foreground/60" />
                <p className="mt-2 text-sm font-medium text-ink">
                  No PDF documents yet
                </p>
                <p className="mt-1 text-xs text-muted-foreground">
                  {canWrite
                    ? 'Use “Upload PDF” above to add the first document.'
                    : 'The owner has not added documents to this folder.'}
                </p>
              </div>
            ) : (
              <ul className="mt-3 divide-y divide-border/70 overflow-hidden rounded-2xl border border-border/80 bg-surface/60">
                {listedFiles.map((file) => (
                  <li
                    key={file.id}
                    className="flex flex-col gap-3 px-4 py-3.5 sm:flex-row sm:items-center sm:justify-between"
                  >
                    <div className="flex items-center gap-3">
                      <span className="inline-flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10 text-xs font-semibold text-primary">
                        <FileText className="h-4 w-4" aria-hidden="true" />
                      </span>
                      <div>
                        <p className="font-medium text-ink">{file.name}</p>
                        <p
                          className={`text-xs ${
                            file.status === 'FAILED' ||
                            file.status === 'PENDING_UPLOAD'
                              ? 'font-medium text-[#9b2c2c]'
                              : 'text-muted-foreground'
                          }`}
                        >
                          {fileStatusLabel(file.status)} ·{' '}
                          {formatBytes(file.size)}
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
                      {canWrite &&
                      (file.status === 'PENDING_UPLOAD' ||
                        file.status === 'FAILED') ? (
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          disabled={retryUpload.isPending}
                          onClick={() => {
                            setRetryFileId(file.id)
                            retryInputRef.current?.click()
                          }}
                        >
                          Retry upload
                        </Button>
                      ) : null}
                      {canWrite &&
                      (file.status === 'AVAILABLE' || !file.status) ? (
                        <>
                          <MenuSelect
                            label="Move"
                            placeholder="Move file to"
                            options={sharedMoveOptions}
                            emptyMessage="Create a folder first"
                            onSelect={(targetFolderId) => {
                              void run(async () => {
                                await moveFile.mutateAsync({
                                  fileId: file.id,
                                  targetFolderId,
                                })
                              })
                            }}
                          />
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            onClick={() =>
                              setDialog({ type: 'rename-file', file })
                            }
                          >
                            Rename
                          </Button>
                        </>
                      ) : null}
                      {canWrite ? (
                        <Button
                          type="button"
                          size="sm"
                          variant="destructive"
                          onClick={() =>
                            setDialog({ type: 'delete-file', file })
                          }
                        >
                          Delete
                        </Button>
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
            <div className="border-t border-border/70 pt-7">
              <div className="mb-3 flex items-center justify-between gap-3">
                <h3 className="font-display text-lg font-semibold text-ink">
                  Preview · {preview.title}
                </h3>
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  onClick={() => setPreview(null)}
                >
                  Close preview
                </Button>
              </div>
              <PdfPreview url={preview.url} title={preview.title} />
            </div>
          ) : null}
        </div>
      ) : null}

      <PromptDialog
        open={dialog.type === 'rename-folder'}
        title="Rename folder"
        description="Choose a clear name your teammates will recognize."
        label="Folder name"
        initialValue={
          dialog.type === 'rename-folder' ? dialog.folder.name : ''
        }
        confirmLabel="Save name"
        busy={dialogBusy}
        onClose={() => setDialog({ type: 'idle' })}
        onConfirm={(name) => {
          if (dialog.type !== 'rename-folder') {
            return
          }
          void runDialog(async () => {
            await renameFolder.mutateAsync({
              folderId: dialog.folder.id,
              name,
            })
          })
        }}
      />

      <ConfirmDialog
        open={dialog.type === 'delete-folder'}
        title="Delete folder?"
        description={
          dialog.type === 'delete-folder'
            ? `Delete “${dialog.folder.name}” and everything inside it? This cannot be undone.`
            : ''
        }
        confirmLabel="Delete folder"
        tone="destructive"
        busy={dialogBusy}
        onClose={() => setDialog({ type: 'idle' })}
        onConfirm={() => {
          if (dialog.type !== 'delete-folder') {
            return
          }
          void runDialog(async () => {
            await deleteFolder.mutateAsync(dialog.folder.id)
          })
        }}
      />

      <PromptDialog
        open={dialog.type === 'rename-file'}
        title="Rename document"
        description="Keep the .pdf extension so the file stays recognizable."
        label="File name"
        initialValue={dialog.type === 'rename-file' ? dialog.file.name : ''}
        confirmLabel="Save name"
        busy={dialogBusy}
        onClose={() => setDialog({ type: 'idle' })}
        onConfirm={(name) => {
          if (dialog.type !== 'rename-file') {
            return
          }
          void runDialog(async () => {
            await renameFile.mutateAsync({
              fileId: dialog.file.id,
              name,
            })
          })
        }}
      />

      <ConfirmDialog
        open={dialog.type === 'delete-file'}
        title="Delete document?"
        description={
          dialog.type === 'delete-file'
            ? `Delete “${dialog.file.name}”? The file will be removed from storage.`
            : ''
        }
        confirmLabel="Delete file"
        tone="destructive"
        busy={dialogBusy}
        onClose={() => setDialog({ type: 'idle' })}
        onConfirm={() => {
          if (dialog.type !== 'delete-file') {
            return
          }
          void runDialog(async () => {
            await deleteFile.mutateAsync(dialog.file.id)
          })
        }}
      />
    </section>
  )
}
