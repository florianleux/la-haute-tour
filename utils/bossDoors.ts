/** Une entrée du catalogue des portes (`bossDoors`) : ce que l'écran de porte affiche pour un étage. */
export interface BossDoorEntry {
  /** Son nom côté joueur, celui de l'étage suivant (specs/lore.md#étages). */
  name: string
  /** Le nom de sa clé, dans « Utiliser … » : il suit celui de la porte. */
  keyName: string
  /**
   * L'illustration, en 20:9 comme tous les décors plein écran (CLAUDE.md#images),
   * sous public/images/boss/ : l'écran de chargement ne l'attend pas.
   */
  image: string
  /**
   * Le fond de l'arche, une couleur unie en classe Tailwind (`bg-[…]`) : le
   * décor laisse l'arche transparente, ce qu'on posera derrière la porte s'y
   * glissera entre ce fond et l'illustration.
   */
  archColor: string
  /**
   * Le cœur de l'arche, en `origin-[x%_y%]` du décor 20:9 entier : le point
   * vers lequel « Entrer » plonge : au milieu de l'arche, près du sol, comme si
   * on y marchait.
   */
  archCenter: string
  /** Le verso des battants, une couleur unie en classe Tailwind (`bg-[…]`) : le bois vu de dos. */
  leafBackColor: string
  /**
   * Ses deux battants, gauche puis droite : la porte détourée, coupée en deux
   * à la verticale. Ils couvrent l'arche vide de l'illustration et pivotent
   * vers le joueur quand il ouvre la porte. Sous public/images/boss/ aussi.
   */
  leaves: [string, string]
  /**
   * La boîte des deux battants réunis, en classes Tailwind (`left-[x%] top-[y%]
   * w-[…] h-[…]` de la scène 16:9), relevée sur le calque 20:9 de la porte
   * détourée : x moins la marge de 240 px, sur 1920.
   */
  doorway: string
  /** La clé posée dans une serrure, détourée : la même image pour les deux. */
  key: string
  /**
   * Ses deux serrures, gauche puis droite, chacune sur son battant : le centre
   * et la largeur de la clé qu'on y pose, en classes Tailwind (`left-[x%]
   * top-[y%] w-[w%]`) en % du battant. La clé suit ainsi le battant qui pivote.
   */
  keyholes: [string, string]
}

/**
 * Les portes de boss, par étage. Catalogue fixe, écrit dans le code comme les
 * Succès : une nouvelle porte, c'est une illustration et une entrée ici, rien
 * d'autre. Un étage sans entrée n'a pas encore sa porte.
 */
export const BOSS_DOORS: Readonly<Partial<Record<number, BossDoorEntry>>> = {
  1: {
    name: 'Porte de la Lune',
    keyName: 'la clé de la Lune',
    image: '/images/boss/door-moon.webp',
    archColor: 'bg-[#1f1c2e]',
    archCenter: 'origin-[49.9%_74%]',
    leafBackColor: 'bg-[#0c1f3a]',
    leaves: ['/images/boss/door-moon-left.webp', '/images/boss/door-moon-right.webp'],
    doorway: 'left-[36.2%] top-[19.17%] w-[27.29%] h-[79.35%]',
    key: '/images/boss/door-moon-key.webp',
    keyholes: ['left-[61.6%] top-[48.4%] w-[8.78%]', 'left-[41.2%] top-[48.4%] w-[8.78%]'],
  },
}
