import { and, eq } from 'drizzle-orm'
import { recoveryQuestions, reservations, users } from '../db/schema'
import type { Database } from '../db/client'
import type { User } from '../db/schema'

/**
 * Ce que l'administration peut rendre à un joueur : une vie, ou la fin de son
 * attente. Deux gestes seulement, écrits ici parce qu'ils sont exercés depuis
 * deux endroits — l'arbitrage d'une contestation et l'onglet Joueurs — et qu'un
 * second exemplaire divergerait. Voir specs/admin.md#gestion-des-joueurs.
 */

/**
 * Rendre une vie. Sans plafond : c'est une réparation, pas une récompense — la
 * plafonner l'annulerait précisément là où le joueur a le plus attendu.
 *
 * Sans vie, le joueur attendait ou rattrapait : l'attente est annulée comme si
 * elle n'avait jamais commencé, le rattrapage tiré avec elle, et il reprend **la
 * même tentative** avec une vie — les autres pertes restent acquises, donc
 * `attemptStartedAt` ne bouge pas.
 */
export async function grantLife(db: Database, player: User): Promise<void> {
  if (player.lives > 0) {
    await db
      .update(users)
      .set({ lives: player.lives + 1 })
      .where(eq(users.id, player.id))

    return
  }

  await db.batch([
    db.delete(recoveryQuestions).where(eq(recoveryQuestions.userId, player.id)),
    // La question de rattrapage en cours n'a plus lieu d'être ; un verdict
    // d'ascension, lui, reste à lire.
    db.delete(reservations).where(and(
      eq(reservations.userId, player.id),
      eq(reservations.mode, 'recovery'),
    )),
    db
      .update(users)
      .set({ lives: 1, cooldownUntil: null, cooldownStartedAt: null })
      .where(eq(users.id, player.id)),
  ])
}

/**
 * Faire échoir l'attente maintenant. L'échéance est repoussée dans le passé et
 * non effacée : c'est elle, non nulle et dépassée, qui autorise la lecture
 * suivante à rendre les vies quand le Pool Échecs est trop petit pour tirer un
 * rattrapage. À null, le joueur resterait en rattrapage sans rien à rattraper.
 *
 * Sans attente en cours, il n'y a rien à passer.
 */
export async function skipCooldown(db: Database, player: User, now: Date): Promise<void> {
  if (player.cooldownUntil === null || now >= player.cooldownUntil) {
    return
  }

  await db
    .update(users)
    .set({ cooldownUntil: now })
    .where(eq(users.id, player.id))
}
