import { and, eq, inArray, isNotNull, isNull, ne } from 'drizzle-orm'
import { achievements, activeEffects, disputes, questions, users } from '../db/schema'
import { displayNameColumn } from './names'
import type { SQL } from 'drizzle-orm'
import type { Database } from '../db/client'
import type { User } from '../db/schema'
import type { ReceivedView } from './effects'
import type { AchievementId } from '~~/shared/utils/achievements'

/**
 * Les nouvelles : ce qui est arrivé au joueur sans lui, et qu'il lit sur le
 * poster du camp. Rien n'est stocké à part : chaque source porte déjà sa date,
 * et une colonne `noticedAt` dit si le joueur l'a lue (« OK »).
 * Voir specs/ecrans.md#nouvelles.
 */

/** Une contestation tranchée que le joueur n'a pas encore lue. */
export interface DisputeNotice {
  id: number
  verdict: 'accepted' | 'rejected'
  statement: string
}

/** Un sort qu'un autre joueur a lancé sur lui, et qu'il n'a pas encore lu. */
export interface SpellNotice extends ReceivedView {
  id: number
}

export interface Notices {
  disputes: DisputeNotice[]
  spells: SpellNotice[]
  /**
   * Les succès débloqués sans lui, dont le toast n'a pas encore été joué. Ce ne
   * sont pas des lignes du poster : l'écran les annonce en toast, comme les
   * autres. Voir specs/succes.md#affichage.
   */
  achievements: AchievementId[]
}

/** Ses contestations tranchées, pas encore lues : ce que montre le poster, et ce que « OK » peut lire. */
function unreadDisputesOf(user: User): SQL | undefined {
  return and(eq(disputes.userId, user.id), isNotNull(disputes.settledAt), isNull(disputes.noticedAt))
}

/** Les sorts lancés sur lui par un autre, pas encore lus. Un sort lancé sur soi n'est pas une nouvelle : le joueur était là. */
function unreadSpellsOf(user: User): SQL | undefined {
  return and(eq(activeEffects.userId, user.id), ne(activeEffects.casterId, user.id), isNull(activeEffects.noticedAt))
}

export async function unreadNotices(db: Database, user: User): Promise<Notices> {
  // Trois lectures indépendantes, un seul aller-retour : la base est distante.
  const [disputeRows, spellRows, achievementRows] = await db.batch([
    db
      .select({ id: disputes.id, verdict: disputes.status, statement: questions.statement })
      .from(disputes)
      .innerJoin(questions, eq(questions.id, disputes.questionId))
      .where(unreadDisputesOf(user))
      .orderBy(disputes.settledAt),
    db
      .select({
        id: activeEffects.id,
        spell: activeEffects.spell,
        face: activeEffects.face,
        casterName: displayNameColumn,
        castAt: activeEffects.castAt,
      })
      .from(activeEffects)
      .innerJoin(users, eq(users.id, activeEffects.casterId))
      .where(unreadSpellsOf(user))
      .orderBy(activeEffects.castAt),
    db
      .select({ id: achievements.achievement })
      .from(achievements)
      .where(and(eq(achievements.userId, user.id), isNull(achievements.announcedAt)))
      .orderBy(achievements.unlockedAt),
  ])

  return {
    // Une contestation tranchée n'est jamais `pending` : le filtre sur
    // `settledAt` l'a déjà écartée, le type ne le sait pas.
    disputes: disputeRows.map(row => ({ ...row, verdict: row.verdict === 'accepted' ? 'accepted' : 'rejected' })),
    spells: spellRows.map(row => ({ ...row, castAt: row.castAt.toISOString() })),
    achievements: achievementRows.map(row => row.id),
  }
}

/**
 * Ce que le joueur lit, par identifiant : une nouvelle (« OK »), ou toutes celles
 * que le poster montrait (« Tout marquer lu »). Jamais « tout ce qui est en
 * base » : ce qui est tombé entre l'affichage et le clic n'a pas été vu.
 */
export interface NoticeRead {
  disputes: number[]
  spells: number[]
}

/**
 * Date la lecture. Chaque écriture est bornée à ses nouvelles non lues : un
 * identifiant qui n'est pas à lui ne touche rien, sans erreur — il n'y avait
 * rien à lire.
 */
export async function markNoticesRead(db: Database, user: User, read: NoticeRead, now: Date): Promise<void> {
  await db.batch([
    db.update(disputes).set({ noticedAt: now }).where(and(unreadDisputesOf(user), inArray(disputes.id, read.disputes))),
    db.update(activeEffects).set({ noticedAt: now }).where(and(unreadSpellsOf(user), inArray(activeEffects.id, read.spells))),
  ])
}

/**
 * Les toasts de ces succès débloqués sans lui ont été joués : ils ne reviennent
 * plus. Ceux-là seulement : un succès débloqué depuis attend encore le sien.
 */
export async function markAchievementsAnnounced(db: Database, user: User, ids: AchievementId[], now: Date): Promise<void> {
  await db
    .update(achievements)
    .set({ announcedAt: now })
    .where(and(eq(achievements.userId, user.id), isNull(achievements.announcedAt), inArray(achievements.achievement, ids)))
}
