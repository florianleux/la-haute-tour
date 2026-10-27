import { BOSS_DOORS, type BossDoorEntry } from './bossDoors'
import { BOSS_INTROS, type BossIntroEntry } from './bossIntros'
import { BOSSES, type BossEntry } from './bosses'

/** Ce qui met en scène le boss d'un étage : sa porte, son introduction, lui. */
export interface BossStage {
  /** L'étage dont viennent les images : celui de ce boss. */
  floor: number
  boss: BossEntry
  door: BossDoorEntry
  intro: BossIntroEntry | undefined
}

/**
 * Le boss d'un étage, sa porte et son introduction, lus aux trois catalogues.
 * ponytail: Julien Le Perse garde tous les étages tant que les autres boss
 * n'existent pas ; un étage entre au catalogue avec son boss. Voir specs/boss.md.
 */
export function bossStageOf(floor: number): BossStage {
  const at = BOSSES[floor] && BOSS_DOORS[floor] ? floor : 1

  return { floor: at, boss: BOSSES[at]!, door: BOSS_DOORS[at]!, intro: BOSS_INTROS[at] }
}
