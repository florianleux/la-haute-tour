import type { Ref } from 'vue'
import type { SpellFace, SpellId } from '~~/shared/utils/spells'
import type { CastHeadline } from '~~/utils/spells'

/**
 * Où en est l'animation d'un lancer : la montée en puissance, puis le climax et
 * l'envol si le sort est parti, ou l'extinction s'il ne l'est pas.
 */
export type CastStage = 'charging' | 'release' | 'fizzle'

/** Le lancer qu'on anime : quel sort, sur quelle face, à quelle étape. */
export interface SpellCast {
  spell: SpellId
  face: SpellFace
  stage: CastStage
  /** Le titre qui jaillit après l'envol, connu une fois le sort parti. */
  headline: CastHeadline | null
}

/**
 * Les durées de `animate-cast-charge` et `-fizzle` (assets/css/main.css) :
 * elles bougent ensemble. L'éclat dure plus que `animate-cast-release` (1,4 s) :
 * le titre tient encore 2,5 s après l'envol, puis s'efface avec la vignette, à 3,6 s
 * (components/SpellCastBurst.vue et SpellbookDetails.vue).
 */
export const CHARGE_MS = 1500
export const RELEASE_MS = 3850
export const FIZZLE_MS = 700

function wait(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms))
}

/**
 * L'animation d'un lancer, autour de sa requête. La requête part au clic et la
 * montée en puissance la cache : le climax ne joue qu'une fois les deux finies,
 * et seulement si le sort est parti. Voir components/SpellCastBurst.vue.
 *
 * Des minuteurs plutôt que `animationend`, comme le coffre : sous « réduire les
 * animations », `motion-safe:` retire l'animation et l'événement ne viendrait
 * jamais. Pour la même raison, on n'y attend alors que la requête.
 */
export function useSpellCast(): {
  /** Le lancer en cours d'animation, null au repos. */
  cast: Ref<SpellCast | null>
  /**
   * Anime le lancer de `spell` pendant que `send` part. `send` rend le titre à
   * annoncer si le sort est parti, null s'il ne l'est pas.
   */
  play: (spell: SpellId, face: SpellFace, send: () => Promise<CastHeadline | null>) => Promise<void>
} {
  const cast = ref<SpellCast | null>(null)

  async function play(spell: SpellId, face: SpellFace, send: () => Promise<CastHeadline | null>): Promise<void> {
    if (globalThis.matchMedia?.('(prefers-reduced-motion: reduce)').matches) {
      await send()
      return
    }

    cast.value = { spell, face, stage: 'charging', headline: null }
    const [headline] = await Promise.all([send(), wait(CHARGE_MS)])

    cast.value = { spell, face, stage: headline ? 'release' : 'fizzle', headline }
    await wait(headline ? RELEASE_MS : FIZZLE_MS)

    cast.value = null
  }

  return { cast, play }
}
