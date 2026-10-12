import { hasRecoveryRun, readPhase } from './game'
import type { Database } from '../db/client'
import type { User } from '../db/schema'

/**
 * Réservé au camp : l'attente, puis le rattrapage tant qu'il n'est pas tiré.
 * Les Sorts ne se lancent que là, et le Volumen ne relit ses réponses que là —
 * le rattrapage tire dans le Pool Échecs, les lire pendant qu'il tourne serait
 * tricher. URL comprise, d'où le refus ici et pas seulement dans la navigation.
 * Même règle que isAtCamp() côté écran.
 * Voir specs/spec.md#glossaire (Camp), specs/ecrans.md#sorts et specs/ecrans.md#volumen.
 *
 * La phase se lit par `readPhase`, et non par l'état complet : une garde ne doit
 * pas faire avancer la partie qu'elle protège. Le rattrapage tiré se lit à ses
 * questions, qui n'existent que tant qu'il est en cours.
 */
export async function requireCamp(db: Database, user: User, now: Date): Promise<void> {
  const phase = await readPhase(db, user, now)

  if (phase === 'cooldown') {
    return
  }

  if (phase === 'recovery' && !await hasRecoveryRun(db, user.id)) {
    return
  }

  throw createError({ statusCode: 403, statusMessage: 'Réservé au camp' })
}
