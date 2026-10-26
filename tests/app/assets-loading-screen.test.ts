import { mkdirSync, mkdtempSync, rmSync, statSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { showsAssetsLoadingScreen } from '../../composables/useAssetsLoadingScreen'
import { assetsLoadingScreenFiles, bossAssetsLoadingScreenFiles } from '../../scripts/assetsLoadingScreen'
import { installAppGlobals } from '../helpers/app'

const { reset } = installAppGlobals()

/** Ce que l'écran de chargement peut attendre au plus, en octets. Voir CLAUDE.md#images. */
const ASSETS_LOADING_BUDGET_BYTES = 15 * 1024 * 1024

const publicDir = fileURLToPath(new URL('../../public', import.meta.url))

describe('les fichiers que l écran de chargement attend', () => {
  let dir: string

  afterEach(() => rmSync(dir, { recursive: true, force: true }))

  it('garde le jeu courant et laisse les fichiers cachés et les phases de boss', () => {
    dir = mkdtempSync(join(tmpdir(), 'assets-'))
    mkdirSync(join(dir, 'images', 'boss'), { recursive: true })
    mkdirSync(join(dir, '.cache'))
    writeFileSync(join(dir, 'favicon.svg'), '')
    writeFileSync(join(dir, 'images', 'play-bg.webp'), '')
    writeFileSync(join(dir, '.DS_Store'), '')
    writeFileSync(join(dir, '.cache', 'hidden.webp'), '')
    writeFileSync(join(dir, 'images', 'boss', 'door.webp'), '')

    expect(assetsLoadingScreenFiles(dir).sort()).toEqual(['/favicon.svg', '/images/play-bg.webp'])
  })
})

describe('les fichiers que l écran de chargement du boss attend', () => {
  let dir: string

  afterEach(() => rmSync(dir, { recursive: true, force: true }))

  it('range ceux de chaque boss sous son étage, sous-dossiers compris', () => {
    dir = mkdtempSync(join(tmpdir(), 'assets-'))
    mkdirSync(join(dir, 'images', 'boss', '1', 'flags'), { recursive: true })
    mkdirSync(join(dir, 'images', 'boss', '2'), { recursive: true })
    writeFileSync(join(dir, 'images', 'play-bg.webp'), '')
    writeFileSync(join(dir, 'images', 'boss', 'stray.webp'), '')
    writeFileSync(join(dir, 'images', 'boss', '1', 'door.webp'), '')
    writeFileSync(join(dir, 'images', 'boss', '1', '.DS_Store'), '')
    writeFileSync(join(dir, 'images', 'boss', '1', 'flags', 'peru.webp'), '')
    writeFileSync(join(dir, 'images', 'boss', '2', 'door.webp'), '')

    const byFloor = bossAssetsLoadingScreenFiles(dir)

    expect(byFloor['1']!.sort()).toEqual(['/images/boss/1/door.webp', '/images/boss/1/flags/peru.webp'])
    expect(byFloor['2']).toEqual(['/images/boss/2/door.webp'])
    expect(Object.keys(byFloor).sort()).toEqual(['1', '2'])
  })
})

describe('le poids de l écran de chargement', () => {
  it('reste sous le budget', () => {
    const bytes = assetsLoadingScreenFiles(publicDir)
      .reduce((sum, url) => sum + statSync(join(publicDir, url)).size, 0)

    expect(
      bytes,
      'Les fichiers attendus par l écran de chargement dépassent 15 Mo. '
      + 'Une image des seules phases de boss va dans public/images/boss/ — voir la section Images de CLAUDE.md.',
    ).toBeLessThanOrEqual(ASSETS_LOADING_BUDGET_BYTES)
  })
})

/** Un faux `Image` : le test dit lui-même quand chaque fichier arrive ou échoue. */
class FakeImage {
  static created: FakeImage[] = []
  onload: (() => void) | null = null
  onerror: (() => void) | null = null
  src = ''

  constructor() {
    FakeImage.created.push(this)
  }
}

describe('le préchargement', () => {
  // Le module retient qu'il a démarré, comme un onglet : chaque test en importe
  // un neuf.
  async function screenFor(files: string[]) {
    vi.stubGlobal('useRuntimeConfig', () => ({ public: { assetsLoadingScreenFiles: files } }))
    vi.resetModules()
    const { ASSETS_LOADING_CEILING_MS, useAssetsLoadingScreen } = await import('../../composables/useAssetsLoadingScreen')
    return { ceiling: ASSETS_LOADING_CEILING_MS, screen: useAssetsLoadingScreen() }
  }

  beforeEach(() => {
    reset()
    FakeImage.created = []
    vi.stubGlobal('Image', FakeImage)
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
    vi.unstubAllGlobals()
  })

  /** Un fichier en erreur compte comme arrivé : il ne doit pas tenir l écran. */
  it('ne se termine qu une fois chaque fichier arrivé ou en erreur', async () => {
    const { screen } = await screenFor(['/a.webp', '/b.webp'])

    screen.start()
    expect(FakeImage.created.map(image => image.src)).toEqual(['/a.webp', '/b.webp'])

    FakeImage.created[0]!.onload!()
    expect(screen.done.value).toBe(false)

    FakeImage.created[1]!.onerror!()
    expect(screen.done.value).toBe(true)
  })

  it('se termine au plafond même si des fichiers sont encore en vol', async () => {
    const { ceiling, screen } = await screenFor(['/a.webp', '/b.webp'])

    screen.start()
    vi.advanceTimersByTime(ceiling - 1)
    expect(screen.done.value).toBe(false)

    vi.advanceTimersByTime(1)
    expect(screen.done.value).toBe(true)
    expect(screen.loaded.value).toBe(screen.total)

    // Un fichier qui arrive après le plafond ne fait pas déborder la barre.
    FakeImage.created[0]!.onload!()
    expect(screen.loaded.value).toBe(screen.total)
  })

  it('ne relance rien au second démarrage', async () => {
    const { screen } = await screenFor(['/a.webp'])

    screen.start()
    screen.start()

    expect(FakeImage.created).toHaveLength(1)
  })

  /** Un téléphone ne télécharge pas un jeu qu'il ne peut pas montrer. */
  it('attend que le mur mobile s en aille', async () => {
    const wall = { offsetParent: {} as object | null }
    const listeners: (() => void)[] = []
    vi.stubGlobal('document', { getElementById: (id: string) => (id === 'mobile-wall' ? wall : null) })
    vi.stubGlobal('window', { addEventListener: (_: string, listener: () => void) => listeners.push(listener) })
    const { screen } = await screenFor(['/a.webp'])

    screen.start()
    expect(FakeImage.created).toHaveLength(0)

    wall.offsetParent = null
    listeners.forEach(listener => listener())
    expect(FakeImage.created).toHaveLength(1)
  })
})

describe('le préchargement d un boss', () => {
  async function bossScreenFor(byFloor: Record<string, string[]>, floor: number) {
    vi.stubGlobal('useRuntimeConfig', () => ({ public: { assetsLoadingScreenFiles: [], bossAssetsLoadingScreenFiles: byFloor } }))
    vi.resetModules()
    const { useBossAssetsLoadingScreen } = await import('../../composables/useAssetsLoadingScreen')
    return useBossAssetsLoadingScreen(floor)
  }

  beforeEach(() => {
    reset()
    FakeImage.created = []
    vi.stubGlobal('Image', FakeImage)
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
    vi.unstubAllGlobals()
  })

  it('n attend que les fichiers de son étage', async () => {
    const screen = await bossScreenFor({ 1: ['/images/boss/1/door.webp'], 2: ['/images/boss/2/door.webp'] }, 1)

    screen.start()
    expect(FakeImage.created.map(image => image.src)).toEqual(['/images/boss/1/door.webp'])
    expect(screen.done.value).toBe(false)

    FakeImage.created[0]!.onload!()
    expect(screen.done.value).toBe(true)
  })

  it('n a rien à attendre pour un étage sans dossier', async () => {
    const screen = await bossScreenFor({ 1: ['/images/boss/1/door.webp'] }, 3)

    expect(screen.done.value).toBe(true)
  })
})

describe('les pages qui passent par l écran de chargement', () => {
  it.each(['/', '/intro', '/test/play'])('%s l attend', (path) => {
    expect(showsAssetsLoadingScreen(path)).toBe(true)
  })

  it.each(['/login', '/profil', '/admin'])('%s s en passe', (path) => {
    expect(showsAssetsLoadingScreen(path)).toBe(false)
  })
})
