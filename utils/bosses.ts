/** La pose du boss, un corps par pose : bras derrière le dos (`back`), bras écartés (`open`). */
export type BossPose = 'back' | 'open'

/** L'expression du boss, une tête par expression. */
export type BossExpression = 'stern' | 'shout' | 'angry' | 'laugh'

/**
 * La figure du boss : ses corps et ses têtes, sous public/images/boss/<étage>/,
 * rognés par `cleanimage` (les têtes ensemble : même cadrage). Chaque pièce se
 * place en classes Tailwind (`left-[x%] top-[y%] w-[w%]`) sur le cadre de la
 * figure, dont `frame` donne les proportions : la tête ne bouge pas d'une pose
 * à l'autre, seul le corps change.
 */
export interface BossFigure {
  frame: string
  bodies: Record<BossPose, { src: string, box: string }>
  heads: Record<BossExpression, string>
  headBox: string
}

/** Une entrée du catalogue des boss (`bosses`) : qui il est, quelle que soit la phase. */
export interface BossEntry {
  /** Son nom : en grand titre dans l'introduction, sur sa barre de vie au combat. */
  name: string
  /** Son épithète, en plus petit au-dessus de son nom, dans l'introduction. */
  epithet?: string
  /** Sa figure : l'écran de chargement du boss l'attend, celui du jeu non. */
  figure: BossFigure
  /**
   * Sa pose à l'arène du combat, et la place de sa figure en classes
   * Tailwind (`fixed`, bord gauche, hauteur). Il s'y tient à gauche, posé au
   * bas de l'écran, un peu coupé par le bord.
   */
  arena: { pose: BossPose, box: string }
}

/**
 * Les boss, par étage. Catalogue fixe, écrit dans le code comme ceux des
 * portes et des introductions, qui le complètent phase par phase.
 * Voir specs/boss.md.
 */
export const BOSSES: Readonly<Partial<Record<number, BossEntry>>> = {
  1: {
    name: 'Julien le perse',
    epithet: 'Gardien de la Lune',
    // Le cadre (947×669) : la tête posée sur le corps bras écartés, qui en
    // prend toute la largeur. Le corps bras dans le dos (542 de large) y est
    // placé sous le même collier : la tête ne bouge pas quand il change.
    figure: {
      frame: 'aspect-[947/669]',
      bodies: {
        back: { src: '/images/boss/1/julien-body-back.webp', box: 'left-[19.96%] top-[44.1%] w-[57.23%]' },
        open: { src: '/images/boss/1/julien-body-open.webp', box: 'left-0 top-[44.1%] w-full' },
      },
      heads: {
        stern: '/images/boss/1/julien-head-stern.webp',
        shout: '/images/boss/1/julien-head-shout.webp',
        angry: '/images/boss/1/julien-head-angry.webp',
        laugh: '/images/boss/1/julien-head-laugh.webp',
      },
      headBox: 'left-[37.06%] top-0 w-[24.92%]',
    },
    // Bras dans le dos. Son cadre a la largeur des bras écartés : le corps
    // bras dans le dos y commence à 19,96 %, soit 17,5dvh à 62dvh de haut,
    // retranchés pour que son bord gauche reste à -5vw.
    arena: { pose: 'back', box: '-left-[calc(5vw+17.5dvh)] h-[62dvh]' },
  },
}
