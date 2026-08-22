import { Link } from 'react-router-dom'
import { useDataRooms } from './use-data-rooms'

export function DataRoomList() {
  const { data, isPending, isError } = useDataRooms()

  if (isPending) {
    return (
      <div className="surface-panel px-5 py-8 text-sm text-muted-foreground">
        Loading data rooms…
      </div>
    )
  }

  if (isError) {
    return (
      <div className="surface-panel px-5 py-8 text-sm text-muted-foreground">
        Could not load data rooms. Confirm you are signed in and the API can
        reach the database.
      </div>
    )
  }

  if (data.items.length === 0) {
    return (
      <div className="surface-panel px-5 py-10 text-center">
        <p className="font-display text-lg font-semibold text-ink">
          No rooms yet
        </p>
        <p className="mt-2 text-sm text-muted-foreground">
          Create your first data room to start organizing files.
        </p>
      </div>
    )
  }

  return (
    <ul className="surface-panel divide-y divide-border/80 overflow-hidden">
      {data.items.map((room) => (
        <li key={room.id}>
          <Link
            to={`/data-rooms/${room.id}`}
            className="flex items-center justify-between gap-4 px-5 py-4 transition-colors hover:bg-accent/50"
          >
            <div>
              <p className="font-medium text-ink">{room.name}</p>
              <p className="mt-1 text-sm text-muted-foreground">
                Updated {new Date(room.updatedAt).toLocaleDateString()}
              </p>
            </div>
            <span className="rounded-lg bg-accent px-2.5 py-1 text-xs font-semibold uppercase tracking-wide text-accent-foreground">
              {room.role === 'OWNER' ? 'Owner' : 'Shared'}
            </span>
          </Link>
        </li>
      ))}
    </ul>
  )
}
