import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

const PAGES_DIR = fileURLToPath(new URL('../../pages', import.meta.url))

/** specs/ecrans.md : les seuls écrans atteignables sans compte. */
const OPEN_PAGES = ['login.vue', 'refus.vue']

function pageFiles(): string[] {
  return readdirSync(PAGES_DIR, { recursive: true })
    .map(String)
    .filter(file => file.endsWith('.vue'))
}

describe('pages fermées par défaut', () => {
  it('n ouvre que la connexion et le refus d accès', () => {
    const open = pageFiles().filter(file =>
      /definePageMeta\(\s*\{[^}]*public:\s*true/.test(readFileSync(join(PAGES_DIR, file), 'utf8')),
    )

    expect(open.sort()).toEqual(OPEN_PAGES)
  })
})
