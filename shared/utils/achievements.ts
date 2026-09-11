/**
 * Le catalogue des Succès. Partagé parce que les deux côtés en ont besoin : le
 * schéma grave les identifiants dans sa contrainte, le serveur décide ce qui se
 * débloque, et l'écran s'y réfère pour nommer et pour dire la condition.
 *
 * Les identifiants et les seuils seuls : les libellés vivent dans
 * `utils/achievements.ts`, côté écran, parce qu'eux sont provisoires.
 * Voir specs/succes.md#catalogue.
 *
 * Les seuils traversent la frontière, contrairement aux nombres du jeu qui vivent
 * dans `server/utils/rules.ts` : l'écran doit afficher « 50 bonnes réponses
 * d'affilée » sur un succès verrouillé, donc il lui faut le nombre. Le jeu de
 * règles reste le seul lieu de ce qui se règle **par étage**, ce qu'un palier de
 * succès n'est pas.
 */
import type { FLOOR_COUNT } from './floors'

/**
 * Les paliers de série. Le 1000 est hors de portée du deck actuel — six étages de
 * 166 questions en font 996, et une question ne se voit qu'une fois. Il est calé
 * sur la cible de 1000 questions par étage : ce n'est pas un oubli, il n'y a rien
 * à y corriger. Voir specs/succes.md#série-sans-faute.
 */
export const STREAK_TIERS = [
  5, 10, 20, 30, 40, 50, 60, 70, 80, 90, 100,
  200, 300, 400, 500, 600, 700, 800, 900, 1000,
] as const

/** Les paliers de jours joués. */
export const DAY_TIERS = [7, 30, 100] as const

/** Les numéros de question qui valent d'être atteints. Le 1312 attend le deck, comme le palier 1000. */
export const VIEW_MILESTONES = [67, 666, 1312] as const

/**
 * Les étages, un par un. `FLOOR_COUNT` dit combien il y en a ; ici il faut leurs
 * valeurs littérales, parce qu'un identifiant de succès les porte dans son nom.
 * Le `satisfies` casse le typecheck si la tour grandit sans que cette liste suive.
 */
export const FLOORS = [1, 2, 3, 4, 5, 6] as const satisfies { length: typeof FLOOR_COUNT }

export type Floor = typeof FLOORS[number]

/**
 * Les étages qu'on *atteint*. Le premier n'en est pas un : y arriver n'est pas un
 * accomplissement, c'est le point de départ.
 */
export type ReachedFloor = Exclude<Floor, 1>

export const REACHED_FLOORS = FLOORS.filter((floor): floor is ReachedFloor => floor !== 1)

/**
 * Les succès qui n'appartiennent à aucune famille à paliers : un déclencheur, un
 * identifiant, rien à dériver.
 */
const SINGULAR_IDS = [
  'FIRST_CORRECT',
  'FIRST_WRONG',
  'FIRST_DEATH',
  'FIRST_RECOVERY',
  'GAME_COMPLETED',
  'POOL_CLEARED',
  'RECOVERY_PERFECT',
  'DISPUTE_OPENED',
  'DISPUTE_ACCEPTED',
  'DISPUTE_REJECTED',
  'TWO_DAYS_IN_A_ROW',
  'FIRST_ASCENT',
  'EMPTY_ANSWER',
] as const

export type StreakAchievementId = `STREAK_${typeof STREAK_TIERS[number]}`
export type DaysAchievementId = `DAYS_${typeof DAY_TIERS[number]}`
export type ViewAchievementId = `QUESTION_${typeof VIEW_MILESTONES[number]}`
export type ReachedFloorAchievementId = `REACHED_FLOOR_${ReachedFloor}`
export type FlawlessFloorAchievementId = `FLAWLESS_FLOOR_${Floor}`

export type AchievementId =
  | typeof SINGULAR_IDS[number]
  | StreakAchievementId
  | DaysAchievementId
  | ViewAchievementId
  | ReachedFloorAchievementId
  | FlawlessFloorAchievementId

export function streakAchievement(tier: typeof STREAK_TIERS[number]): StreakAchievementId {
  return `STREAK_${tier}`
}

export function daysAchievement(tier: typeof DAY_TIERS[number]): DaysAchievementId {
  return `DAYS_${tier}`
}

export function viewAchievement(milestone: typeof VIEW_MILESTONES[number]): ViewAchievementId {
  return `QUESTION_${milestone}`
}

export function reachedFloorAchievement(floor: ReachedFloor): ReachedFloorAchievementId {
  return `REACHED_FLOOR_${floor}`
}

export function flawlessFloorAchievement(floor: Floor): FlawlessFloorAchievementId {
  return `FLAWLESS_FLOOR_${floor}`
}

/**
 * Tout le catalogue, dérivé des paliers plutôt que retapé. Écrire les cinquante
 * identifiants à la main laisserait exister un palier sans son succès, ou
 * l'inverse ; ici les deux ne peuvent pas diverger.
 *
 * L'assertion ne dit qu'une chose que le tableau ne sait pas prouver de lui-même :
 * qu'il n'est pas vide. Le schéma en a besoin pour en faire une énumération.
 */
export const ACHIEVEMENT_IDS = [
  ...SINGULAR_IDS,
  ...STREAK_TIERS.map(streakAchievement),
  ...DAY_TIERS.map(daysAchievement),
  ...VIEW_MILESTONES.map(viewAchievement),
  ...REACHED_FLOORS.map(reachedFloorAchievement),
  ...FLOORS.map(flawlessFloorAchievement),
] as [AchievementId, ...AchievementId[]]

/** Le nom du fichier d'image d'un succès, dérivé de son identifiant et jamais tapé à la main. */
export function achievementSlug(id: AchievementId): string {
  return id.toLowerCase().replaceAll('_', '-')
}

/** Un étage de la tour, pour que l'appelant n'ait pas à en connaître les bornes. */
export function isFloor(floor: number): floor is Floor {
  return (FLOORS as readonly number[]).includes(floor)
}

export function isReachedFloor(floor: number): floor is ReachedFloor {
  return (REACHED_FLOORS as readonly number[]).includes(floor)
}
