import { Link } from 'react-router-dom'
import { ArrowRight, FolderLock, Users } from 'lucide-react'
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
      <div className="surface-panel flex min-h-72 flex-col items-center justify-center px-6 py-12 text-center">
        <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-accent text-primary">
          <FolderLock className="h-6 w-6" aria-hidden="true" />
        </span>
        <p className="font-display text-lg font-semibold text-ink">
          Your workspace is ready
        </p>
        <p className="mt-2 text-sm text-muted-foreground">
          Create your first room using the form on the right.
        </p>
      </div>
    )
  }

  return (
    <ul className="grid gap-3">
      {data.items.map((room) => (
        <li key={room.id} className="surface-panel overflow-hidden">
          <Link
            to={`/data-rooms/${room.id}`}
            className="group flex items-center gap-4 px-5 py-5 transition-colors hover:bg-accent/45"
          >
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary transition-colors group-hover:bg-primary group-hover:text-primary-foreground">
              {room.role === 'OWNER' ? (
                <FolderLock className="h-5 w-5" aria-hidden="true" />
              ) : (
                <Users className="h-5 w-5" aria-hidden="true" />
              )}
            </span>
            <div className="min-w-0 flex-1">
              <p className="truncate font-display text-lg font-semibold text-ink">
                {room.name}
              </p>
              <div className="mt-1 flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
                <span>{room.role === 'OWNER' ? 'Private room' : 'Shared with you'}</span>
                <span aria-hidden="true">·</span>
                <span>Updated {new Date(room.updatedAt).toLocaleDateString()}</span>
              </div>
            </div>
            <span className="hidden items-center gap-2 text-sm font-semibold text-primary sm:flex">
              Open room
              <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
            </span>
          </Link>
        </li>
      ))}
    </ul>
  )
}
