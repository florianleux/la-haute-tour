import { eq, isNull } from 'drizzle-orm'
import {
  DAY_TIERS,
  STREAK_TIERS,
  VIEW_MILESTONES,
  daysAchievement,
  flawlessFloorAchievement,
  isFloor,
  isReachedFloor,
  reachedFloorAchievement,
  streakAchievement,
  viewAchievement,
} from '../../shared/utils/achievements'
import { FLOOR_COUNT } from '../../shared/utils/floors'
import { GAME_TIME_ZONE } from '../../shared/utils/time'
import { achievements, settings } from '../db/schema'
import type { AchievementId } from '../../shared/utils/achievements'
import type { Database } from '../db/client'
import type { User } from '../db/schema'

/**
 * Ce qu un état de jeu prouve, et l écriture qui en découle.
 *
 * Toutes les fonctions de décision rendent des **seuils atteints**, jamais des
 * franchissements : l attribution d un succès ne voyage pas dans le même lot que
 * le fait qui la déclenche, et un seuil rattrape au coup suivant là où une égalité
 * perdrait le succès pour toujours. C est l appelant qui écarte ce que le joueur
 * possède déjà — il le connaît sans rien relire, son instantané le porte.
 * Voir specs/succes.md.
 */

/** Ce qu une réponse d ascension vient de prouver. Les compteurs sont ceux d **après** elle. */
export interface AnsweredInput {
  correct: boolean
  /** Réponse vide, quelle qu en soit la cause — délai, perte de focus, champ vide. */
  empty: boolean
  /** La dernière vie vient de tomber. */
  died: boolean
  streak: number
  seenTotal: number
  daysPlayed: number
  playStreak: number
}

export function earnedByAnswer(input: AnsweredInput): AchievementId[] {
  const earned: AchievementId[] = [input.correct ? 'FIRST_CORRECT' : 'FIRST_WRONG']

  if (input.empty) {
    earned.push('EMPTY_ANSWER')
  }

  if (input.died) {
    earned.push('FIRST_DEATH')
  }

  for (const tier of STREAK_TIERS) {
    if (input.streak >= tier) {
      earned.push(streakAchievement(tier))
    }
  }

  for (const milestone of VIEW_MILESTONES) {
    if (input.seenTotal >= milestone) {
      earned.push(viewAchievement(milestone))
    }
  }

  for (const tier of DAY_TIERS) {
    if (input.daysPlayed >= tier) {
      earned.push(daysAchievement(tier))
    }
  }

  if (input.playStreak >= 2) {
    earned.push('TWO_DAYS_IN_A_ROW')
  }

  return earned
}

/** Un étage dont la dernière question vient d être résolue. */
export interface FloorDoneInput {
  /** L étage qui vient d être achevé, pas celui qu on rejoint. */
  floor: number
  /** Ce que cet étage contenait, en questions. */
  floorTotal: number
  /** La série du joueur à l instant où l étage s achève. */
  streak: number
}

/**
 * Ce qu achever un étage prouve — au moment où sa dernière question est résolue,
 * et non au clic qui franchit le palier.
 *
 * C est la seule occasion pour le dernier étage : la tour finie, la phase passe à
 * `gameOver`, qui ne porte plus aucune action. Personne ne reclique, donc rien ne
 * se gagnerait plus tard. Voir utils/phase.ts et specs/ecrans.md#principes.
 */
export function earnedByFloorDone(input: FloorDoneInput): AchievementId[] {
  const earned: AchievementId[] = []

  // Une série qui couvre l étage entier n a pu être obtenue que d une traite :
  // toute erreur et toute tentative neuve la remettent à zéro. C est ce qui rend
  // le sans-faute lisible sans le stocker. Voir specs/succes.md#étage-sans-faute.
  if (input.floorTotal > 0 && input.streak >= input.floorTotal && isFloor(input.floor)) {
    earned.push(flawlessFloorAchievement(input.floor))
  }

  if (input.floor >= FLOOR_COUNT) {
    earned.push('GAME_COMPLETED')
  }

  return earned
}

/**
 * Ce que franchir le palier donne : l étage d au-dessus, atteint pour de bon.
 * Séparé de l achèvement parce que ce sont deux instants distincts — on finit un
 * étage en répondant, on atteint le suivant en montant.
 */
export function earnedByCrossing(floor: number): AchievementId[] {
  const next = floor + 1

  return isReachedFloor(next) ? [reachedFloorAchievement(next)] : []
}

/**
 * Le jour du jeu, au fuseau que les deux côtés partagent. `en-CA` rend la forme
 * `YYYY-MM-DD`, celle sous laquelle les jours se comparent.
 */
const dayKeyFormat = new Intl.DateTimeFormat('en-CA', { timeZone: GAME_TIME_ZONE })

export function dayKey(now: Date): string {
  return dayKeyFormat.format(now)
}

export interface PlayedDay {
  lastPlayedDay: string
  daysPlayed: number
  playStreak: number
}

