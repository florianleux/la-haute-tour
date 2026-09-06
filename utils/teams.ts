import type { TeamId } from '~~/shared/utils/teams'

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
