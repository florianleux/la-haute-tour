/**
 * Ce qu'un temps de l'introduction déclenche à son début :
 * - `swarm` : la nuée du boss se lâche, vague après vague, indépendamment des
 *   temps qui suivent ;
 * - `appear` : le boss paraît en fondu, sur place, derrière la nuée s'il y en
 *   a une, et reste jusqu'à la fin, avec ses objets flottants (`levitation`) ;
 *   dès lors, des objets de sa nuée passent
 *   derrière lui de temps en temps, plus petits : plus loin que lui ;
 * - `shout` : il crie, en très gros ; lui et ses cartes tremblent longtemps,
 *   sa fenêtre aussi, à un autre rythme ;
 * - `title` : son nom en grand titre, le temps du temps.
 */
export type BossIntroCue = 'swarm' | 'appear' | 'shout' | 'title'

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

/**
 * Une vague de la nuée : quand elle part, comptée depuis le cue `swarm`,
 * combien d'objets elle lâche, et sur combien de temps ses départs
 * s'étalent (absent, tous ensemble). Une grosse vague étalée couvre l'écran
 * plus longtemps.
 */
export interface SwarmWave {
  atMs: number
  count: number
  spreadMs?: number
}

/**
 * Un temps de l'introduction (`beats`) : une réplique dans une fenêtre, un
 * effet, ou les deux. Une réplique qui reprend le texte du temps d'avant ne le
 * refait pas défiler : la fenêtre reste telle quelle pendant l'effet.
 */
export type BossIntroBeat = {
  /** Avance seul après ce délai, compté depuis le début du temps ; absent, au clic ou à Entrée. */
  holdMs?: number
  cue?: BossIntroCue
  /** La pose et l'expression du boss dès ce temps ; la dernière donnée tient. D'abord `back` et `stern`. */
  pose?: BossPose
  expression?: BossExpression
} & (
  | {
    /** Qui parle : le joueur dans la fenêtre de la porte, le boss dans la sienne. */
    speaker: 'player' | 'boss'
    text: string
  }
  | { speaker?: never, text?: never }
)

/** Une entrée du catalogue des introductions (`bossIntros`) : la mise en scène d'un boss. */
export interface BossIntroEntry {
  /** Le nom du boss, en grand titre au cue `title`, au-dessus de sa tête. */
  name: string
  /** Son épithète, en plus petit au-dessus de son nom, même police. */
  epithet?: string
  /**
   * Sa figure, sous public/images/boss/<étage>/ : l'écran de chargement du
   * boss l'attend, celui du jeu non. Le combat la lit ici aussi.
   */
  figure: BossFigure
  /**
   * La place de la figure en classes Tailwind (`left-[x%] top-[y%]
   * w-[w%]`) de la scène 16:9, relevée sur son calque 1920×1080. La nuée se
   * croise dans cette zone, pour la couvrir au mieux.
   */
  figureBox: string
  /** Les couleurs de sa fenêtre de dialogue : fond, bordure et texte, en classes complètes. */
  windowColors: string
  /** Ce qui traverse l'écran au cue `swarm`, en tous sens. Sans nuée, le cue ne fait rien. */
  swarm?: {
    /** Ses images, prises tour à tour, sous public/images/boss/<étage>/ aussi. */
    images: string[]
    /** Ses vagues, dans l'ordre : leur rythme et leur taille font la montée. */
    waves: SwarmWave[]
  }
  /**
   * Les objets qui flottent au-dessus de ses mains, parus quand il les
   * écarte (pose `open`) : la
   * place de chacun en classes Tailwind (`left-[x%] top-[y%]` de la scène
   * 16:9, plus son inclinaison). Sans, rien ne flotte.
   */
  levitation?: string[]
  beats: [BossIntroBeat, ...BossIntroBeat[]]
}

/**
 * Les introductions de boss, par étage. Catalogue fixe, écrit dans le code
 * comme celui des portes. Un étage sans entrée passe de la porte au combat.
 * Voir specs/boss.md#introduction-et-animations.
 */
export const BOSS_INTROS: Readonly<Partial<Record<number, BossIntroEntry>>> = {
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
    // 15 % plus grand que sur son calque (49,32 % × 1,15), centré, pieds sur
    // le bord bas : sa hauteur passe de 61,94 % à 71,23 % de la scène.
    figureBox: 'left-[21.64%] top-[28.77%] w-[56.72%]',
    windowColors: 'border-[#b8860b] bg-[#fff6cf] text-[#a67607]',
    // Une carte, puis 2, 4, 12, 24, 48 : chaque vague double ou triple, et
    // les dernières s'étalent pour couvrir longtemps la zone du boss.
    // Julien paraît (5,2 s) quand la vague de 48 la cache déjà, et son fondu
    // finit avant qu'elle ne s'éclaircisse (~7 s).
    swarm: {
      images: ['/images/boss/1/qpuc-card.webp', '/images/boss/1/qpuc-card-blur.webp'],
      waves: [
        { atMs: 0, count: 1 },
        { atMs: 1400, count: 2, spreadMs: 250 },
        { atMs: 2600, count: 4, spreadMs: 400 },
        { atMs: 3600, count: 12, spreadMs: 600 },
        { atMs: 4300, count: 24, spreadMs: 700 },
        { atMs: 4800, count: 48, spreadMs: 1600 },
      ],
    },
    // Une carte au-dessus de chaque poing (x 370 et 1227, y 845 sur son
    // calque 1920×1080, rapportés à sa figure agrandie de 15 % : 24 %
    // et 76 % de la scène, à 75 % de haut).
    levitation: [
      'left-[24.25%] top-[59%] -rotate-8',
      'left-[75.6%] top-[59%] rotate-8',
    ],
    beats: [
      { speaker: 'player', text: '...', holdMs: 1600 },
      { speaker: 'player', text: '...', cue: 'swarm', holdMs: 2000 },
      { speaker: 'player', text: 'Qu\'est-ce que c\'était ???', holdMs: 3200 },
      // Il paraît bras écartés, sérieux, puis crie ; sa fenêtre s'efface sous
      // son titre.
      { cue: 'appear', pose: 'open', holdMs: 1900 },
      // Le titre suit seul, la secousse finie (`shout-window`, 3 s).
      { speaker: 'boss', text: 'OUI OUI OUI !', cue: 'shout', expression: 'shout', holdMs: 3200 },
      { cue: 'title', expression: 'stern', holdMs: 5500 },
      // TODO(texte) : monologue provisoire, Flo l'écrira.
      { speaker: 'boss', text: 'Bienvenue, candidat, dans mon royaume des drapeaux !' },
      { speaker: 'boss', text: 'Sept fois tu devras me répondre juste. Un faux pas, et c\'est toi qui tombes.' },
      { speaker: 'boss', text: 'Top !' },
    ],
  },
}
