import type { Gender } from '~~/shared/utils/genders'

/** Le portrait de chaque genre, celui que l'introduction donne au joueur quand il dit ce qu'il est. */
const PLAYER_PORTRAITS: Record<Gender, string> = {
  MALE: '/images/intro-player-male.webp',
  FEMALE: '/images/intro-player-female.webp',
  NEUTRAL: '/images/intro-player-neutral.webp',
}

/**
 * Le portrait d'un joueur. Sans genre (un compte qui n'a jamais répondu à
 * L'Inconnu, l'admin), l'aventurier : la silhouette sans visage n'a de sens
 * qu'à l'introduction, tant que la question est posée.
 */
export function playerPortrait(gender: Gender | null): string {
  return PLAYER_PORTRAITS[gender ?? 'MALE']
}
