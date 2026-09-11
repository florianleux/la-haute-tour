import { asc, eq, sql } from 'drizzle-orm'
import { useDatabase } from '../db/client'
import {
  achievements,
  activeEffects,
  attempts,
  deckFloors,
  disputes,
  inventory,
  missedPool,
  recoveryQuestions,
  reservations,
  seenQuestions,
  users,
} from '../db/schema'
import { phaseOf } from './mechanics'
import { numericRouteId } from './routes'
import { rulesForFloor } from './rules'
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
 * Le joueur que la route désigne. La porte d'entrée de tout geste
 * d'administration qui vise un joueur — `testPlayerFromRoute()` y ajoute sa
 * garde. Écrit une fois : deux copies divergeaient déjà sur ce qu'est un
 * identifiant valide, et une troisième est arrivée avec les équipes.
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
      // Le compte de l'étage se lit au deck, en une ligne jointe. Compté par
      // sous-requête, il coûtait tout l'étage **par joueur listé** : mille
      // lignes fois vingt fiches pour ouvrir l'onglet. Voir server/utils/deck.ts.
      floorTotal: deckFloors.total,
      liveReservations: sql<number>`(select count(*) from ${reservations}
        where ${reservations.userId} = ${users.id}
          and ${reservations.resolvedAt} is null)`,
      pendingDisputes: sql<number>`(select count(*) from ${disputes}
        where ${disputes.userId} = ${users.id}
          and ${disputes.status} = 'pending')`,
    })
    .from(users)
    .leftJoin(deckFloors, eq(deckFloors.floor, users.currentFloor))
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
      seen: row.user.floorSeen,
      floorTotal: row.floorTotal ?? 0,
    }, now),
    floorSeen: row.user.floorSeen,
    floorTotal: row.floorTotal ?? 0,
    cooldownUntil: row.user.cooldownUntil?.toISOString() ?? null,
    pendingDisputes: row.pendingDisputes,
    team: row.user.team,
  }))
}

/**
 * Effacer la partie d'un joueur et le rendre neuf : étage 1, vies pleines, plus
 * rien vu ni raté. D'abord écrit pour les joueurs test (`resetTestPlayer`, qui
 * s'appuie dessus), et ouvert depuis à un vrai joueur bloqué ou testé en
 * solo — la remise à zéro ne dépend de rien qui soit propre à l'un des deux
 * mondes. Voir specs/admin.md#gestion-des-joueurs.
 */
export async function resetPlayer(db: Database, player: User, now: Date): Promise<void> {
  // Le palmarès n'est pas la partie : remettre un joueur à zéro remet sa partie à
  // zéro, pas ce qu'il a accompli. Les joueurs test font exception — ils existent
  // pour rejouer des situations, et une « première fois » ne se testerait qu'une
  // seule fois si leurs succès survivaient. Voir specs/succes.md#remise-à-zéro.
  //
  // Les vues de toujours suivent la même règle, parce qu'elles nourrissent les
  // mêmes succès : les garder chez un joueur test rendrait « Question n°67 »
  // intestable après le premier essai.
  const palmares = player.isTest ? { seenTotal: 0 } : {}

  if (player.isTest) {
    await db.delete(achievements).where(eq(achievements.userId, player.id))
  }

  await db.batch([
    db.delete(seenQuestions).where(eq(seenQuestions.userId, player.id)),
    db.delete(missedPool).where(eq(missedPool.userId, player.id)),
    db.delete(inventory).where(eq(inventory.userId, player.id)),
    db.delete(activeEffects).where(eq(activeEffects.userId, player.id)),
    db.delete(activeEffects).where(eq(activeEffects.casterId, player.id)),
    db.delete(recoveryQuestions).where(eq(recoveryQuestions.userId, player.id)),
    db.delete(reservations).where(eq(reservations.userId, player.id)),
    db.delete(attempts).where(eq(attempts.userId, player.id)),
    db
      .update(users)
      .set({
        currentFloor: 1,
        lives: rulesForFloor(1).lives,
        cooldownUntil: null,
        cooldownStartedAt: null,
        floorCursor: 0,
        floorSeen: 0,
        attemptSeen: 0,
        attemptStartedAt: now,
        // La série repart avec la partie : elle décrit la tentative en cours, qui
        // n'existe plus. Les vues de toujours et les jours joués, non — les
        // premières ne redescendent jamais, les seconds disent une assiduité et
        // personne n'a « désassisté » en étant remis à zéro.
        streak: 0,
        ...palmares,
      })
      .where(eq(users.id, player.id)),
  ])
}
