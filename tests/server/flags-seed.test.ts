import { existsSync, readFileSync } from 'node:fs'
import { beforeEach, describe, expect, it } from 'vitest'
import { flags } from '../../server/db/schema'
import { parseFlags, seedFlags } from '../../scripts/seed-flags'
import { createTestDatabase } from '../helpers/db'
import type { Database } from '../../server/db/client'

const source: unknown = JSON.parse(readFileSync('scripts/flags.json', 'utf8'))

const katanga = {
  slug: 'katanga',
  image: 'd24d7cb77092d3a8',
  bossAttemptNumber: 1,
  answerLabel: 'État du Katanga (1960-1963)',
  acceptedAnswers: ['Katanga', 'État du Katanga'],
}

// Le catalogue des drapeaux du boss de l'étage 1. Voir specs/boss-etage1-drapeaux.md.
describe('seed des drapeaux', () => {
  let db: Database

  beforeEach(async () => {
    db = await createTestDatabase()
  })

  it('refuse un fichier qui ne décrit pas un drapeau, plutôt que d en charger une partie', () => {
    expect(() => parseFlags([{ ...katanga, image: 'katanga' }])).toThrow()
    expect(() => parseFlags([{ ...katanga, bossAttemptNumber: 7 }])).toThrow()
    expect(() => parseFlags([{ ...katanga, acceptedAnswers: [] }])).toThrow()
  })

  it('refuse un slug ou une image en double', async () => {
    await expect(seedFlags(db, [katanga, { ...katanga, image: '0123456789abcdef' }])).rejects.toThrow()
    await expect(seedFlags(db, [katanga, { ...katanga, slug: 'autre' }])).rejects.toThrow()
  })

  it('charge les 60 drapeaux curatés, 10 par combat de boss', async () => {
    await seedFlags(db, parseFlags(source))

    const rows = await db.select().from(flags)
    expect(rows).toHaveLength(60)
    for (let combat = 1; combat <= 6; combat += 1) {
      expect(rows.filter(row => row.bossAttemptNumber === combat)).toHaveLength(10)
    }
  })

  it('remplace le catalogue au lieu de l empiler : se relance sans doublon', async () => {
    await seedFlags(db, [katanga])
    await seedFlags(db, [{ ...katanga, answerLabel: 'Katanga' }])

    expect(await db.select().from(flags)).toEqual([expect.objectContaining({ slug: 'katanga', answerLabel: 'Katanga' })])
  })

  // #131 : le nom du fichier ne doit pas dire la réponse.
  it('donne à chaque drapeau une image opaque, présente sous public/', () => {
    for (const flag of parseFlags(source)) {
      expect(flag.image).toMatch(/^[0-9a-f]{16}$/)
      expect(existsSync(`public/images/boss/1/flags/${flag.image}.webp`)).toBe(true)
    }
  })
})
