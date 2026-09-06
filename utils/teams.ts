import type { TargetKind, TeamId } from '~~/shared/utils/teams'

/**
 * Le nom d'une équipe, montré au joueur. Provisoire, contrairement à
 * l'identifiant que le serveur et le schéma partagent : renommer une équipe ne
 * doit coûter ni migration ni refactor. Même partage que pour les Sorts.
 * Voir specs/equipes.md.
 */
const TEAM_LABELS: Record<TeamId, string> = {
  CRIMSON: 'Cramoisi',
  AZURE: 'Azur',
}

export function teamLabel(team: TeamId | null): string {
  return team === null ? 'Sans équipe' : TEAM_LABELS[team]
}

/**
 * Le libellé d'un bouton de lancer : ce que le joueur choisit, une catégorie et
 * jamais une personne. Provisoire comme les autres libellés, et écrit ici plutôt
 * que dans la page pour la même raison. Voir specs/bonus.md#catégories-de-cible.
 */
const TARGET_KIND_LABELS: Record<TargetKind, string> = {
  self: 'Sur moi',
  ally: 'Sur un allié',
  foe: 'Sur un ennemi',
}

export function targetKindLabel(kind: TargetKind): string {
  return TARGET_KIND_LABELS[kind]
}
