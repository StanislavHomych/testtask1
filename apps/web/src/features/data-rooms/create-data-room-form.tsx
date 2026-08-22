import { zodResolver } from '@hookform/resolvers/zod'
import { useForm } from 'react-hook-form'
import { useNavigate } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { dataRoomNameSchema, type DataRoomNameValues } from './data-room-schema'
import { useCreateDataRoom } from './use-data-rooms'

export function CreateDataRoomForm() {
  const navigate = useNavigate()
  const createDataRoom = useCreateDataRoom()
  const form = useForm<DataRoomNameValues>({
    resolver: zodResolver(dataRoomNameSchema),
    defaultValues: { name: '' },
  })

  return (
    <form
      className="flex flex-col gap-3"
      onSubmit={form.handleSubmit(async ({ name }) => {
        const dataRoom = await createDataRoom.mutateAsync(name)
        form.reset()
        void navigate(`/data-rooms/${dataRoom.id}`)
      })}
    >
      <div>
        <label
          htmlFor="data-room-name"
          className="mb-2 block text-sm font-semibold text-ink"
        >
          Room name
        </label>
        <Input
          id="data-room-name"
          placeholder="e.g. Acme Series A"
          autoComplete="off"
          {...form.register('name')}
        />
        {form.formState.errors.name ? (
          <p className="mt-2 text-sm text-[#9b2c2c]">
            {form.formState.errors.name.message}
          </p>
        ) : null}
      </div>
      <Button className="w-full" type="submit" disabled={createDataRoom.isPending}>
        {createDataRoom.isPending ? 'Creating room…' : 'Create room'}
      </Button>
      <p className="text-xs leading-relaxed text-muted-foreground">
        A private root folder is created automatically.
      </p>
    </form>
  )
}
