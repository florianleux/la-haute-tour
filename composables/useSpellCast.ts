import { prefersReducedMotion, wait } from '../utils/motion'
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
 * elles bougent ensemble. L'éclat, lui, n'a pas de durée : le titre et la
 * vignette tiennent jusqu'au OK du joueur (`dismiss`, components/SpellCastBurst.vue).
 */
export const CHARGE_MS = 1500
export const FIZZLE_MS = 700

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
  /** Le OK du titre : le lancer parti finit, et `play` rend la main. */
  dismiss: () => void
} {
  const cast = ref<SpellCast | null>(null)
  /** Ce qui termine l'éclat en cours, tant que le titre attend son OK. */
  let release: (() => void) | null = null

  function dismiss(): void {
    release?.()
    release = null
  }

  async function play(spell: SpellId, face: SpellFace, send: () => Promise<CastHeadline | null>): Promise<void> {
    if (prefersReducedMotion()) {
      await send()
      return
    }

    cast.value = { spell, face, stage: 'charging', headline: null }
    const [headline] = await Promise.all([send(), wait(CHARGE_MS)])

    cast.value = { spell, face, stage: headline ? 'release' : 'fizzle', headline }
    await (headline ? new Promise<void>((resolve) => { release = resolve }) : wait(FIZZLE_MS))

    cast.value = null
  }

  return { cast, play, dismiss }
}
