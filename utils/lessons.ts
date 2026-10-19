import { teamLabel } from './teams'
import type { CampObject } from './camp'
import type { CampOverlayId } from './phase'
import type { TeamId } from '~~/shared/utils/teams'

/** Le temps que Michel laisse au joueur arrivé au camp avant de se manifester. */
export const LESSON_PAUSE_MS = 2_000

/** L'ombre de la leçon sur le camp : ce que Michel ne montre pas. Voir spotlightOn. */
export const LESSON_SHADE = 'brightness-[.35]'

/**
 * Ce qu'une réplique attend du joueur pour passer à la suite, à la place d'un
 * clic sur la bulle. Voir specs/spec.md (glossaire, « Attendu »).
 * - `pause` : rien ne s'affiche, la leçon reprend d'elle-même après LESSON_PAUSE_MS ;
 * - `click` : cliquer l'objet éclairé ;
 * - `use` : utiliser le Fromage depuis l'Inventaire — le donner à Michel ;
 * - `close` : refermer la boîte du camp où Michel parle ;
 * - `ascent` : le clic sur la bulle, qui finit la leçon et lance l'ascension.
 */
export type LessonAwait = 'pause' | 'click' | 'use' | 'close' | 'ascent'

/**
 * Une réplique de Michel pendant une leçon. Voir specs/ecrans.md#leçons-de-michel.
 */
export interface LessonLine {
  text: string
  /**
   * L'objet du camp que la réplique éclaire ; le reste reste dans l'ombre.
   * Null, rien n'est éclairé. Voir specs/spec.md (glossaire, « Éclairage »).
   */
  spotlight: CampObject | null
  /** Ce que la réplique attend du joueur. Absent, la bulle avance au clic ou à Entrée. */
  awaits?: LessonAwait
  /** La boîte du camp d'où Michel parle, ouverte par la réplique d'avant. Absente, il parle sur le camp. */
  overlay?: CampOverlayId
  /** La bulle seule, Michel pas encore là : on l'entend avant de le voir. */
  bubbleOnly?: true
}

/**
 * La leçon du camp, à la première arrivée au camp : Michel se fait attendre,
 * s'annonce, se fait donner le Fromage, montre l'Inventaire, les Haut-faits
 * de la guilde puis la corde. Sans équipe, ni bannière ni Haut-faits.
 */
export function campLesson({ team }: { team: TeamId | null }): LessonLine[] {
  // TODO(texte) : répliques provisoires, Flo les écrira.
  return [
    { text: '', spotlight: null, awaits: 'pause' },
    // Le camp s'assombrit dès le cri : Michel est déjà là, hors de vue.
    { text: 'HÉ !', spotlight: 'michel', bubbleOnly: true },
    { text: 'Je sens du fromage, non ??', spotlight: 'michel' },
    { text: 'Je suis Michel, et je vais t\'aider à découvrir le camp de base !', spotlight: 'michel' },
    { text: 'C\'est ici que tu reviendras entre deux tentatives d\'ascension, quand tes vies tomberont à zéro !', spotlight: null },
    { text: 'Ce fromage, il est dans ton sac ? Ouvre-le, pour voir.', spotlight: 'backpack', awaits: 'click' },
    { text: 'Tu trouveras ici tous les objets que tu récupéreras dans ton aventure. Certains peuvent être utilisés…', spotlight: null, overlay: 'inventory' },
    { text: 'Choisis le Fromage, et donne-le-moi !', spotlight: null, overlay: 'inventory', awaits: 'use' },
    { text: 'Miam ! Merci !', spotlight: 'michel' },
    ...team
      ? [
          { text: `Je vois que tu fais partie des ${teamLabel(team)} ! Clique sur ta bannière.`, spotlight: 'banner', awaits: 'click' },
          { text: 'C\'est ici que tu verras tes Haut-faits, toutes tes actions d\'éclat. Certains sont même secrets : à toi de les découvrir !', spotlight: null, overlay: 'achievements' },
          { text: 'Referme la bannière quand tu as fini.', spotlight: null, overlay: 'achievements', awaits: 'close' },
        ] satisfies LessonLine[]
      : [],
    { text: 'Quand tu es prêt, la corde te ramène dans la Tour. Clique dessus !', spotlight: 'rope', awaits: 'click' },
    { text: 'On se revoit bientôt, bonne chance !', spotlight: 'michel', awaits: 'ascent' },
  ]
}

/**
 * Où reprend la leçon du camp : au début tant que le Fromage est dans le sac,
 * juste après le don sinon. Tout se lit dans le sac servi par le serveur :
 * recharger ne redonne ni ne perd le Fromage.
 */
export function lessonStart(lines: LessonLine[], cheeseHeld: boolean): number {
  return cheeseHeld ? 0 : lines.findIndex(line => line.awaits === 'use') + 1
}

/**
 * Une leçon déjà vue, rejouée au clic sur Michel : mêmes répliques, même
 * éclairage, mais rien à faire ni à attendre — chaque réplique avance au clic,
 * sur le camp. Rien ne s'ouvre, rien ne se donne, rien ne se lance.
 */
export function replayedLesson(lines: LessonLine[]): LessonLine[] {
  return lines
    .filter(line => line.awaits !== 'pause')
    .map(({ awaits: _, overlay: __, ...line }) => line)
}

/** La bulle avance au clic, à Entrée ou aux flèches : la réplique n'attend rien d'autre. */
export function advancesOnBubble(line: LessonLine): boolean {
  return !line.awaits || line.awaits === 'ascent'
}

/**
 * La boîte du camp d'où Michel parle ne se referme pas, sauf quand il le
 * demande : une leçon ne se passe pas.
 */
export function locksOverlay(line: LessonLine | undefined): boolean {
  return line !== undefined && line.awaits !== 'close'
}

/**
 * Le camp s'assombrit pendant toute la leçon, du cri de Michel à son au revoir.
 * Seule la pause qui le précède le laisse tel quel : Michel ne s'est pas
 * encore manifesté.
 */
export function lessonDims(line: LessonLine | null): boolean {
  return line !== null && line.awaits !== 'pause'
}

/** Ce qu'une réplique fait d'un objet du camp. */
export interface Spotlit {
  dimmed: boolean
  clickable: boolean
  /** L'objet pulse : c'est lui que Michel demande d'ouvrir. */
  pulses: boolean
}

/**
 * Hors leçon, rien ne change. En leçon, seul l'objet que la réplique éclaire
 * échappe à l'ombre ; seul celui qu'elle demande de cliquer se clique, et il
 * pulse pour le dire.
 */
export function spotlightOn(line: LessonLine | null, object: CampObject): Spotlit {
  if (!line) {
    return { dimmed: false, clickable: true, pulses: false }
  }

  const asked = line.spotlight === object && line.awaits === 'click'
  return { dimmed: lessonDims(line) && line.spotlight !== object, clickable: asked, pulses: asked }
}
