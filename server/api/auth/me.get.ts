import type { User } from '~~/server/db/schema'

export type SessionUser = Pick<User, 'id' | 'username' | 'isAdmin' | 'currentFloor' | 'lives'>

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
      currentFloor: user.currentFloor,
      lives: user.lives,
    },
  }
})
