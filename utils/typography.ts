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

/**
 * Les grands titres, révélés de gauche à droite par un masque qui glisse :
 * capitales espacées. `--title-ms` règle la durée de `animate-title-reveal`.
 * La couleur s'ajoute par-dessus (TITLE_GOLD, TITLE_RED, TITLE_YELLOW).
 */
const TITLE_REVEAL = 'uppercase tracking-[0.2em] [mask-image:linear-gradient(to_right,black_40%,transparent_60%)] [mask-size:250%_100%] motion-safe:animate-title-reveal'

/**
 * L'or du nom d'un boss (BossIntro), en dégradé balayé d'un reflet. Pas de
 * `text-shadow` dessous : sous un texte à fond découpé, il salirait l'or.
 */
export const TITLE_GOLD = `bg-[linear-gradient(100deg,#a8741a_0%,#f6dc8c_30%,#fffbe8_45%,#f6dc8c_60%,#a8741a_100%)] bg-size-[250%_100%] bg-clip-text [-webkit-background-clip:text] text-transparent ${TITLE_REVEAL}`

/**
 * Le rouge de « DÉFAITE » (BossOutro) : le même dégradé balayé d'un reflet que
 * l'or du nom du boss, dans le sang.
 */
export const TITLE_RED = `bg-[linear-gradient(100deg,#6b0f0f_0%,#e04848_30%,#ffd6d6_45%,#e04848_60%,#6b0f0f_100%)] bg-size-[250%_100%] bg-clip-text [-webkit-background-clip:text] text-transparent ${TITLE_REVEAL}`

/**
 * Le titre de l'objet obtenu (ItemReveal) : un jaune plein (#FCD400) sur une
 * ombre noire nette, sans or ni reflet.
 */
export const TITLE_YELLOW = `text-[#fcd400] [text-shadow:0_2px_1px_rgb(0_0_0/0.85),0_0_4px_rgb(0_0_0/0.5)] ${TITLE_REVEAL}`
