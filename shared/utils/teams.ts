/**
 * Les deux équipes. Partagé parce que les deux côtés en ont besoin : le schéma
 * les grave dans ses contraintes, l'administration les propose, et le tirage des
 * cibles s'en servira pour dire allié ou ennemi.
 *
 * Les identifiants seuls : les libellés sont provisoires et vivent côté écran,
 * comme pour les Sorts — un renommage ne doit coûter ni migration ni refactor.
 * Voir specs/equipes.md.
 */
export const TEAM_IDS = ['CRIMSON', 'AZURE'] as const

export type TeamId = typeof TEAM_IDS[number]

/**
 * Ce qu'un lanceur est pour une cible. Dérivé de deux appartenances au moment du
 * lancer, jamais stocké : une relation n'appartient à personne.
 *
 * `none` dit qu'il n'y a pas de relation du tout — l'un des deux au moins est
 * sans équipe. Ce n'est pas « ni allié ni ennemi par hasard », c'est le cas où
 * le PvP ne s'applique pas. Voir specs/equipes.md#le-joueur-sans-équipe.
 */
export type TeamBond = 'self' | 'ally' | 'foe' | 'none'

/**
 * Ce que le lanceur choisit, faute de choisir une personne : une catégorie, que
 * le tirage change ensuite en quelqu'un. Voir specs/bonus.md#catégories-de-cible.
 */
export const TARGET_KINDS = ['self', 'ally', 'foe'] as const

export type TargetKind = typeof TARGET_KINDS[number]

/**
 * Les catégories qui désignent quelqu'un d'autre, et qu'un tirage doit donc
 * résoudre. `self` n'en est pas : la cible y est déjà connue.
 */
export type DrawnTargetKind = Exclude<TargetKind, 'self'>

/** Ce qu'il faut savoir d'un joueur pour dire ce qu'il est pour un autre. */
export interface Bonded {
  id: number
  team: TeamId | null
  /** Un joueur test ne se lie qu'à ses semblables. Voir specs/admin.md#joueurs-test. */
  isTest: boolean
}

/**
 * La relation entre un lanceur et une cible. Une seule fonction, lue dans les
 * deux sens : même équipe on soutient, équipe adverse on frappe.
 *
 * Deux mondes, jamais un seul. Un joueur test et un vrai joueur ne sont liés
 * par rien, même sous la même couleur : l'équipe dit de quel côté on est, elle
 * ne dit pas dans quel monde on joue. La règle vit ici plutôt que dans le seul
 * tirage — c'est la relation qu'on veut inexistante, et tout ce qui la lira en
 * hérite gratuitement.
 */
export function bondBetween(caster: Bonded, target: Bonded): TeamBond {
  if (caster.id === target.id) {
    return 'self'
  }

  // Le monde scellé d'abord : un joueur test ne touche que des joueurs test, et
  // réciproquement. Sans ce garde, une couleur partagée suffirait à les relier.
  if (caster.isTest !== target.isTest) {
    return 'none'
  }

  // Sans équipe d'un côté ou de l'autre, rien ne relie les deux joueurs : le
  // sans-équipe ne touche personne et personne ne le touche.
  if (caster.team === null || target.team === null) {
    return 'none'
  }

  return caster.team === target.team ? 'ally' : 'foe'
}
