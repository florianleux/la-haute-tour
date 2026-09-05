import { eq } from 'drizzle-orm'
import { beforeEach, describe, expect, it } from 'vitest'
import { disputes, inventory, seenQuestions } from '../../server/db/schema'
import { openDispute, settleDispute } from '../../server/utils/disputes'
import { openPlayerChest, readGameState, serveNextQuestion, submitAnswer } from '../../server/utils/game'
import { rulesForFloor } from '../../server/utils/rules'
import { SPELL_IDS } from '../../shared/utils/spells'
import { createPlayer, createQuestion, createTestDatabase, loadPlayer } from '../helpers/db'
import { rolls } from '../helpers/random'
import type { Database } from '../../server/db/client'
import type { User } from '../../server/db/schema'

const NOW = new Date('2026-09-03T12:00:00.000Z')
const rules = rulesForFloor(1)
const STEP = rules.questionsPerChest

/** Tombe sur un sort, le premier du catalogue. */
const givesSpell = (): (() => number) => rolls(0.99, 0)
/** Tombe sur un Mimic. */
const givesMimic = (): (() => number) => rolls(0)

describe('coffre de loot', () => {
  let db: Database
  let player: User

  beforeEach(async () => {
    db = await createTestDatabase()
    const id = await createPlayer(db)
    player = await loadPlayer(db, id)
  })

  const reload = (): Promise<User> => loadPlayer(db, player.id)
  const stock = (): Promise<{ spell: string }[]> =>
    db.select({ spell: inventory.spell }).from(inventory).where(eq(inventory.userId, player.id))

  /**
   * Amène le joueur juste devant une question loot, qu'il résout. `answer` décide
   * s'il la réussit.
   */
  async function playLootQuestion(answer: string, seen = STEP - 1): Promise<void> {
    const ids: string[] = []
    for (let i = 0; i < STEP * 3; i++) {
      ids.push(await createQuestion(db, { statement: `Question ${i + 1} ?` }))
    }

    await db.insert(seenQuestions).values(ids.slice(0, seen).map(questionId => ({
      userId: player.id,
      questionId,
      floor: 1,
      correct: true,
      seenAt: NOW,
      submittedAnswer: 'Bordeaux',
    })))

    await serveNextQuestion(db, await reload(), NOW)
    await submitAnswer(db, await reload(), answer, NOW)
  }

  describe('apparition', () => {
    it('pose un coffre fermé sur le verdict d une question loot réussie', async () => {
      await playLootQuestion('Bordeaux')

      const state = await readGameState(db, await reload(), NOW)

      expect(state.chest).toEqual({ opened: false, mimic: false, spell: null })
      expect(state.verdict).toMatchObject({ correct: true })
    })

    it('ne pose aucun coffre sur une question loot ratée', async () => {
      await playLootQuestion('Toulouse')

      const state = await readGameState(db, await reload(), NOW)

      expect(state.chest).toBeNull()
      expect(state.verdict).toMatchObject({ correct: false, lifeLost: true })
    })

    it('ne pose aucun coffre sur une question ordinaire réussie', async () => {
      await playLootQuestion('Bordeaux', STEP - 2)

      const state = await readGameState(db, await reload(), NOW)

      expect(state.chest).toBeNull()
    })
  })

  describe('ouverture', () => {
    it('donne un sort à l inventaire, doublons compris', async () => {
      await playLootQuestion('Bordeaux')

      const state = await openPlayerChest(db, await reload(), NOW, givesSpell())

      expect(state.chest).toEqual({ opened: true, mimic: false, spell: SPELL_IDS[0] })
      expect(await stock()).toEqual([{ spell: SPELL_IDS[0] }])
    })

    it('rend le tirage déjà fait plutôt que d en refaire un', async () => {
      await playLootQuestion('Bordeaux')
      await openPlayerChest(db, await reload(), NOW, givesSpell())

      // Un second clic, ou un appareil en retard : le dé ne se rejoue pas.
      const again = await openPlayerChest(db, await reload(), NOW, givesMimic())

      expect(again.chest).toEqual({ opened: true, mimic: false, spell: SPELL_IDS[0] })
      expect(await stock()).toHaveLength(1)
      expect((await reload()).lives).toBe(rules.lives)
    })

    it('ne jette qu un dé quand deux ouvertures partent ensemble', async () => {
      await playLootQuestion('Bordeaux')
      const player = await reload()

      // Un double-clic, ou deux appareils : les deux lisent un coffre fermé
      // avant que l'un ait écrit. Un seul doit le remporter.
      await Promise.all([
        openPlayerChest(db, player, NOW, givesSpell()),
        openPlayerChest(db, player, NOW, givesMimic()),
      ])

      expect(await stock()).toHaveLength(1)

      const state = await readGameState(db, await reload(), NOW)
      expect(state.chest).toEqual({ opened: true, mimic: false, spell: SPELL_IDS[0] })
      expect(state.lives).toBe(rules.lives)
    })

    it('survit à un rechargement : le coffre ouvert garde son contenu', async () => {
      await playLootQuestion('Bordeaux')
      await openPlayerChest(db, await reload(), NOW, givesSpell())

      const later = await readGameState(db, await reload(), new Date(NOW.getTime() + 5_000))

      expect(later.chest).toEqual({ opened: true, mimic: false, spell: SPELL_IDS[0] })
    })

    it('ignore une ouverture quand il n y a pas de coffre', async () => {
      await playLootQuestion('Toulouse')

      const state = await openPlayerChest(db, await reload(), NOW, givesSpell())

      expect(state.chest).toBeNull()
      expect(await stock()).toHaveLength(0)
    })
  })

  describe('mimic', () => {
    it('ne donne rien et vide la tentative d un coup', async () => {
      await playLootQuestion('Bordeaux')

      const state = await openPlayerChest(db, await reload(), NOW, givesMimic())

      expect(state.chest).toEqual({ opened: true, mimic: true, spell: null })
      expect(await stock()).toHaveLength(0)
      expect(state.lives).toBe(0)
    })

    it('envoie en attente comme une perte de dernière vie ordinaire', async () => {
      await playLootQuestion('Bordeaux')

      const state = await openPlayerChest(db, await reload(), NOW, givesMimic())

      expect(state.phase).toBe('cooldown')
      expect(state.cooldownUntil).toBe(new Date(NOW.getTime() + rules.cooldownMs).toISOString())
    })

    it('laisse le verdict lisible : la question était juste', async () => {
      await playLootQuestion('Bordeaux')

      const state = await openPlayerChest(db, await reload(), NOW, givesMimic())

      expect(state.verdict).toMatchObject({ correct: true, lifeLost: false })
    })
  })

  describe('contestation', () => {
    it('ne fait pas naître de coffre sur une question loot ratée puis reconnue juste', async () => {
      await playLootQuestion('Toulouse')
      const verdict = await readGameState(db, await reload(), NOW)

      await openDispute(db, await reload(), verdict.verdict!.questionId, NOW)
      const [dispute] = await db.select().from(disputes)
      await settleDispute(db, dispute.id, 'accepted', NOW)

      const state = await readGameState(db, await reload(), NOW)

      // Le verdict devient juste — c'est ce que l'arbitrage établit — mais le
      // coffre reste perdu : le statut était attaché au passage, qui est fini.
      expect(state.verdict).toMatchObject({ correct: true })
      expect(state.chest).toBeNull()
    })
  })

  describe('passage à la suite', () => {
    it('ne sert pas la question suivante tant que le coffre est fermé', async () => {
      await playLootQuestion('Bordeaux')

      const state = await serveNextQuestion(db, await reload(), NOW)

      expect(state.question).toBeNull()
      expect(state.chest).toEqual({ opened: false, mimic: false, spell: null })
    })

    it('sert la suivante une fois le coffre ouvert', async () => {
      await playLootQuestion('Bordeaux')
      await openPlayerChest(db, await reload(), NOW, givesSpell())

      const state = await serveNextQuestion(db, await reload(), NOW)

      expect(state.question).not.toBeNull()
      expect(state.chest).toBeNull()
    })

    it('n emporte pas le coffre sur la question suivante', async () => {
      await playLootQuestion('Bordeaux')
      await openPlayerChest(db, await reload(), NOW, givesSpell())
      await serveNextQuestion(db, await reload(), NOW)

      // Relu depuis la base, pas depuis ce que l'action vient de rendre : c'est
      // là qu'un coffre resté accroché à la réservation se verrait.
      const later = await readGameState(db, await reload(), NOW)

      expect(later.chest).toBeNull()
    })
  })
})
