/**
 * Les couleurs qui portent un jugement, écrites une fois : réussite, perte,
 * réserve. `neutral` n'en porte aucun — le composant garde alors la sienne.
 */
export type Tone = 'neutral' | 'success' | 'danger' | 'warning'

const TONE_TEXT: Record<Exclude<Tone, 'neutral'>, string> = {
  success: 'text-emerald-400',
  danger: 'text-rose-400',
  warning: 'text-amber-400',
}

/**
 * La classe de couleur d'un ton, ou celle que le composant porte sans jugement.
 * Une seule à la fois : deux classes de texte s'annuleraient selon l'ordre de la
 * feuille de style, pas selon l'ordre écrit dans le template.
 */
export function toneClass(tone: Tone, neutral: string): string {
  return tone === 'neutral' ? neutral : TONE_TEXT[tone]
}
