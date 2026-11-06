import { LESSON_PAUSE_MS } from './lessons'

/** Le temps que l'intoxication met à monter : Michel se tait pendant ce temps. */
export const HAZE_RAMP_MS = LESSON_PAUSE_MS

/** Un tour complet des couleurs. */
const HUE_TURN_MS = 6_000

/** Un tour complet de la houle. */
const SWELL_MS = 6_000

/** La déformation la plus forte : sur du texte, encore lisible, pas confortable. */
const DISPLACEMENT = 60

const SATURATION = 1.6

/** Ce que le filtre d'IntoxicationHaze applique à un instant donné. */
export interface Haze {
  /** La matrice qui tire la houle du bruit (swellMatrix). */
  swell: string
  displacement: number
  hue: number
  saturation: number
}

/**
 * La houle de l'instant : un bruit fixe, dont chaque canal est indépendant. Le
 * rouge et le vert, puis le bleu et l'alpha, se mêlent en tournant (cos, sin) :
 * chaque point de l'écran oscille à son heure, jamais tous ensemble. Faire
 * varier la fréquence du bruit marquait au contraire une apogée sur tout l'écran.
 */
function swellMatrix(turn: number): string {
  const cos = Math.cos(turn)
  const sin = Math.sin(turn)
  const center = (1 - cos - sin) / 2

  return `${cos} ${sin} 0 0 ${center}  0 0 ${cos} ${sin} ${center}  0 0 0 0 0  0 0 0 0 1`
}

/** Sous « réduire les animations » : pas de vagues, les couleurs restent. */
export const STILL_HAZE: Haze = { swell: swellMatrix(0), displacement: 0, hue: 50, saturation: SATURATION }

/** L'intoxication, `elapsed` ms après sa montée. */
export function hazeAt(elapsed: number): Haze {
  const ramp = Math.min(elapsed / HAZE_RAMP_MS, 1)

  return {
    swell: swellMatrix(elapsed / SWELL_MS * 2 * Math.PI),
    displacement: DISPLACEMENT * ramp,
    hue: (elapsed / HUE_TURN_MS * 360) % 360,
    saturation: 1 + (SATURATION - 1) * ramp,
  }
}
