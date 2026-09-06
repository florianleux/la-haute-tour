import { asc, eq, sql } from 'drizzle-orm'
import { useDatabase } from '../db/client'
import { disputes, questions, reservations, seenQuestions, users } from '../db/schema'
import { phaseOf } from './mechanics'
import { numericRouteId } from './routes'
import type { H3Event } from 'h3'
import type { Database } from '../db/client'
import type { User } from '../db/schema'
import type { Phase } from './mechanics'
import type { TeamId } from '../../shared/utils/teams'

/**
 * Les fiches joueurs de l'administration : où en est chacun, d'un seul coup
 * d'œil. Voir specs/admin.md#gestion-des-joueurs.
 *
 * Lecture pure, et c'est la raison d'être du fichier : `readGameState` écrit —
 * elle résout une réservation expirée et clôt une attente échue. L'appeler une
 * fois par joueur pour dresser une liste ferait avancer la partie de tout le
 * monde à chaque ouverture de l'onglet.
 */
export interface PlayerCard {
  userId: number
  username: string
  discordId: string
  /** Hash d'avatar Discord, null tant que le joueur ne s'est pas reconnecté. */
  avatar: string | null
  floor: number
  lives: number
  phase: Phase
  /** Questions vues à l'étage courant, sur ce que l'étage contient. */
  floorSeen: number
  floorTotal: number
  /** Fin de l'attente en ISO 8601, null hors attente. */
  cooldownUntil: string | null
  /** Contestations de ce joueur encore à arbitrer. */
  pendingDisputes: number
  /** Son équipe, null tant que l'admin ne l'a pas placé. Voir specs/equipes.md. */
  team: TeamId | null
}

/**
 * Le joueur qu'un geste d'admin vise. Un identifiant qui ne désigne personne est
 * une erreur du client, pas un cas de jeu.
 */
export async function requirePlayer(db: Database, id: number): Promise<User> {
  const [player] = await db.select().from(users).where(eq(users.id, id)).limit(1)

  if (!player) {
    throw createError({ statusCode: 404, statusMessage: 'Joueur introuvable' })
  }

  return player
}

/**
 * Le joueur que la route désigne. Écrit une fois : huit gestes d'administration
 * partagent la même lecture de paramètre, et deux copies divergeaient déjà sur
 * ce qu'est un identifiant valide.
 */
export async function playerFromRoute(event: H3Event): Promise<User> {
  return requirePlayer(useDatabase(), numericRouteId(event, 'Joueur inconnu'))
}

/**
 * Tous les joueurs, en une requête : les décomptes sont des sous-requêtes
 * corrélées, donc leur nombre ne suit pas celui des joueurs.
 * La phase se dérive ensuite par `phaseOf` — aucune règle n'est réécrite ici.
 */
export async function playerRoster(db: Database, now: Date): Promise<PlayerCard[]> {
  return roster(db, now, false)
}

/**
 * Les mêmes fiches, pour les joueurs test. Une seule requête pour les deux
 * mondes : ce qu'on lit d'un joueur ne change pas selon qu'il est réel ou non,
 * seul le filtre change. Voir specs/admin.md#joueurs-test.
 */
export async function testPlayerRoster(db: Database, now: Date): Promise<PlayerCard[]> {
  return roster(db, now, true)
}

async function roster(db: Database, now: Date, isTest: boolean): Promise<PlayerCard[]> {
  const rows = await db
    .select({
      user: users,
      floorSeen: sql<number>`(select count(*) from ${seenQuestions}
        where ${seenQuestions.userId} = ${users.id}
          and ${seenQuestions.floor} = ${users.currentFloor})`,
      floorTotal: sql<number>`(select count(*) from ${questions}
        where ${questions.floor} = ${users.currentFloor})`,
      liveReservations: sql<number>`(select count(*) from ${reservations}
        where ${reservations.userId} = ${users.id}
          and ${reservations.resolvedAt} is null)`,
      pendingDisputes: sql<number>`(select count(*) from ${disputes}
        where ${disputes.userId} = ${users.id}
          and ${disputes.status} = 'pending')`,
    })
    .from(users)
    // Les deux mondes ne se mélangent jamais : l'onglet Joueurs sert à arbitrer
    // de vraies parties, et y mêler des fantômes fausserait ce qu'on y lit.
    // Voir specs/admin.md#joueurs-test.
    .where(eq(users.isTest, isTest))
    .orderBy(asc(users.username))

  return rows.map(row => ({
    userId: row.user.id,
    username: row.user.username,
    discordId: row.user.discordId,
    avatar: row.user.avatar,
    floor: row.user.currentFloor,
    lives: row.user.lives,
    phase: phaseOf({
      user: row.user,
      hasLiveReservation: row.liveReservations > 0,
      seen: row.floorSeen,
      floorTotal: row.floorTotal,
    }, now),
    floorSeen: row.floorSeen,
    floorTotal: row.floorTotal,
    cooldownUntil: row.user.cooldownUntil?.toISOString() ?? null,
    pendingDisputes: row.pendingDisputes,
    team: row.user.team,
  }))
}
