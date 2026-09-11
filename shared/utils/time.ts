/**
 * Le fuseau du jeu, en un seul endroit. Partagé parce que les deux côtés
 * découpent les jours : le serveur date le jour joué d'un succès d'assiduité,
 * l'écran date ce qu'il montre au joueur.
 *
 * Deux copies tomberaient tôt ou tard sur deux jours différents — et c'est
 * exactement ce que le rendu serveur puis l'hydratation du navigateur feraient
 * apparaître. Voir utils/date.ts et server/utils/achievements.ts.
 */
export const GAME_TIME_ZONE = 'Europe/Paris'
