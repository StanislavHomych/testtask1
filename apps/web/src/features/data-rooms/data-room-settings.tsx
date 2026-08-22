import { zodResolver } from '@hookform/resolvers/zod'
import { useForm } from 'react-hook-form'
import { useNavigate } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import type { DataRoomSummary } from '@/types/domain'
import { dataRoomNameSchema, type DataRoomNameValues } from './data-room-schema'
import { useDeleteDataRoom, useUpdateDataRoom } from './use-data-rooms'

export function DataRoomSettings({ dataRoom }: { dataRoom: DataRoomSummary }) {
  const navigate = useNavigate()
  const updateDataRoom = useUpdateDataRoom(dataRoom.id)
  const deleteDataRoom = useDeleteDataRoom()
  const form = useForm<DataRoomNameValues>({
    resolver: zodResolver(dataRoomNameSchema),
    defaultValues: { name: dataRoom.name },
    values: { name: dataRoom.name },
  })

  if (dataRoom.role !== 'OWNER') {
    return null
  }

  return (
    <div className="space-y-5">
      <section className="surface-panel p-6 sm:p-8">
        <h2 className="font-display text-xl font-semibold text-ink">
          Room details
        </h2>
        <p className="mt-2 text-sm text-muted-foreground">
          Use a name your teammates will immediately recognize.
        </p>
        <form
          className="mt-6 max-w-xl"
          onSubmit={form.handleSubmit(async ({ name }) => {
            await updateDataRoom.mutateAsync(name)
          })}
        >
          <label
            htmlFor="settings-room-name"
            className="mb-2 block text-sm font-semibold text-ink"
          >
            Data room name
          </label>
          <div className="flex flex-col gap-3 sm:flex-row">
            <Input
              id="settings-room-name"
              {...form.register('name')}
            />
            <Button type="submit" disabled={updateDataRoom.isPending}>
              {updateDataRoom.isPending ? 'Saving…' : 'Save changes'}
            </Button>
          </div>
          {form.formState.errors.name ? (
            <p className="mt-2 text-sm text-[#9b2c2c]">
              {form.formState.errors.name.message}
            </p>
          ) : null}
        </form>
      </section>

      <section className="rounded-[1.25rem] border border-red-200 bg-red-50/70 p-6 sm:p-8">
        <h2 className="font-display text-xl font-semibold text-[#7f1d1d]">
          Danger zone
        </h2>
        <p className="mt-2 max-w-xl text-sm leading-relaxed text-[#7f1d1d]/75">
          Deleting this room removes access to all folders, documents, and
          active share links. This action cannot be undone.
        </p>
        <Button
          className="mt-5"
          type="button"
          variant="destructive"
          disabled={deleteDataRoom.isPending}
          onClick={() => {
            if (
              !window.confirm(
                `Delete "${dataRoom.name}"? Folders and files will become inaccessible.`,
              )
            ) {
              return
            }
            void deleteDataRoom.mutateAsync(dataRoom.id).then(() => {
              void navigate('/')
            })
          }}
        >
          {deleteDataRoom.isPending ? 'Deleting…' : 'Delete data room'}
        </Button>
      </section>
    </div>
  )
}
