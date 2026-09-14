/**
 * Espace insécable avant la ponctuation double du français. Sans elle, un point
 * d'interrogation esseulé se retrouve seul sur sa ligne dès que le retour à la
 * ligne tombe juste avant lui — ce qui arrive vite sur les cadres de jeu, où
 * l'énoncé est centré dans une colonne étroite.
 *
 * Écrite ici plutôt que recopiée dans chaque carte : les trois écrans de jeu en
 * ont besoin, et la version recopiée s'est déjà fait manger son U+00A0 une fois
 * sans que rien ne le signale. Un seul endroit à relire pour vérifier l'octet.
 */
export function withNonBreakingSpaces(text: string): string {
  return text.replace(/ ([?!:;])/g, ' $1')
}
