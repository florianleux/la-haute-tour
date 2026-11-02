import {
  DAY_TIERS,
  FLOORS,
  REACHED_FLOORS,
  STREAK_TIERS,
  VIEW_MILESTONES,
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
  DAYS_7: 'Accro ?',
  DAYS_30: 'J\'arrête quand je veux !',
  DAYS_100: '100 jours',
  QUESTION_42: 'La Réponse',
  QUESTION_67: 'SIX SEVEEEEEEEN',
  QUESTION_666: 'Diabolique',
  QUESTION_1312: 'Mort aux vaches',
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
  TWO_DAYS_IN_A_ROW: 'Un goût de reviens-y',
  FIRST_ASCENT: 'Premier en haut',
  EMPTY_ANSWER: 'Sans voix',
  CHEESE_GIVEN: 'HÉ !',
  KEY_OBTAINED: 'Passe-Partout',
  MOON_DOOR: 'Un peu plus près des étoiles',
  BOSS_BEATEN: 'Tueur de gardien',
  BOSS_PERFECT: 'Perfect !',
  BOSS_FIRST_TRY: 'First try !',
  BOSS_PASSED: 'Solution pacifique',
  FIRST_CAST: 'Apprenti sorcier',
  ALLY_BOON: 'Bon samaritain',
  FOE_CURSE: 'Coup bas',
  CURSED: 'Maudit',
  QUICK_ANSWER: 'Éclair',
  LAST_SECOND: 'Sur le fil',
  FOCUS_LOST: 'Distrait',
  PUNCTUAL: 'Ponctuel',
  NIGHT_OWL: 'Insomniaque',
  DEVTOOLS_OPENED: 'La curiosité est un vilain défaut',
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
  ...fromTiers(DAY_TIERS, daysAchievement, tier => `Jouer ${tier} jours qui se suivent.`),
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
  KEY_OBTAINED: 'Obtenir une clé.',
  MOON_DOOR: 'Atteindre la Porte de la Lune.',
  BOSS_BEATEN: 'Vaincre un gardien.',
  BOSS_PERFECT: 'Vaincre un gardien sans rater une épreuve.',
  BOSS_FIRST_TRY: 'Vaincre un gardien au premier combat.',
  BOSS_PASSED: 'Être laissé passer par un gardien, au sixième combat.',
  FIRST_CAST: 'Lancer un premier sort.',
  ALLY_BOON: 'Lancer une magie blanche sur un allié.',
  FOE_CURSE: 'Lancer une magie noire sur un ennemi.',
  CURSED: 'Subir une magie noire.',
  QUICK_ANSWER: 'Répondre juste en moins de 3 secondes.',
  LAST_SECOND: 'Répondre juste dans la dernière seconde du chrono.',
  FOCUS_LOST: 'Quitter la page pendant une question.',
  PUNCTUAL: 'Reprendre dans les 5 minutes qui suivent la fin d\'une attente.',
  NIGHT_OWL: 'Répondre à une question entre 3 h et 5 h du matin.',
  DEVTOOLS_OPENED: 'Ouvrir les outils de développement du navigateur.',
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
