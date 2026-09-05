import type { SpellId } from '~~/shared/utils/spells'

/**
 * Le nom d'un sort, montré au joueur. Provisoire, contrairement à l'identifiant
 * que le serveur et le schéma partagent : renommer un sort ne doit coûter ni
 * migration ni refactor. Voir specs/bonus.md#catalogue.
 */
const SPELL_LABELS: Record<SpellId, string> = {
  VITALITY: 'Vitalité',
  RESPITE: 'Répit',
}

export function spellLabel(spell: SpellId): string {
  return SPELL_LABELS[spell]
}
