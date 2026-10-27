import { readFile } from 'node:fs/promises'
import { pathToFileURL } from 'node:url'
import { z } from 'zod'
import { createDatabase, type Database } from '../server/db/client'
import { flags } from '../server/db/schema'

/**
 * Charge le catalogue des drapeaux du boss de l'étage 1 (scripts/flags.json) :
 * `pnpm db:seed-flags` en local, `pnpm db:seed-flags:prod` en prod (il vide
 * DATABASE_URL pour laisser passer Turso, comme `db:migrate:prod`). Se relance
 * sans risque : le catalogue est remplacé, jamais empilé.
 * Voir specs/boss-etage1-drapeaux.md.
 */

const SOURCE = 'scripts/flags.json'

/**
 * Une entrée du fichier source, déjà à la forme de la table. Contrairement au
 * deck, rien ne s'ignore : le catalogue est curaté. Un slug ou une image en
 * double, la table les refuse elle-même.
 */
const sourceFlagSchema = z.object({
  slug: z.string().trim().min(1),
  image: z.string().regex(/^[0-9a-f]{16}$/),
  bossAttemptNumber: z.number().int().min(1).max(6),
  answerLabel: z.string().trim().min(1),
  acceptedAnswers: z.array(z.string().trim().min(1)).min(1),
})

export type SeededFlag = z.infer<typeof sourceFlagSchema>

/** Valide le fichier entier : un drapeau mal écrit arrête tout, plutôt qu'un combat à 9 épreuves. */
export function parseFlags(raw: unknown): SeededFlag[] {
  return z.array(sourceFlagSchema).parse(raw)
}

/** Remplace le catalogue : en un lot, un seed interrompu ne laisse pas une table à moitié vide. */
export async function seedFlags(db: Database, seeded: SeededFlag[]): Promise<void> {
  await db.batch([db.delete(flags), db.insert(flags).values(seeded)])
}

async function main(): Promise<void> {
  const seeded = parseFlags(JSON.parse(await readFile(SOURCE, 'utf8')))
  await seedFlags(await createDatabase(), seeded)
  console.log(`${seeded.length} drapeaux chargés depuis ${SOURCE}`)
}

// Le test importe ce module : seule la ligne de commande le lance.
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error: unknown) => {
    console.error(`Seed échoué : ${error instanceof Error ? error.message : String(error)}`)
    process.exit(1)
  })
}
