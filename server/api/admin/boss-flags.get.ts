import flags from '~~/scripts/flags.json'

export type BossFlag = typeof flags[number]

export interface BossFlagsResponse {
  flags: BossFlag[]
}

/**
 * Les drapeaux du premier combat contre le boss de l'étage 1, réponses
 * comprises, pour son banc (pages/boss/1.vue). Admin seulement.
 *
 * Servis d'ici plutôt qu'importés par la page : tout ce qu'une page importe
 * part dans un fichier JS que n'importe qui télécharge, connecté ou non — les
 * réponses du boss y étaient lisibles. Voir docs/revue-de-securite.md.
 */
export default defineEventHandler(async (event): Promise<BossFlagsResponse> => {
  await requireAdmin(event)

  return { flags: flags.filter(entry => entry.bossAttemptNumber === 1) }
})
