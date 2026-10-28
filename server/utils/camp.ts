import { eq } from 'drizzle-orm'
import { reservations } from '../db/schema'
import { hasRecoveryRun, readPhase } from './game'
import type { Database } from '../db/client'
import type { User } from '../db/schema'

/**
 * Réservé au camp : l'attente, le rattrapage tant qu'il n'est pas tiré,
 * l'ascension au repos, et la porte du boss dont le joueur est redescendu.
 * Les Sorts ne se lancent que là, et le Volumen ne relit ses réponses que là —
 * le rattrapage tire dans le Pool Échecs, les lire pendant qu'il tourne serait
 * tricher. Le refus vit ici : l'écran n'ouvre ses boîtes qu'au camp, mais
 * l'API se demande sans passer par lui.
 * Même règle que isAtCamp() côté écran.
 * Voir specs/spec.md#glossaire (Camp), specs/ecrans.md#sorts et specs/ecrans.md#volumen.
 *
 * La phase se lit par `readPhase`, et non par l'état complet : une garde ne doit
 * pas faire avancer la partie qu'elle protège. Le rattrapage tiré se lit à ses
 * questions, qui n'existent que tant qu'il est en cours. Le repos, à l'absence
 * de toute réservation : `readPhase` ne voit que la question en main, pas le
 * verdict encore à lire. Voir docs/adr/0012-le-camp-au-repos-se-deduit-de-l-ascension.md.
 */
export async function requireCamp(db: Database, user: User, now: Date): Promise<void> {
  const phase = await readPhase(db, user, now)

  if (phase === 'cooldown') {
    return
  }

  if (phase === 'recovery' && !await hasRecoveryRun(db, user.id)) {
    return
  }

  if (phase === 'ascent' && !await hasReservation(db, user.id)) {
    return
  }

  if (phase === 'bossDoor' && user.doorSpot === 'camp') {
    return
  }

  throw createError({ statusCode: 403, statusMessage: 'Réservé au camp' })
}

/** Une question réservée, en main ou résolue : l'ascension n'est pas au repos. */
async function hasReservation(db: Database, userId: number): Promise<boolean> {
  const held = await db
    .select({ userId: reservations.userId })
    .from(reservations)
    .where(eq(reservations.userId, userId))
    .limit(1)

  return held.length > 0
}
