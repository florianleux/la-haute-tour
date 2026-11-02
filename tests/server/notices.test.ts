import { beforeEach, describe, expect, it } from 'vitest'
import { serveNextQuestion, submitAnswer } from '../../server/utils/game'
import { openDispute, pendingDisputes, settleDispute } from '../../server/utils/disputes'
import { markAchievementsAnnounced, markNoticesRead, unreadNotices } from '../../server/utils/notices'
import { createPlayer, createQuestion, createTestDatabase, loadPlayer } from '../helpers/db'
import { installNitroGlobals } from '../helpers/nitro'
import { activeEffects } from '../../server/db/schema'
import type { Database } from '../../server/db/client'
import type { User } from '../../server/db/schema'

installNitroGlobals()

const NOW = new Date('2026-11-02T12:00:00.000Z')
const LATER = new Date('2026-11-02T18:00:00.000Z')

describe('les nouvelles', () => {
  let db: Database
  let player: User

  beforeEach(async () => {
    db = await createTestDatabase()
    player = await loadPlayer(db, await createPlayer(db))
  })

  const reload = (): Promise<User> => loadPlayer(db, player.id)

  /** Une erreur contestée par le joueur, encore en attente d'arbitrage. */
  async function disputedError(): Promise<number> {
    const questionId = await createQuestion(db, { statement: 'Capitale de la Gironde ?', accepted: ['Bordeaux'] })
    await serveNextQuestion(db, await reload(), NOW)
    await submitAnswer(db, await reload(), 'Toulouse', new Date(NOW.getTime() + 1_000))
    await openDispute(db, await reload(), questionId, NOW)
    const [dispute] = await pendingDisputes(db)

    return dispute.id
  }

  it('une contestation tranchée en son absence est une nouvelle', async () => {
    const id = await disputedError()
    await settleDispute(db, id, 'accepted', LATER)

    const notices = await unreadNotices(db, await reload())

    expect(notices.disputes).toEqual([
      { id, verdict: 'accepted', statement: 'Capitale de la Gironde ?' },
    ])
  })
  /** Un sort lancé par `casterId` sur `targetId`, à `at`. */
  async function cast(casterId: number, targetId: number | null, at: Date = LATER): Promise<number> {
    const [row] = await db
      .insert(activeEffects)
      .values({ userId: targetId, casterId, spell: 'VITALITY', face: 'boon', castAt: at, castCooldownStartedAt: at })
      .returning({ id: activeEffects.id })

    return row.id
  }

  it('un sort reçu d un autre joueur est une nouvelle, avec son lanceur', async () => {
    const caster = await createPlayer(db, { discordId: '2', username: 'saroumane', adventurerName: 'Saroumane' })
    const id = await cast(caster, player.id)

    const notices = await unreadNotices(db, await reload())

    expect(notices.spells).toEqual([
      { id, spell: 'VITALITY', face: 'boon', casterName: 'Saroumane', castAt: LATER.toISOString() },
    ])
  })

  it('un sort lancé sur soi n est pas une nouvelle', async () => {
    await cast(player.id, player.id)

    expect((await unreadNotices(db, await reload())).spells).toEqual([])
  })

  it('une contestation encore en attente n est pas une nouvelle', async () => {
    await disputedError()

    expect((await unreadNotices(db, await reload())).disputes).toEqual([])
  })

  it('ce qui arrive à un autre joueur ne le concerne pas', async () => {
    const other = await createPlayer(db, { discordId: '2', username: 'saroumane' })
    await cast(player.id, other)

    expect(await unreadNotices(db, await reload())).toEqual({ disputes: [], spells: [], achievements: [] })
  })
  describe('lire', () => {
    let caster: number

    beforeEach(async () => {
      caster = await createPlayer(db, { discordId: '2', username: 'saroumane' })
    })

    it('« OK » retire cette nouvelle-là, et elle seule', async () => {
      const read = await cast(caster, player.id)
      const kept = await cast(caster, player.id)

      await markNoticesRead(db, await reload(), { disputes: [], spells: [read] }, LATER)

      expect((await unreadNotices(db, await reload())).spells.map(spell => spell.id)).toEqual([kept])
    })

    it('« OK » sur une contestation la retire', async () => {
      const id = await disputedError()
      await settleDispute(db, id, 'rejected', LATER)

      await markNoticesRead(db, await reload(), { disputes: [id], spells: [] }, LATER)

      expect((await unreadNotices(db, await reload())).disputes).toEqual([])
    })

    it('« Tout marquer lu » vide le poster', async () => {
      const id = await disputedError()
      await settleDispute(db, id, 'accepted', LATER)
      const spell = await cast(caster, player.id)

      await markNoticesRead(db, await reload(), { disputes: [id], spells: [spell] }, LATER)

      const notices = await unreadNotices(db, await reload())
      expect([notices.disputes, notices.spells]).toEqual([[], []])
    })

    // Un sort tombé entre l'affichage et le clic n'a pas été vu : il reste.
    it('« Tout marquer lu » ne lit que ce que le poster montrait', async () => {
      const shown = await cast(caster, player.id)
      const arrived = await cast(caster, player.id)

      await markNoticesRead(db, await reload(), { disputes: [], spells: [shown] }, LATER)

      expect((await unreadNotices(db, await reload())).spells.map(spell => spell.id)).toEqual([arrived])
    })

    it('ne lit jamais les nouvelles d un autre joueur', async () => {
      const id = await cast(player.id, caster)

      await markNoticesRead(db, await reload(), { disputes: [], spells: [id] }, LATER)

      expect((await unreadNotices(db, await loadPlayer(db, caster))).spells.map(spell => spell.id)).toEqual([id])
    })
  })
  describe('succès débloqués sans lui', () => {
    it('un succès gagné par son propre geste est déjà annoncé', async () => {
      await disputedError()

      expect((await unreadNotices(db, await reload())).achievements).toEqual([])
    })

    it('le succès d une contestation tranchée attend son toast', async () => {
      const id = await disputedError()
      await settleDispute(db, id, 'accepted', LATER)

      expect((await unreadNotices(db, await reload())).achievements).toEqual(['DISPUTE_ACCEPTED'])
    })

    it('une fois le toast joué, il ne revient plus', async () => {
      const id = await disputedError()
      await settleDispute(db, id, 'rejected', LATER)

      await markAchievementsAnnounced(db, await reload(), ['DISPUTE_REJECTED'], LATER)

      expect((await unreadNotices(db, await reload())).achievements).toEqual([])
    })

    it('un succès débloqué après la lecture attend encore son toast', async () => {
      const id = await disputedError()
      await settleDispute(db, id, 'rejected', LATER)

      await markAchievementsAnnounced(db, await reload(), [], LATER)

      expect((await unreadNotices(db, await reload())).achievements).toEqual(['DISPUTE_REJECTED'])
    })
  })
})
