import { beforeEach, describe, expect, it } from 'vitest'
import { discordAvatarUrl } from '../../utils/avatar'
import { phaseLabel } from '../../utils/phase'
import { installAppGlobals, testAdmin } from '../helpers/app'
import type { PlayerCard } from '../../server/utils/players'

const { serve, breakRead, breakNetwork, signIn, calls, refresh, reset } = installAppGlobals()

const { ADMIN_PLAYERS_KEY, useAdminPlayers } = await import('../../composables/useAdminPlayers')

const card: PlayerCard = {
  userId: 7,
  username: 'gandalf',
  adventurerName: null,
  discordId: '123456789012345678',
  avatar: 'a1b2c3',
  floor: 3,
  lives: 0,
  phase: 'cooldown',
  floorSeen: 4,
  floorTotal: 8,
  cooldownUntil: '2026-09-04T18:00:00.000Z',
  pendingDisputes: 2,
  team: null,
}

describe('joueurs côté admin', () => {
  beforeEach(() => {
    reset()
    signIn(testAdmin)
  })

  it('rend les fiches renvoyées par le serveur', async () => {
    serve(ADMIN_PLAYERS_KEY, { players: [card] })

    const { players, failed } = await useAdminPlayers()

    expect(players.value).toEqual([card])
    expect(failed.value).toBe(false)
  })

  it('relit la liste après un geste, au lieu de deviner son effet', async () => {
    const { skipCooldown, grantLife } = await useAdminPlayers()

    expect(await skipCooldown(7)).toBe(true)
    expect(await grantLife(7)).toBe(true)
    expect(calls()).toEqual([
      'fetch POST /api/admin/players/7/skip-cooldown',
      'fetch POST /api/admin/players/7/grant-life',
    ])
    // La liste et l'identité servie, à chaque geste.
    expect(refresh).toHaveBeenCalledTimes(4)
  })

  // Remis à zéro, le joueur que l'admin incarne doit rejouer l'introduction :
  // l'identité en cache dirait encore qu'il l'a finie. Voir specs/admin.md.
  it('relit aussi l identité servie après une remise à zéro', async () => {
    const { resetPlayer } = await useAdminPlayers()
    refresh.mockClear()

    expect(await resetPlayer(7)).toBe(true)
    expect(calls()).toEqual(['fetch POST /api/admin/players/7/reset'])
    expect(refresh).toHaveBeenCalledTimes(2)
  })

  it('reste occupé jusqu à la relecture, pas seulement jusqu à l envoi', async () => {
    const { grantLife, acting } = await useAdminPlayers()

    const inFlight = grantLife(7)
    expect(acting.value).toBe(true)
    await inFlight

    expect(acting.value).toBe(false)
  })

  it('signale un geste refusé sans se dire illisible', async () => {
    breakNetwork()
    const { grantLife, failed } = await useAdminPlayers()

    expect(await grantLife(7)).toBe(false)
    expect(refresh).not.toHaveBeenCalled()
    expect(failed.value).toBe(false)
  })

  it('signale une lecture impossible plutôt qu une liste vide', async () => {
    breakRead(ADMIN_PLAYERS_KEY)

    const { players, failed } = await useAdminPlayers()

    expect(players.value).toEqual([])
    expect(failed.value).toBe(true)
  })
})

describe('avatar Discord', () => {
  it('sert le hash du joueur quand il en a un', () => {
    expect(discordAvatarUrl('123', 'a1b2c3'))
      .toBe('https://cdn.discordapp.com/avatars/123/a1b2c3.png?size=64')
  })

  it('retombe sur l avatar par défaut du compte, jamais sur un trou', () => {
    // (id >> 22) % 6 : la formule de Discord pour les comptes sans image.
    expect(discordAvatarUrl('1234567890123456789', null))
      .toBe('https://cdn.discordapp.com/embed/avatars/1.png')
  })
})

describe('phase en français', () => {
  it('nomme chaque phase', () => {
    expect(phaseLabel('ascent')).toBe('En ascension')
    expect(phaseLabel('cooldown')).toBe('En attente')
    expect(phaseLabel('recovery')).toBe('En rattrapage')
    expect(phaseLabel('floorEnd')).toBe('Au palier')
    expect(phaseLabel('gameOver')).toBe('Partie terminée')
  })
})
