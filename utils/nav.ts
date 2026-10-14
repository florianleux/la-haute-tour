import { isAnswering, isAtCamp } from './phase'
import type { GameState } from '~~/server/utils/game'

/**
 * Ce que devient une icône de la barre : un lien vers une page atteignable, la
 * mise en avant de la page qu'on regarde — inerte, on ne clique pas vers là où
 * on est déjà —, ou une icône éteinte quand on ne peut pas y aller maintenant.
 * Voir specs/ecrans.md#principes.
 */
export type NavIconState = 'link' | 'active' | 'disabled'

export type NavIconKey = 'tower' | 'wand' | 'trophy' | 'profile' | 'admin'

export interface NavIcon {
  key: NavIconKey
  to: string
  /** Ce que lit une synthèse vocale : une icône seule ne dit rien d'elle-même. */
  label: string
  state: NavIconState
}

export interface NavContext {
  /** La route affichée. */
  path: string
  isAdmin: boolean
  /** L'état de jeu tel qu'il est en cache, null tant qu'il n'a pas été lu. */
  game: GameState | null
  /** Le joueur a une équipe : sans elle, pas de bannière, donc pas de Haut-faits. */
  hasTeam: boolean
}

interface NavEntry {
  key: NavIconKey
  to: string
  label: string
  /** Réservée à l'administration : les autres ne la voient pas du tout. */
  adminOnly?: boolean
  /** Sa page ne s'ouvre qu'au camp, par-dessus lui : éteinte ailleurs. */
  campOnly?: boolean
  /** Sa page porte la bannière de la guilde : éteinte sans équipe. */
  teamOnly?: boolean
}

const ENTRIES: NavEntry[] = [
  { key: 'tower', to: '/', label: 'Le jeu' },
  { key: 'wand', to: '/sorts', label: 'Grimoire', campOnly: true },
  { key: 'trophy', to: '/succes', label: 'Haut-faits', campOnly: true, teamOnly: true },
  { key: 'profile', to: '/profil', label: 'Mon profil' },
  { key: 'admin', to: '/admin', label: 'Administration', adminOnly: true },
]

/**
 * La barre permanente, une icône à la fois. Elle ne disparaît jamais : ce sont
 * ses liens qui s'éteignent.
 *
 * Trois extinctions, et trois seulement. Tant qu'un chrono tourne, tout
 * s'éteint — en ascension comme en rattrapage, suivre un lien soumettrait la
 * réponse en l'état, donc le lien éteint retire un piège plutôt qu'il
 * n'enferme. La baguette et la coupe s'éteignent hors du camp : le Grimoire et
 * les Haut-faits ne s'ouvrent que par-dessus lui. Et la coupe s'éteint sans
 * équipe : les Haut-faits sont la bannière de la guilde.
 *
 * La question ne compte que sur la page de jeu : l'état reste en cache après
 * qu'on l'a quittée, et une question laissée en cours éteindrait sinon la barre
 * du profil, où plus rien ne ramènerait au jeu.
 * Voir specs/ecrans.md#principes.
 */
export function navIcons({ path, isAdmin, game, hasTeam }: NavContext): NavIcon[] {
  const answering = path === '/' && isAnswering(game)
  const atCamp = isAtCamp(game)

  return ENTRIES
    .filter(entry => !entry.adminOnly || isAdmin)
    .map(({ key, to, label, campOnly, teamOnly }) => {
      const reachable = !answering && (!campOnly || atCamp) && (!teamOnly || hasTeam)

      return {
        key,
        to,
        label,
        state: !reachable ? 'disabled' : path === to ? 'active' : 'link',
      }
    })
}
