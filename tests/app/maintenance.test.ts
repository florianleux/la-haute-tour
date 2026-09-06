import { beforeEach, describe, expect, it } from 'vitest'
import { installAppGlobals, testAdmin } from '../helpers/app'

const { answerWith, breakNetwork, calls, refresh, reset, signIn } = installAppGlobals()

const { MAINTENANCE_KEY, useMaintenance } = await import('../../composables/useMaintenance')

describe('interrupteur de maintenance', () => {
  beforeEach(() => {
    reset()
    signIn(testAdmin)
  })

  it('affiche ce que le serveur répond, jamais ce qu on espérait', async () => {
    answerWith({ since: '2026-09-06T09:00:00.000Z' })
    const { since, set } = await useMaintenance()

    expect(await set(true)).toBe(true)

    expect(calls()).toEqual(['fetch POST /api/admin/maintenance'])
    expect(since.value).toBe('2026-09-06T09:00:00.000Z')
  })

  it('relit quand le serveur refuse, plutôt que de laisser l espoir à l écran', async () => {
    breakNetwork()
    const { failed, set } = await useMaintenance()

    expect(await set(true)).toBe(false)

    expect(failed.value).toBe(true)
    expect(refresh).toHaveBeenCalledOnce()
  })

  // Le geste ne s'arrête pas à l'écriture refusée : il relit. Relâcher le bouton
  // à l'écriture le ferait cesser de tourner pendant que l'étiquette de
  // l'interrupteur peut encore changer sous les yeux de l'admin.
  it('garde le bouton occupé jusqu à la relecture comprise', async () => {
    breakNetwork()
    const { pending, set } = await useMaintenance()
    let occupiedDuringReread: boolean | null = null
    refresh.mockImplementation(async () => {
      occupiedDuringReread = pending.value
    })

    await set(true)

    expect(occupiedDuringReread).toBe(true)
    expect(pending.value).toBe(false)
  })

  it('ne nomme la clé de lecture qu une fois', () => {
    expect(MAINTENANCE_KEY).toBe('admin-maintenance')
  })
})
