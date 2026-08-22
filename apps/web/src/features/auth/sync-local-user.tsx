import { useCurrentUser } from './use-current-user'

export function SyncLocalUser() {
  useCurrentUser()
  return null
}
