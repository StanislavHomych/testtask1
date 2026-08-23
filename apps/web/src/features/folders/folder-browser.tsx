import { useEffect, useMemo, useRef, useState } from 'react'
import {
  ChevronRight,
  FileText,
  FileUp,
  Folder,
  FolderOpen,
  FolderPlus,
  Share2,
} from 'lucide-react'
import { PdfPreview } from '@/components/pdf-preview'
import { Button } from '@/components/ui/button'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'
import { Dialog } from '@/components/ui/dialog'
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
  useFileVersions,
  useMoveFile,
  useOpenFile,
  useOpenFileVersion,
  useRenameFile,
  useRetryUpload,
  useUploadNewVersion,
  useUploadPdfs,
  type UploadProgressEvent,
} from '@/features/files/use-files'
import { SharePanel } from '@/features/sharing/share-panel'
import { ApiError } from '@/lib/api/api-error'
import { useApiRequest } from '@/lib/api/use-api-request'
import type {
  FileSummary,
  FolderContentsResponse,
  FolderOption,
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

function isPdfFile(file: File): boolean {
  const name = file.name.toLowerCase()
  return file.type === 'application/pdf' || name.endsWith('.pdf')
}

type DialogState =
  | { type: 'idle' }
  | { type: 'rename-folder'; folder: FolderSummary }
  | { type: 'delete-folder'; folder: FolderSummary }
  | { type: 'rename-file'; file: FileSummary }
  | { type: 'delete-file'; file: FileSummary }
  | { type: 'share-folder'; folder: FolderSummary }
  | { type: 'share-file'; file: FileSummary }
  | { type: 'versions'; file: FileSummary }

export function FolderBrowser({
  rootFolderId,
  dataRoomId,
}: {
  rootFolderId: string
  dataRoomId: string
}) {
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
  const [dragActive, setDragActive] = useState(false)
  const [uploadItems, setUploadItems] = useState<UploadProgressEvent[]>([])
  const [folderOptions, setFolderOptions] = useState<FolderOption[]>([])
  const fileInputRef = useRef<HTMLInputElement>(null)
  const retryInputRef = useRef<HTMLInputElement>(null)
  const versionInputRef = useRef<HTMLInputElement>(null)
  const [retryFileId, setRetryFileId] = useState<string | null>(null)
  const [versionFileId, setVersionFileId] = useState<string | null>(null)
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
  const uploadPdfs = useUploadPdfs(folderId)
  const retryUpload = useRetryUpload(folderId)
  const uploadNewVersion = useUploadNewVersion(folderId)
  const renameFile = useRenameFile(folderId)
  const deleteFile = useDeleteFile(folderId)
  const moveFile = useMoveFile(folderId)
  const openFile = useOpenFile()
  const openFileVersion = useOpenFileVersion()
  const versionsFileId = dialog.type === 'versions' ? dialog.file.id : null
  const versions = useFileVersions(versionsFileId)

  useEffect(() => {
    void request<{ items: FolderOption[] }>(
      `/data-rooms/${dataRoomId}/folder-options`,
    )
      .then((result) => setFolderOptions(result.items))
      .catch(() => setFolderOptions([]))
  }, [dataRoomId, request, contents.dataUpdatedAt])

  const canWrite = contents.data?.canWrite ?? false
  const breadcrumbs = contents.data?.breadcrumbs ?? []
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

  const moveOptions = folderOptions.map((item) => ({
    value: item.id,
    label: item.pathLabel,
    description: item.parentId ? 'Nested folder' : 'Root folder',
  }))

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
      setExtraFolders((prev) => [...prev, ...page.folders.items])
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
      setExtraFiles((prev) => [...prev, ...page.files.items])
      setFilesCursor(page.files.nextCursor)
    })
  }

  function queueUploads(fileList: FileList | File[]) {
    const files = [...fileList].filter(isPdfFile)
    if (files.length === 0) {
      setError('Only PDF files can be uploaded.')
      return
    }
    setUploadItems([])
    void run(async () => {
      await uploadPdfs.mutateAsync({
        files,
        onItemProgress: (event) => {
          setUploadItems((prev) => {
            const without = prev.filter((item) => item.localId !== event.localId)
            return [...without, event]
          })
        },
      })
    })
  }

  return (
    <section
      className={`overflow-hidden rounded-[1.25rem] border bg-surface/70 transition-colors ${
        dragActive
          ? 'border-primary ring-2 ring-primary/30'
          : 'border-border/70'
      }`}
      onDragEnter={(event) => {
        event.preventDefault()
        if (canWrite) {
          setDragActive(true)
        }
      }}
      onDragOver={(event) => {
        event.preventDefault()
      }}
      onDragLeave={(event) => {
        event.preventDefault()
        if (event.currentTarget === event.target) {
          setDragActive(false)
        }
      }}
      onDrop={(event) => {
        event.preventDefault()
        setDragActive(false)
        if (!canWrite) {
          return
        }
        queueUploads(event.dataTransfer.files)
      }}
    >
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
            {breadcrumbs.length > 1 ? (
              <nav
                className="mt-3 flex flex-wrap items-center gap-1 text-sm text-muted-foreground"
                aria-label="Folder path"
              >
                {breadcrumbs.slice(0, -1).map((crumb, index) => (
                  <span
                    key={crumb.id}
                    className="inline-flex items-center gap-1"
                  >
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
            ) : null}
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
                disabled={uploadPdfs.isPending}
                onClick={() => fileInputRef.current?.click()}
              >
                <FileUp className="mr-1.5 h-4 w-4" aria-hidden="true" />
                {uploadPdfs.isPending ? 'Uploading…' : 'Upload PDFs'}
              </Button>
              <input
                ref={fileInputRef}
                type="file"
                accept="application/pdf,.pdf"
                multiple
                className="hidden"
                onChange={(event) => {
                  // Copy before reset — FileList is live and clears with value=''
                  const files = event.target.files
                    ? [...event.target.files]
                    : []
                  event.target.value = ''
                  if (!files.length) {
                    return
                  }
                  queueUploads(files)
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
              <input
                ref={versionInputRef}
                type="file"
                accept="application/pdf,.pdf"
                className="hidden"
                onChange={(event) => {
                  const file = event.target.files?.[0]
                  const fileId = versionFileId
                  event.target.value = ''
                  setVersionFileId(null)
                  if (!file || !fileId) {
                    return
                  }
                  void run(async () => {
                    await uploadNewVersion.mutateAsync({ fileId, file })
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

      {uploadItems.length > 0 ? (
        <ul className="space-y-2 border-b border-border/70 bg-accent/20 px-5 py-4 sm:px-7">
          {uploadItems.map((item) => (
            <li key={item.localId} className="text-sm">
              <div className="mb-1 flex items-center justify-between gap-3">
                <span className="truncate font-medium text-ink">
                  {item.fileName}
                </span>
                <span className="text-xs text-muted-foreground">
                  {item.status === 'error'
                    ? item.error ?? 'Failed'
                    : item.status === 'done'
                      ? 'Done'
                      : `${item.progress}%`}
                </span>
              </div>
              <div className="h-1.5 overflow-hidden rounded-full bg-border/80">
                <div
                  className={`h-full rounded-full transition-all ${
                    item.status === 'error' ? 'bg-[#9b2c2c]' : 'bg-primary'
                  }`}
                  style={{
                    width: `${item.status === 'error' ? 100 : item.progress}%`,
                  }}
                />
              </div>
            </li>
          ))}
        </ul>
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
              <ul className="mt-3 divide-y divide-border/70 overflow-visible rounded-2xl border border-border/80 bg-surface/60">
                {listedFolders.map((folder) => (
                  <li
                    key={folder.id}
                    className="relative z-10 flex flex-col gap-3 px-4 py-3.5 first:rounded-t-2xl last:rounded-b-2xl sm:flex-row sm:items-center sm:justify-between"
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
                          options={moveOptions.filter(
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
                            setDialog({ type: 'share-folder', folder })
                          }
                        >
                          <Share2 className="mr-1 h-3.5 w-3.5" />
                          Share
                        </Button>
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
                    ? 'Upload or drop PDFs above to add the first document.'
                    : 'The owner has not added documents to this folder.'}
                </p>
              </div>
            ) : (
              <ul className="mt-3 divide-y divide-border/70 overflow-visible rounded-2xl border border-border/80 bg-surface/60">
                {listedFiles.map((file) => (
                  <li
                    key={file.id}
                    className="relative z-10 flex flex-col gap-3 px-4 py-3.5 first:rounded-t-2xl last:rounded-b-2xl sm:flex-row sm:items-center sm:justify-between"
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
                          {fileStatusLabel(file.status)} · v
                          {file.currentVersion ?? 1} · {formatBytes(file.size)}
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
                            options={moveOptions}
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
                              setDialog({ type: 'share-file', file })
                            }
                          >
                            <Share2 className="mr-1 h-3.5 w-3.5" />
                            Share
                          </Button>
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            onClick={() =>
                              setDialog({ type: 'versions', file })
                            }
                          >
                            Versions
                          </Button>
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            disabled={uploadNewVersion.isPending}
                            onClick={() => {
                              setVersionFileId(file.id)
                              versionInputRef.current?.click()
                            }}
                          >
                            New version
                          </Button>
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
            ? `Delete “${dialog.folder.name}” and everything inside it? Nested folders, files, and share links will be removed. This cannot be undone.`
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
            ? `Delete “${dialog.file.name}”? The file and its versions will be removed from storage.`
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

      <Dialog
        open={dialog.type === 'share-folder' || dialog.type === 'share-file'}
        className="max-w-2xl"
        title={
          dialog.type === 'share-folder'
            ? `Share folder “${dialog.folder.name}”`
            : dialog.type === 'share-file'
              ? `Share file “${dialog.file.name}”`
              : 'Share'
        }
        description="Invite a teammate or create a read-only public link. Email invites require the person to have signed in to Vault once first."
        onClose={() => setDialog({ type: 'idle' })}
      >
        {dialog.type === 'share-folder' ? (
          <SharePanel
            resourceType="FOLDER"
            resourceId={dialog.folder.id}
            title="Folder access"
          />
        ) : null}
        {dialog.type === 'share-file' ? (
          <SharePanel
            resourceType="FILE"
            resourceId={dialog.file.id}
            title="File access"
          />
        ) : null}
      </Dialog>

      <Dialog
        open={dialog.type === 'versions'}
        title={
          dialog.type === 'versions'
            ? `Versions · ${dialog.file.name}`
            : 'Versions'
        }
        description="Open any previous version. Uploading a new version keeps history."
        onClose={() => setDialog({ type: 'idle' })}
      >
        {versions.isPending ? (
          <p className="text-sm text-muted-foreground">Loading versions…</p>
        ) : null}
        {versions.isError ? (
          <p className="text-sm text-[#9b2c2c]">Could not load versions.</p>
        ) : null}
        <ul className="divide-y divide-border/70 overflow-hidden rounded-xl border border-border/80">
          {(versions.data?.items ?? []).map((version) => (
            <li
              key={version.id}
              className="flex flex-col gap-2 px-4 py-3 sm:flex-row sm:items-center sm:justify-between"
            >
              <div className="text-sm">
                <p className="font-medium text-ink">
                  Version {version.version}
                  {version.isCurrent ? ' (current)' : ''}
                </p>
                <p className="text-muted-foreground">
                  {formatBytes(version.size)} ·{' '}
                  {new Date(version.createdAt).toLocaleString()}
                </p>
              </div>
              <Button
                type="button"
                size="sm"
                variant="outline"
                disabled={openFileVersion.isPending}
                onClick={() => {
                  if (dialog.type !== 'versions') {
                    return
                  }
                  void run(async () => {
                    const result = await openFileVersion.mutateAsync({
                      fileId: dialog.file.id,
                      versionId: version.id,
                    })
                    setPreview({
                      url: result.url,
                      title: `${dialog.file.name} · v${version.version}`,
                    })
                    setDialog({ type: 'idle' })
                  })
                }}
              >
                Open
              </Button>
            </li>
          ))}
        </ul>
      </Dialog>
    </section>
  )
}
