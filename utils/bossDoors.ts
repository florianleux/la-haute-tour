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
   * Le centre de ses deux serrures, gauche puis droite, en classes Tailwind
   * (`left-[x%] top-[y%]` de la scène 1920×1080 d'origine) : comme les objets du camp.
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
    keyholes: ['left-[44.5%] top-[56%]', 'left-[55.7%] top-[56%]'],
  },
}
