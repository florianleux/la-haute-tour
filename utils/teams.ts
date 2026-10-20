import { TARGET_KINDS } from '~~/shared/utils/teams'
import type { TargetKind, TeamId } from '~~/shared/utils/teams'

/**
 * Le nom d'une équipe, montré au joueur. Provisoire, contrairement à
 * l'identifiant que le serveur et le schéma partagent : renommer une équipe ne
 * doit coûter ni migration ni refactor. Même partage que pour les Sorts.
 * Voir specs/equipes.md.
 */
const TEAM_LABELS: Record<TeamId, string> = {
  TLM: 'Fauteuillistes',
  MIDI: 'Méridiens',
}

export function teamLabel(team: TeamId | null): string {
  return team === null ? 'Sans équipe' : TEAM_LABELS[team]
}

/**
 * La devise d'une guilde, en latin de cuisine, brodée au bas de sa bannière
 * (les Haut-faits). Provisoire comme le nom. Voir specs/lore.md#guildes.
 */
const TEAM_MOTTOS: Record<TeamId, string> = {
  // « Au nom de Jean-Luc » — l'In nomine Patris, Reichmann à la place du Père.
  MIDI: 'In nomine Ioannis-Lucae',
  // « Je suis assis, donc je suis » — et tout le monde veut ma place.
  TLM: 'Sedeo, ergo sum',
}

export function teamMotto(team: TeamId): string {
  return TEAM_MOTTOS[team]
}

/** Les couleurs d'une guilde : l'encre (cadre, texte) et le papier (fond). */
const TEAM_COLORS: Record<TeamId, { ink: string, paper: string }> = {
  MIDI: { ink: '#125076', paper: '#DBFEF9' },
  TLM: { ink: '#750033', paper: '#FEE6E8' },
}

/**
 * La guilde dont un écran prend les couleurs : celle du joueur, ou les Méridiens
 * sans équipe (l'admin) — il en faut une, et c'est décidé ici seulement.
 */
export function displayTeam(team: TeamId | null): TeamId {
  return team ?? 'MIDI'
}

/**
 * Les couleurs d'une guilde, en variables CSS posées sur la page (layout) : les
 * infobulles, les tuiles et les dessins de secours les lisent, où qu'ils
 * s'ouvrent.
 */
export function teamColorVars(team: TeamId): string {
  return `--team-ink:${TEAM_COLORS[team].ink};--team-paper:${TEAM_COLORS[team].paper}`
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

/**
 * Les catégories qu'un bouton de lancer propose : Soi toujours, Allié et Ennemi
 * seulement à qui a une équipe — sans elle, elles ne désigneraient aucun pool.
 * Voir specs/equipes.md#le-joueur-sans-équipe.
 */
export function offeredTargets(canTargetOthers: boolean): TargetKind[] {
  return TARGET_KINDS.filter(kind => kind === 'self' || canTargetOthers)
}
