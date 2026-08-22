import { z } from 'zod'

export const dataRoomNameSchema = z.object({
  name: z.string().trim().min(1, 'Name is required').max(120),
})

export type DataRoomNameValues = z.infer<typeof dataRoomNameSchema>
