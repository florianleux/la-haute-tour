import { beforeEach, describe, expect, it } from 'vitest'
import { installAppGlobals, testAdmin } from '../helpers/app'

const { serve, breakRead, breakNetwork, signIn, calls, refresh, reset } = installAppGlobals()

const { WHITELIST_KEY, useWhitelist } = await import('../../composables/useWhitelist')

describe('whitelist côté admin', () => {
  beforeEach(() => {
    reset()
    signIn(testAdmin)
  })

  it('rend les Discord IDs renvoyés par le serveur', async () => {
    serve(WHITELIST_KEY, { entries: [{ discordId: '111', createdAt: '2026-09-01T10:00:00.000Z' }] })

    const { entries, failed } = await useWhitelist()

    expect(entries.value).toEqual([{ discordId: '111', createdAt: '2026-09-01T10:00:00.000Z' }])
    expect(failed.value).toBe(false)
  })

  it('relit la liste après un ajout, au lieu de la deviner', async () => {
    const { add } = await useWhitelist()

    const added = await add('111', 'CRIMSON')

    expect(added).toBe(true)
    expect(calls()).toEqual(['fetch POST /api/admin/whitelist'])
    expect(refresh).toHaveBeenCalledOnce()
  })

  it('reste occupé jusqu à ce que la liste soit relue, pas seulement postée', async () => {
    const { add, adding } = await useWhitelist()

    const inFlight = add('111', 'CRIMSON')
    expect(adding.value).toBe(true)
    await inFlight

    expect(adding.value).toBe(false)
    expect(refresh).toHaveBeenCalledOnce()
  })

  it('signale un ajout refusé sans relire, et sans se dire illisible', async () => {
    breakNetwork()
    const { add, failed } = await useWhitelist()

    const added = await add('111', 'CRIMSON')

    expect(added).toBe(false)
    expect(refresh).not.toHaveBeenCalled()
    // Un ajout refusé ne rend pas la liste illisible : deux nouvelles distinctes.
    expect(failed.value).toBe(false)
  })

  it('signale une lecture impossible', async () => {
    breakRead(WHITELIST_KEY)

    const { failed } = await useWhitelist()

    expect(failed.value).toBe(true)
  })

  it('relit la liste après un retrait', async () => {
    const { remove } = await useWhitelist()

    const removed = await remove('111')

    expect(removed).toBe(true)
    expect(calls()).toEqual(['fetch DELETE /api/admin/whitelist/111'])
    expect(refresh).toHaveBeenCalledOnce()
  })

  it('n occupe que la ligne retirée, et jamais le bouton d ajout', async () => {
    const { remove, removing, adding } = await useWhitelist()

    const inFlight = remove('111')
    expect(removing.value).toBe('111')
    // Le bouton « Ajouter » n'a rien demandé : son loader doit rester éteint.
    expect(adding.value).toBe(false)
    await inFlight

    expect(removing.value).toBeNull()
  })

  it('signale un retrait refusé sans relire', async () => {
    breakNetwork()
    const { remove, removing, failed } = await useWhitelist()

    const removed = await remove('111')

    expect(removed).toBe(false)
    expect(removing.value).toBeNull()
    expect(refresh).not.toHaveBeenCalled()
    expect(failed.value).toBe(false)
  })
})
