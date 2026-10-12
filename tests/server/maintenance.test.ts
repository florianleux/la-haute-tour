import { beforeEach, describe, expect, it } from 'vitest'
import { openPlayerChest, readGameState, serveNextQuestion, submitAnswer } from '../../server/utils/game'
import { maintenanceSince, setMaintenance } from '../../server/utils/maintenance'
import { rulesForFloor } from '../../server/utils/rules'
import { createPlayer, createQuestion, createTestDatabase, loadPlayer } from '../helpers/db'
import { rolls } from '../helpers/random'
import type { Database } from '../../server/db/client'
import type { User } from '../../server/db/schema'

const NOW = new Date('2026-09-03T12:00:00.000Z')
const rules = rulesForFloor(1)

describe('maintenance', () => {
  let db: Database
  let player: User

  beforeEach(async () => {
    db = await createTestDatabase()
    for (let i = 0; i < rules.questionsPerChest * 2; i++) {
      await createQuestion(db, { statement: `Question ${i} ?` })
    }
    player = await loadPlayer(db, await createPlayer(db))
  })

  const reload = (id = player.id): Promise<User> => loadPlayer(db, id)

  describe('interrupteur', () => {
    it('est ouvert tant que personne n a fermé', async () => {
      expect(await maintenanceSince(db)).toBeNull()
    })

    it('se ferme, se rouvre, et retient depuis quand', async () => {
      await setMaintenance(db, true, NOW)
      expect(await maintenanceSince(db)).toEqual(NOW)

      await setMaintenance(db, false, NOW)
      expect(await maintenanceSince(db)).toBeNull()
    })

    it('ne crée jamais deux réglages', async () => {
      await setMaintenance(db, true, NOW)
      await setMaintenance(db, false, NOW)
      await setMaintenance(db, true, new Date(NOW.getTime() + 1_000))

      expect(await maintenanceSince(db)).toEqual(new Date(NOW.getTime() + 1_000))
    })
  })

  describe('ce que voit le joueur', () => {
    it('ferme le jeu à celui qui n a pas commencé', async () => {
      await setMaintenance(db, true, NOW)

      const state = await readGameState(db, await reload(), NOW)

      expect(state.maintenance).toBe(true)
      expect(state.question).toBeNull()
    })

    it('ne sert plus de question', async () => {
      await setMaintenance(db, true, NOW)

      const state = await serveNextQuestion(db, await reload(), NOW)

      expect(state.question).toBeNull()
      expect(state.maintenance).toBe(true)
    })

    it('laisse finir la question déjà servie', async () => {
      const served = await serveNextQuestion(db, await reload(), NOW)
      await setMaintenance(db, true, NOW)

      // Couper ici volerait une réponse déjà payée d'un timer.
      const held = await readGameState(db, await reload(), NOW)

      expect(held.question).toEqual(served.question)
    })

    it('laisse répondre et lire le verdict', async () => {
      await serveNextQuestion(db, await reload(), NOW)
      await setMaintenance(db, true, NOW)

      const answered = await submitAnswer(db, await reload(), 'Bordeaux', NOW)

      expect(answered.verdict).toMatchObject({ correct: true })
    })

    it('ferme la porte au clic suivant, verdict lu', async () => {
      await serveNextQuestion(db, await reload(), NOW)
      await setMaintenance(db, true, NOW)
      await submitAnswer(db, await reload(), 'Bordeaux', NOW)

      const state = await serveNextQuestion(db, await reload(), NOW)

      // Le verdict reste, la question suivante ne vient pas.
      expect(state.verdict).toMatchObject({ correct: true })
      expect(state.question).toBeNull()
      expect(state.maintenance).toBe(true)
    })

    it('laisse ouvrir le coffre d une question loot déjà gagnée', async () => {
      for (let i = 0; i < rules.questionsPerChest; i++) {
        await serveNextQuestion(db, await reload(), NOW)
        await submitAnswer(db, await reload(), 'Bordeaux', NOW)
      }
      await setMaintenance(db, true, NOW)

      const opened = await openPlayerChest(db, await reload(), NOW, rolls(0.99, 0))

      expect(opened.chest).toMatchObject({ opened: true, mimic: false })
    })
  })

  describe('l admin', () => {
    it('continue de jouer', async () => {
      const admin = await loadPlayer(db, await createPlayer(db, {
        discordId: 'admin-1',
        isAdmin: true,
      }))
      await setMaintenance(db, true, NOW)

      const state = await serveNextQuestion(db, admin, NOW)

      expect(state.maintenance).toBe(false)
      expect(state.question).not.toBeNull()
    })
  })

  describe('le joueur test', () => {
    it('continue de jouer', async () => {
      const testPlayer = await loadPlayer(db, await createPlayer(db, {
        discordId: 'test-1',
        isTest: true,
      }))
      await setMaintenance(db, true, NOW)

      const state = await serveNextQuestion(db, testPlayer, NOW)

      expect(state.maintenance).toBe(false)
      expect(state.question).not.toBeNull()
    })
  })

  describe('les attentes', () => {
    it('ne sont pas suspendues : l échéance ne bouge pas', async () => {
      const playerInCooldown = await createPlayer(db, {
        discordId: 'en-attente',
        lives: 0,
        cooldownUntil: new Date(NOW.getTime() + 3_600_000),
      })

      await setMaintenance(db, true, NOW)
      const during = await readGameState(db, await reload(playerInCooldown), NOW)

      await setMaintenance(db, false, new Date(NOW.getTime() + 60_000))
      const after = await readGameState(db, await reload(playerInCooldown), new Date(NOW.getTime() + 60_000))

      expect(during.cooldownUntil).toBe(after.cooldownUntil)
    })
  })
})
