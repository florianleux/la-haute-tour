import {
  DAY_TIERS,
  FLOORS,
  REACHED_FLOORS,
  STREAK_TIERS,
  VIEW_MILESTONES,
  achievementSlug,
  daysAchievement,
  flawlessFloorAchievement,
  reachedFloorAchievement,
  streakAchievement,
  viewAchievement,
} from '~~/shared/utils/achievements'
import type { AchievementId } from '~~/shared/utils/achievements'

/**
 * Les mots des Succès : leur nom et leur condition, tels que la page les montre.
 * Provisoires, contrairement aux identifiants que le serveur et le schéma
 * partagent : renommer un succès ne doit coûter ni migration ni refactor.
 * Voir specs/succes.md#catalogue.
 */

/**
 * Les familles à paliers se construisent depuis leurs seuils, comme le catalogue
 * lui-même : écrire vingt libellés de série à la main laisserait exister un palier
 * sans son mot. L'assertion ne fait que redonner à `Object.fromEntries` le type
 * que ses entrées portent déjà.
 */
function fromTiers<V extends number, I extends AchievementId>(
  values: readonly V[],
  id: (value: V) => I,
  text: (value: V) => string,
): Record<I, string> {
  return Object.fromEntries(values.map(value => [id(value), text(value)])) as Record<I, string>
}

const LABELS: Record<AchievementId, string> = {
  ...fromTiers(STREAK_TIERS, streakAchievement, tier => `Série de ${tier}`),
  ...fromTiers(DAY_TIERS, daysAchievement, tier => `${tier} jours`),
  ...fromTiers(VIEW_MILESTONES, viewAchievement, milestone => `Question n°${milestone}`),
  ...fromTiers(REACHED_FLOORS, reachedFloorAchievement, floor => `Étage ${floor}`),
  ...fromTiers(FLOORS, flawlessFloorAchievement, floor => `Étage ${floor} sans faute`),
  FIRST_CORRECT: 'Premier pas',
  FIRST_WRONG: 'Première chute',
  FIRST_DEATH: 'Première mort',
  FIRST_RECOVERY: 'Premier rattrapage',
  GAME_COMPLETED: 'Au sommet',
  POOL_CLEARED: 'Dette payée',
  RECOVERY_PERFECT: 'Rattrapage parfait',
  DISPUTE_OPENED: 'Objection',
  DISPUTE_ACCEPTED: 'Gain de cause',
  DISPUTE_REJECTED: 'Débouté',
  TWO_DAYS_IN_A_ROW: 'Deux jours de suite',
  FIRST_ASCENT: 'Premier en haut',
  EMPTY_ANSWER: 'Sans voix',
  CHEESE_GIVEN: 'HÉ !',
}

/**
 * Ce qu'il a fallu faire, dit au joueur une fois le succès obtenu : avant, la
 * tuile ne dit rien (MASKED_TEXT).
 */
const CONDITIONS: Record<AchievementId, string> = {
  ...fromTiers(
    STREAK_TIERS,
    streakAchievement,
    tier => `${tier} bonnes réponses d'affilée dans la même tentative, sans perdre une vie.`,
  ),
  ...fromTiers(DAY_TIERS, daysAchievement, tier => `Jouer ${tier} jours différents.`),
  ...fromTiers(
    VIEW_MILESTONES,
    viewAchievement,
    milestone => `Voir la ${milestone}ᵉ question de ta partie, tous étages confondus.`,
  ),
  ...fromTiers(REACHED_FLOORS, reachedFloorAchievement, floor => `Atteindre l'étage ${floor}.`),
  ...fromTiers(
    FLOORS,
    flawlessFloorAchievement,
    floor => `Terminer l'étage ${floor} en une seule tentative, sans perdre une vie.`,
  ),
  FIRST_CORRECT: 'Répondre juste, une première fois.',
  FIRST_WRONG: 'Se tromper, une première fois.',
  FIRST_DEATH: 'Perdre sa dernière vie.',
  FIRST_RECOVERY: 'Entrer en rattrapage.',
  GAME_COMPLETED: 'Voir toutes les questions des six étages.',
  POOL_CLEARED: 'Faire sortir une question du Pool Échecs.',
  RECOVERY_PERFECT: 'Jouer un tirage de rattrapage en entier, sans une seule erreur.',
  DISPUTE_OPENED: 'Contester une réponse jugée fausse.',
  DISPUTE_ACCEPTED: 'Obtenir gain de cause sur une contestation.',
  DISPUTE_REJECTED: 'Voir une contestation refusée.',
  TWO_DAYS_IN_A_ROW: 'Jouer deux jours qui se suivent.',
  FIRST_ASCENT: 'Être le premier du serveur à quitter l\'étage 1.',
  EMPTY_ANSWER: 'Laisser une réponse vide.',
  CHEESE_GIVEN: 'Donner du fromage à Michel.',
}

/**
 * Ce qu'un succès pas encore obtenu montre à la place de son nom et de sa
 * condition : tous sont secrets, à découvrir. Voir specs/succes.md#affichage.
 */
export const MASKED_TEXT = '???'

export function achievementLabel(id: AchievementId): string {
  return LABELS[id]
}

export function achievementCondition(id: AchievementId): string {
  return CONDITIONS[id]
}

/** L'image d'un succès, dérivée de son identifiant et jamais tapée à la main. */
export function achievementImage(id: AchievementId): string {
  return `/images/achievements/${achievementSlug(id)}.webp`
}
