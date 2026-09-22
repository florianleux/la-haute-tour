import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

const PAGES_DIR = fileURLToPath(new URL('../../pages', import.meta.url))

/** specs/ecrans.md : les seuls écrans atteignables sans compte. */
const OPEN_PAGES = ['login.vue', 'refus.vue']

/**
 * Un banc de design, réservé à l'admin comme le reste sous `admin:true`, mais
 * hors de `/admin` : ce n'est pas une ressource d'administration, juste un
 * écran de réglage visuel. Voir components/QuestionCard.vue.
 */
const OTHER_ADMIN_PAGES = [
  'test/play.vue',
  'test/wait.vue',
  'test/verdict.vue',
  'test/chest.vue',
  'test/recovery.vue',
  'test/dialogue.vue',
  'test/intro.vue',
]

function pageFiles(): string[] {
  return readdirSync(PAGES_DIR, { recursive: true })
    .map(String)
    .filter(file => file.endsWith('.vue'))
}

function pagesDeclaring(flag: string): string[] {
  const declaration = new RegExp(`definePageMeta\\(\\s*\\{[^}]*${flag}:\\s*true`)

  return pageFiles()
    .filter(file => declaration.test(readFileSync(join(PAGES_DIR, file), 'utf8')))
    .sort()
}

describe('pages fermées par défaut', () => {
  it('n ouvre que la connexion et le refus d accès', () => {
    expect(pagesDeclaring('public')).toEqual(OPEN_PAGES)
  })

  it('réserve toute page d administration au flag admin', () => {
    const adminPages = pageFiles().filter(file => file.startsWith('admin')).sort()

    expect(adminPages.length).toBeGreaterThan(0)
    expect(pagesDeclaring('admin')).toEqual([...adminPages, ...OTHER_ADMIN_PAGES].sort())
  })
})
