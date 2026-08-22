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
        <Input
          placeholder="Acme diligence"
          aria-label="Data room name"
          {...form.register('name')}
        />
        {form.formState.errors.name ? (
          <p className="mt-2 text-sm text-[#9b2c2c]">
            {form.formState.errors.name.message}
          </p>
        ) : null}
      </div>
      <Button type="submit" disabled={createDataRoom.isPending}>
        {createDataRoom.isPending ? 'Creating…' : 'Create data room'}
      </Button>
    </form>
  )
}
