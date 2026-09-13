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
 * Otherwise create the player (floor 1, 3 lives, not admin, l'équipe décidée à
 * l'invitation) or re-sync their username/email/avatar without ever touching
 * their game state — ni leur équipe.
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
      // L'équipe décidée à l'invitation, et seulement à la création : une
      // whitelist rééditée ne déplace personne, la fiche joueur fait foi
      // ensuite. Voir specs/equipes.md.
      team: allowed.team,
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
  /**
   * Le joueur test que l'admin incarne. Le vrai `userId` ne bouge pas : les
   * pouvoirs d'admin restent attachés au compte qui s'est connecté, sinon
   * l'incarnation serait sans retour. Voir specs/admin.md#incarnation.
   */
  actingAsUserId?: number
  /** Pending OAuth2 state between the Discord redirect and the callback. */
  oauthState?: string
}

const SESSION_NAME = 'lht_session'
/**
 * Un an : La Haute Tour est un jeu qu'on peut revenir jouer bien plus tard.
 *
 * Donné deux fois, et les deux comptent : au niveau de la config c'est la règle,
 * h3 refusant de desceller au-delà ; dans `cookie` c'est la politesse faite au
 * navigateur, qui oubliera le cookie de lui-même. Sans la première, l'année
 * n'est qu'une convention que le porteur du cookie est libre d'ignorer.
 *
 * L'âge se compte depuis l'ouverture de la session et non depuis la dernière
 * visite : au bout d'un an on repasse par Discord, même en ayant joué tous les
 * jours.
 */
const SESSION_MAX_AGE = 365 * 24 * 60 * 60

export async function useAuthSession(event: H3Event): Promise<SessionManager<SessionData>> {
  const { sessionPassword } = useRuntimeConfig(event)
  return await useSession<SessionData>(event, {
    name: SESSION_NAME,
    password: sessionPassword,
    maxAge: SESSION_MAX_AGE,
    cookie: {
      maxAge: SESSION_MAX_AGE,
      // Écrit en toutes lettres parce que h3 n'en pose aucun : son défaut
      // s'arrête à `path`, `secure` et `httpOnly`. Et `lax`, jamais `strict` —
      // sous `strict` plus personne ne se connecte.
      // Voir specs/architecture.md#authentification.
      sameSite: 'lax',
    },
  })
}

/**
 * Le compte qui s'est connecté, quoi qu'il incarne. C'est lui qui porte les
 * droits : les lire sur l'identité incarnée verrouillerait l'admin dehors, le
 * joueur test n'étant pas admin — y compris pour l'endpoint qui met fin à
 * l'incarnation. Voir specs/admin.md#incarnation.
 */
export async function getSessionUser(event: H3Event): Promise<User | null> {
  const session = await useAuthSession(event)

  return loadUser(session.data.userId)
}

/**
 * Le joueur que le jeu doit servir : celui qu'un admin incarne, ou le compte
 * connecté. Seul endroit où la bascule se lit — les endpoints de jeu reçoivent
 * un `User` et n'ont pas à savoir d'où il vient.
 *
 * Une incarnation qui ne tient plus — cible supprimée, cible qui n'est pas un
 * joueur test, ou porteur qui n'est pas admin — est ignorée plutôt qu'honorée :
 * on rend le compte connecté, jamais une erreur. Le champ de session peut
 * survivre à ce qu'il désigne.
 */
export async function getCurrentUser(event: H3Event): Promise<User | null> {
  const session = await useAuthSession(event)
  const signedIn = await loadUser(session.data.userId)

  if (!signedIn?.isAdmin || !session.data.actingAsUserId) {
    return signedIn
  }

  const acted = await loadUser(session.data.actingAsUserId)

  return acted?.isTest ? acted : signedIn
}

/** Call at the top of a protected handler. */
export async function requireAuth(event: H3Event): Promise<User> {
  const user = await getCurrentUser(event)
  if (!user) {
    throw createError({ statusCode: 401, statusMessage: 'Non authentifié' })
  }
  return user
}

/**
 * Call at the top of an admin handler. Lit le compte connecté et non l'identité
 * incarnée : c'est la seule façon de rester admin sous le masque.
 */
export async function requireAdmin(event: H3Event): Promise<User> {
  const user = await getSessionUser(event)
  if (!user) {
    throw createError({ statusCode: 401, statusMessage: 'Non authentifié' })
  }
  if (!user.isAdmin) {
    throw createError({ statusCode: 403, statusMessage: 'Accès admin requis' })
  }
  return user
}

/**
 * Le joueur, s'il a encore le droit d'être servi.
 *
 * La whitelist se relit ici et pas seulement à la connexion : la session dure un
 * an, donc la lire une seule fois laisserait un joueur désinvité jouer jusqu'à
 * l'expiration de son cookie. En jointure sur la requête qui existait déjà, donc
 * sans un aller-retour de plus — voir tests/server/query-budget.test.ts.
 *
 * Un joueur test échappe à la règle : son `discordId` est synthétique et aucune
 * whitelist ne le portera jamais. Le refuser ici ferait tomber l'incarnation,
 * qui passe par le même chemin. Voir server/utils/testPlayers.ts.
 */
async function loadUser(id: number | undefined): Promise<User | null> {
  if (!id) {
    return null
  }

  const [row] = await useDatabase()
    .select({ user: users, invited: whitelist.discordId })
    .from(users)
    .leftJoin(whitelist, eq(whitelist.discordId, users.discordId))
    .where(eq(users.id, id))
    .limit(1)

  if (!row) {
    return null
  }

  return row.invited !== null || row.user.isTest ? row.user : null
}
