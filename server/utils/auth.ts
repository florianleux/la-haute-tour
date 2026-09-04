import { eq } from 'drizzle-orm'
import type { H3Event, SessionManager } from 'h3'
import type { Database } from '../db/client'
import { useDatabase } from '../db/client'
import { users, whitelist } from '../db/schema'
import type { User } from '../db/schema'

export interface DiscordProfile {
  discordId: string
  username: string
  email: string | null
  /** Hash d'avatar Discord, null quand le compte n'en a pas. */
  avatar: string | null
}

export type LoginResult =
  | { status: 'refused' }
  | { status: 'ok', user: User }

/**
 * Whitelist first: a Discord ID that isn't whitelisted creates no account.
 * Otherwise create the player (floor 1, 3 lives, not admin) or re-sync their
 * username/email/avatar without ever touching their game state.
 */
export async function loginWithDiscord(
  db: Database,
  profile: DiscordProfile,
): Promise<LoginResult> {
  const [allowed] = await db
    .select()
    .from(whitelist)
    .where(eq(whitelist.discordId, profile.discordId))
    .limit(1)

  if (!allowed) {
    return { status: 'refused' }
  }

  const [user] = await db
    .insert(users)
    .values({
      discordId: profile.discordId,
      username: profile.username,
      email: profile.email,
      avatar: profile.avatar,
      isAdmin: false,
      currentFloor: 1,
      lives: 3,
    })
    .onConflictDoUpdate({
      target: users.discordId,
      set: {
        username: profile.username,
        email: profile.email,
        avatar: profile.avatar,
      },
    })
    .returning()

  return { status: 'ok', user }
}

export interface SessionData {
  userId?: number
  /** Pending OAuth2 state between the Discord redirect and the callback. */
  oauthState?: string
}

const SESSION_NAME = 'lht_session'
/** Un an : La Haute Tour est un jeu qu'on peut revenir jouer bien plus tard. */
const SESSION_MAX_AGE = 365 * 24 * 60 * 60

export async function useAuthSession(event: H3Event): Promise<SessionManager<SessionData>> {
  const { sessionPassword } = useRuntimeConfig(event)
  return await useSession<SessionData>(event, {
    name: SESSION_NAME,
    password: sessionPassword,
    cookie: { maxAge: SESSION_MAX_AGE },
  })
}

/** The signed-in player, or `null`. Always read back from the database. */
export async function getCurrentUser(event: H3Event): Promise<User | null> {
  const session = await useAuthSession(event)
  const userId = session.data.userId
  if (!userId) {
    return null
  }

  const [user] = await useDatabase()
    .select()
    .from(users)
    .where(eq(users.id, userId))
    .limit(1)

  return user ?? null
}

/** Call at the top of a protected handler. */
export async function requireAuth(event: H3Event): Promise<User> {
  const user = await getCurrentUser(event)
  if (!user) {
    throw createError({ statusCode: 401, statusMessage: 'Non authentifié' })
  }
  return user
}

/** Call at the top of an admin handler. */
export async function requireAdmin(event: H3Event): Promise<User> {
  const user = await requireAuth(event)
  if (!user.isAdmin) {
    throw createError({ statusCode: 403, statusMessage: 'Accès admin requis' })
  }
  return user
}
