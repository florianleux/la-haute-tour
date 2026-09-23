/**
 * Les genres qu'un joueur peut donner à l'introduction. Partagé parce que les
 * deux côtés en ont besoin : le schéma les grave, l'endpoint les valide, et le
 * banc d'intro les envoie.
 *
 * Les identifiants seuls : ce que le joueur clique pour les dire (« Un
 * aventurier », « Une aventurière », « C'est pas tes oignons ») vit côté écran,
 * comme les libellés des équipes. Voir specs/spec.md (glossaire, « Genre »).
 */
export const GENDERS = ['MALE', 'FEMALE', 'NEUTRAL'] as const

export type Gender = typeof GENDERS[number]
