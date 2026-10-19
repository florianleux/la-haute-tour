import { teamLabel } from './teams'
import type { CampObject } from './camp'
import type { GameState } from '~~/server/utils/game'
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
 * L'entrée de Michel, la même à chaque leçon jouée d'elle-même : il se fait
 * attendre, puis on l'entend avant de le voir. Le camp s'assombrit dès le cri :
 * Michel est déjà là, hors de vue.
 */
const MICHEL_ENTRANCE: LessonLine[] = [
  { text: '', spotlight: null, awaits: 'pause' },
  { text: 'HÉ !', spotlight: 'michel', bubbleOnly: true },
]

/**
 * La leçon du camp, à la première arrivée au camp : Michel se fait attendre,
 * s'annonce, se fait donner le Fromage, montre l'Inventaire, les Haut-faits
 * de la guilde puis la corde. Sans équipe, ni bannière ni Haut-faits.
 */
export function campLesson({ team }: { team: TeamId | null }): LessonLine[] {
  // TODO(texte) : répliques provisoires, Flo les écrira.
  return [
    ...MICHEL_ENTRANCE,
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
 * La leçon de la chute, au premier retour au camp après la dernière vie :
 * l'attente, puis le Volumen et ses erreurs. Le rattrapage s'explique à
 * l'échéance (recoveryLesson). Voir specs/ecrans.md#leçons-de-michel.
 */
export function fallLesson(): LessonLine[] {
  // TODO(texte) : répliques provisoires, Flo les écrira.
  return [
    ...MICHEL_ENTRANCE,
    { text: 'Aïe, plus de vies ! Ça arrive aux meilleurs.', spotlight: 'michel' },
    { text: 'Te voilà au camp pour un moment : la bannière du poster dit combien de temps il te reste à attendre.', spotlight: 'posterBanner' },
    { text: 'Tes erreurs ne sont pas perdues : elles sont écrites dans le Volumen. Ouvre-le !', spotlight: 'scroll', awaits: 'click' },
    { text: 'Le Volumen garde toutes les questions que tu as vues. Tes erreurs t\'attendent dans « À revoir ».', spotlight: null, overlay: 'questionLog' },
    { text: 'Referme le Volumen quand tu as fini.', spotlight: null, overlay: 'questionLog', awaits: 'close' },
    { text: 'On se voit une fois ton attente finie pour la suite !', spotlight: 'michel' },
  ]
}

/**
 * Un nombre en toutes lettres, au féminin — questions et réponses le sont.
 * Assez loin pour deux Indulgences blanches ; au-delà, en chiffres.
 */
const NUMBER_WORDS = ['zéro', 'une', 'deux', 'trois', 'quatre', 'cinq', 'six', 'sept', 'huit', 'neuf', 'dix', 'onze', 'douze']

function inWords(count: number): string {
  return NUMBER_WORDS[count] ?? String(count)
}

/**
 * La leçon du rattrapage, la première attente échue, avant que « Commencer »
 * n'apparaisse : ses chiffres, servis par le serveur, Indulgence comprise.
 * Voir specs/ecrans.md#leçons-de-michel.
 */
export function recoveryLesson({ total, required }: NonNullable<GameState['nextRecovery']>): LessonLine[] {
  // TODO(texte) : répliques provisoires, Flo les écrira.
  return [
    ...MICHEL_ENTRANCE,
    { text: 'Ton attente est finie : place au rattrapage !', spotlight: 'michel' },
    // Toujours plusieurs questions : les règles en tirent trois, et l'Indulgence n'en retire jamais.
    { text: `${inWords(total).charAt(0).toUpperCase()}${inWords(total).slice(1)} questions que tu as ratées précédemment te seront présentées, donne ${inWords(required)} ${required > 1 ? 'bonnes réponses' : 'bonne réponse'} pour reprendre ton ascension !`, spotlight: 'michel' },
    { text: 'Clique sur « Commencer » quand tu es prêt. Bonne chance !', spotlight: 'michel' },
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
