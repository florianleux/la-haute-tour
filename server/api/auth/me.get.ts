import { useDatabase } from '~~/server/db/client'
import { listTestPlayers } from '~~/server/utils/testPlayers'
import { displayName } from '~~/server/utils/names'
import type { User } from '~~/server/db/schema'

/**
 * Identity only — floor and lives come from `/api/game/state`, the single
 * definition of where the player stands. See specs/architecture.md.
 */
export type SessionUser = Pick<User, 'id' | 'username' | 'isAdmin' | 'team'> & {
  /** Le nom que le jeu montre. Voir server/utils/names.ts. */
  displayName: string
  /** ISO 8601: a `Date` doesn't survive the trip to the client. */
  createdAt: string
  /** Il a fini l'introduction : sans ça, toute page l'y ramène. */
  introDone: boolean
}

export interface MeResponse {
  /** Qui le jeu croit que tu es : le joueur test incarné, ou toi. */
  user: SessionUser | null
  /**
   * Toi, quand tu en incarnes un autre — null sinon. C'est lui qui porte les
   * droits : l'écran y lit qu'il faut garder l'administration et le sélecteur,
   * sans quoi l'incarnation serait sans retour. Voir specs/admin.md#incarnation.
   */
  impersonator: SessionUser | null
  /** Ce que le sélecteur propose d'incarner. Vide pour qui n'est pas admin. */
  testPlayers: SessionUser[]
}

export default defineEventHandler(async (event): Promise<MeResponse> => {
  const user = await getCurrentUser(event)

  if (!user) {
    return { user: null, impersonator: null, testPlayers: [] }
  }

  // Le compte connecté, qu'on ne montre que s'il diffère de l'identité servie :
  // hors incarnation, les deux sont la même personne et le dire deux fois
  // laisserait l'écran choisir laquelle croire.
  const signedIn = await getSessionUser(event)
  const impersonating = signedIn !== null && signedIn.id !== user.id
  const admin = impersonating ? signedIn : user

  return {
    user: sessionUser(user),
    impersonator: impersonating ? sessionUser(signedIn) : null,
    testPlayers: admin.isAdmin
      ? (await listTestPlayers(useDatabase())).map(sessionUser)
      : [],
  }
})

function sessionUser(user: User): SessionUser {
  return {
    id: user.id,
    username: user.username,
    displayName: displayName(user),
    isAdmin: user.isAdmin,
    team: user.team,
    createdAt: user.createdAt.toISOString(),
    introDone: user.introDoneAt !== null,
  }
}
