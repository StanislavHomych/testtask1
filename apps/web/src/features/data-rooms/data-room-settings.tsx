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
    <section className="surface-panel p-6 sm:p-7">
      <h2 className="font-display text-xl font-semibold text-ink">Settings</h2>
      <p className="mt-2 text-sm text-muted-foreground">
        Rename the room or remove it when diligence is complete.
      </p>
      <form
        className="mt-5 flex flex-col gap-3 sm:flex-row"
        onSubmit={form.handleSubmit(async ({ name }) => {
          await updateDataRoom.mutateAsync(name)
        })}
      >
        <Input aria-label="Data room name" {...form.register('name')} />
        <Button type="submit" disabled={updateDataRoom.isPending}>
          {updateDataRoom.isPending ? 'Saving…' : 'Save name'}
        </Button>
      </form>
      {form.formState.errors.name ? (
        <p className="mt-2 text-sm text-[#9b2c2c]">
          {form.formState.errors.name.message}
        </p>
      ) : null}
      <Button
        className="mt-8"
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
  )
}
