import type { User } from '~~/server/db/schema'

/**
 * Identity only — floor and lives come from `/api/game/state`, the single
 * definition of where the player stands. See specs/architecture.md.
 */
export type SessionUser = Pick<User, 'id' | 'username' | 'isAdmin'> & {
  /** ISO 8601: a `Date` doesn't survive the trip to the client. */
  createdAt: string
}

export interface MeResponse {
  user: SessionUser | null
}

export default defineEventHandler(async (event): Promise<MeResponse> => {
  const user = await getCurrentUser(event)
  if (!user) {
    return { user: null }
  }

  return {
    user: {
      id: user.id,
      username: user.username,
      isAdmin: user.isAdmin,
      createdAt: user.createdAt.toISOString(),
    },
  }
})