/**
 * Ce que devient le compte des jours joués quand une question se résout. Rend null
 * quand le joueur a déjà joué aujourd hui : il n y a alors rien à écrire, et c est
 * ce qui rend l estampille gratuite sur le chemin de la question.
 */
export function playedToday(
  user: Pick<User, 'lastPlayedDay' | 'daysPlayed' | 'playStreak'>,
  now: Date,
): PlayedDay | null {
  const today = dayKey(now)

  if (user.lastPlayedDay === today) {
    return null
  }

  // Comparés en dates et non en millisecondes : un changement d heure fait des
  // journées de 23 et de 25 heures, et « hier » doit rester hier. Deux dates
  // seules se parsent en UTC, donc leur écart est exact.
  const consecutive = user.lastPlayedDay !== null
    && Math.round((Date.parse(today) - Date.parse(user.lastPlayedDay)) / 86_400_000) === 1

  return {
    lastPlayedDay: today,
    daysPlayed: user.daysPlayed + 1,
    playStreak: consecutive ? user.playStreak + 1 : 1,
  }
}

/**
 * Grave les succès qui manquent au joueur, et rend ceux qui viennent réellement
 * d être écrits — ce sont eux, et eux seuls, que l écran annonce.
 *
 * Aucune requête quand il n y a rien à écrire, ce qui est le cas de l immense
 * majorité des réponses : l appelant a déjà retranché ce que le joueur possède.
 * Le conflit ignoré n est donc pas le régime normal, c est le filet — deux
 * requêtes qui se croisent, ou un lot interrompu au coup précédent.
 */
export async function unlock(
  db: Database,
  userId: number,
  ids: AchievementId[],
  now: Date,
): Promise<AchievementId[]> {
  if (!ids.length) {
    return []
  }

  const granted = await db
    .insert(achievements)
    .values(ids.map(achievement => ({ userId, achievement, unlockedAt: now })))
    .onConflictDoNothing()
    .returning({ achievement: achievements.achievement })

  return granted.map(row => row.achievement)
}

/**
 * Le joueur réclame d être le premier en haut de l étage 1. L écriture ne passe
 * que tant que la place est libre, donc deux joueurs qui franchissent ensemble ne
 * peuvent pas l obtenir tous les deux — et personne ne la reprend ensuite.
 *
 * Ni les joueurs test ni l admin ne la réclament : les premiers vivent dans un
 * monde scellé, le second arbitre les parties sans y peser. Sans cela le succès
 * serait pris au premier test qui suit l ouverture.
 * Voir specs/succes.md#premier-sur-le-serveur.
 */
export async function claimFirstAscent(db: Database, user: User): Promise<AchievementId[]> {
  if (user.isTest || user.isAdmin) {
    return []
  }

  // La ligne de réglages peut ne pas exister — elle ne naît qu à la première
  // maintenance. Un upsert plutôt qu un update, sinon le succès ne serait
  // attribuable que sur un jeu déjà fermé une fois. La place ne se prend que
  // tant qu elle est libre, et c est le lot rendu qui dit si on l a eue.
  const [claimed] = await db
    .insert(settings)
    .values({ id: 1, firstAscensionUserId: user.id })
    .onConflictDoUpdate({
      target: settings.id,
      set: { firstAscensionUserId: user.id },
      setWhere: isNull(settings.firstAscensionUserId),
    })
    .returning({ userId: settings.firstAscensionUserId })

  return claimed?.userId === user.id ? ['FIRST_ASCENT'] : []
}

/**
 * Le type exact d une requête Drizzle ne s écrit pas à la main. On le nomme une
 * fois ici, à partir de la requête elle-même, pour que la fonction exportée
 * puisse l annoncer comme le veut CLAUDE.md. Voir server/utils/effects.ts.
 */
type AchievementsQuery = ReturnType<typeof buildAchievementsQuery>

function buildAchievementsQuery(db: Database, userId: number) {
  return db
    .select({ achievement: achievements.achievement })
    .from(achievements)
    .where(eq(achievements.userId, userId))
}

/**
 * Les succès déjà acquis, rendus plutôt qu exécutés : la lecture d état les fait
 * voyager dans le même lot que la réservation. Les connaître est ce qui permet de
 * n écrire que le neuf, donc de ne rien écrire du tout la plupart du temps.
 * Voir tests/server/query-budget.test.ts.
 */
export function achievementsQuery(db: Database, userId: number): AchievementsQuery {
  return buildAchievementsQuery(db, userId)
}

/** Ce que la page Succès montre : ce qui est acquis, et quand. */
export interface UnlockedAchievement {
  id: AchievementId
  unlockedAt: string
}

export async function readAchievements(db: Database, user: User): Promise<UnlockedAchievement[]> {
  const rows = await db
    .select({ achievement: achievements.achievement, unlockedAt: achievements.unlockedAt })
    .from(achievements)
    .where(eq(achievements.userId, user.id))

  return rows.map(row => ({ id: row.achievement, unlockedAt: row.unlockedAt.toISOString() }))
}
