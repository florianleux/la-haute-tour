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

/**
 * Au-delà de ces longueurs, une ligne du panneau de jeu passe à sa taille
 * réduite (`LONG_ROLES`, components/PlayText.vue) : le panneau ne défile pas
 * (voir PlayFrame), et le texte serait coupé. Chaque seuil est mesuré sur
 * desktop contre la taille normale de son rôle — changer cette taille, c'est
 * mesurer de nouveau. Un compte de caractères ne voit pas où tombent les retours
 * à la ligne : chaque seuil garde de la marge.
 */
export const LONG_CHARS = {
  // L'énoncé posé : quatre lignes au plus. 160 caractères tiennent, 170 non.
  statement: 150,
  // L'énoncé rappelé sous un verdict faux, où il partage le panneau avec la
  // réponse, la saisie, la vie perdue et la contestation : deux lignes au plus.
  // 110 caractères tiennent, 115 non.
  recall: 100,
  // La bonne réponse, en capitales grasses : une ligne. 35 caractères
  // tiennent, 40 non.
  answer: 35,
} as const

/** Ce texte passe-t-il à la taille réduite de son rôle ? Voir `long` dans PlayText. */
export function isLong(role: keyof typeof LONG_CHARS, text: string): boolean {
  return text.length > LONG_CHARS[role]
}
