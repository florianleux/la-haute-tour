import { and, eq, exists, inArray, sql } from 'drizzle-orm'
import { pendingEffects } from './effects'
import { rulesForFloor } from './rules'
import { activeEffects, attempts, users } from '../db/schema'
import type { FloorRules } from './rules'
import type { Database } from '../db/client'
import type { User } from '../db/schema'

/**
 * Ouvre une tentative : les vies reviennent, l'attente s'efface, et ce qui
 * attendait s'y ancre. Appelée aux deux endroits où une tentative commence, et
 * nulle part ailleurs — une vie rendue par une contestation poursuit celle en
 * cours et ne réveille donc aucun effet. Voir specs/validation.md#contestation.
 *
 * Rend null quand une autre requête vient de l'ouvrir. Deux requêtes parties
 * ensemble — deux « Reprendre », deux onglets qui relisent l'état au bout de
 * l'attente — partent de la même tentative finie. Sans garde, la seconde ne
 * trouverait plus rien à ancrer et rendrait des vies sans les effets — une
 * Vitalité noire s'effacerait ainsi —, et son instant d'ouverture ne serait plus
 * celui des ancres, qui mourraient avec. Le lot se garde donc sur la tentative
 * qui s'achève, et l'écriture qui la remplace part en dernier : seule la
 * première la trouve encore en place. Qui reçoit null n'a plus rien à écrire.
 */
export async function openAttempt(
  db: Database,
  user: User,
  now: Date,
  /**
   * Faux quand la tentative qui s'ouvre est un combat de boss : les Sorts n'y
   * agissent pas, ce qui attendait reste en attente pour la tentative
   * d'ascension suivante, et les vies sont celles de l'étage. Voir specs/boss.md.
   */
  anchorEffects = true,
): Promise<FloorRules | null> {
  // Les vies de la tentative dépendent de ce qui l'attend : lu d'abord, puis
  // ancré dans le même lot que les vies.
  const { ids, rules } = anchorEffects
    ? await pendingEffects(db, user)
    : { ids: [], rules: rulesForFloor(user.currentFloor) }
  const unchanged = and(eq(users.id, user.id), eq(users.attemptStartedAt, user.attemptStartedAt))

  const [, opened] = await db.batch([
    // Les effets en attente s'ancrent sur cette tentative-ci : c'est le même
    // instant qui sert d'ancre et de début de tentative, et les deux s'écrivent
    // ici pour qu'aucun appelant ne puisse les désaccorder.
    // Voir specs/bonus.md#ancrage-et-durée-de-vie.
    db
      .update(activeEffects)
      .set({ anchoredAt: now })
      .where(and(
        inArray(activeEffects.id, ids),
        exists(db.select({ one: sql`1` }).from(users).where(unchanged)),
      )),
    db
      .update(users)
      // Tentative neuve : son décompte de questions vues repart de zéro, dans la
      // même écriture que son instant d'ouverture — les deux disent la même chose,
      // ils ne peuvent pas se désaccorder. Voir server/db/schema.ts.
      .set({
        lives: rules.lives,
        cooldownUntil: null,
        cooldownStartedAt: null,
        attemptStartedAt: now,
        attemptSeen: 0,
        // La série ne traverse pas les tentatives : « sans faute » veut dire d'une
        // seule traite, et une tentative neuve est justement ce qui coupe la traite.
        // Voir specs/succes.md#série-sans-faute.
        streak: 0,
      })
      .where(unchanged),
  ])

  return opened.rowsAffected > 0 ? rules : null
}

/**
 * Clôt la tentative en cours et enregistre sa longueur, en questions vues.
 *
 * Appelée au moment où la tentative suivante s'ouvre, jamais à la perte de la
 * dernière vie : entre les deux, une contestation acceptée peut rendre une vie
 * et faire repartir la même tentative. Ce qui est écrit ici ne bouge plus.
 *
 * Une tentative sans aucune question vue n'en est pas une : rien n'est écrit.
 */
export async function closeAttempt(db: Database, user: User, now: Date): Promise<void> {
  // Le joueur porte déjà sa longueur : la recompter lisait une ligne par
  // question qu'il a vue. Voir server/db/schema.ts.
  const seen = user.attemptSeen

  if (seen === 0) {
    return
  }

  await db.insert(attempts).values({
    userId: user.id,
    startedAt: user.attemptStartedAt,
    endedAt: now,
    seen,
    floor: user.currentFloor,
  })
}
