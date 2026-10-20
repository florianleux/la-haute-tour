import { beforeEach, describe, expect, it } from 'vitest'
import { eq } from 'drizzle-orm'
import { activeEffects, pocketSpells, users } from '../../server/db/schema'
import { anchorEffects, castSpell, effectsQuery, readCastLog, toEffectViews } from '../../server/utils/effects'
import { rulesForFloor } from '../../server/utils/rules'
import { createPlayer, createTestDatabase, loadPlayer } from '../helpers/db'
import { installNitroGlobals } from '../helpers/nitro'
import type { Database } from '../../server/db/client'
import type { SpellId } from '../../shared/utils/spells'

installNitroGlobals()

const NOW = new Date('2026-09-05T12:00:00.000Z')
const COOLDOWN_UNTIL = new Date('2026-09-06T00:00:00.000Z')
const rules = rulesForFloor(1)

describe('lancer et ancrage des effets', () => {
  let db: Database
  let userId: number

  beforeEach(async () => {
    db = await createTestDatabase()
    userId = await createPlayer(db, { lives: 0, cooldownUntil: COOLDOWN_UNTIL })
  })

  async function own(...spells: SpellId[]): Promise<void> {
    await db.insert(pocketSpells).values(spells.map(spell => ({ userId, spell, obtainedAt: NOW })))
  }

  async function copies(): Promise<number> {
    return (await db.select().from(pocketSpells).where(eq(pocketSpells.userId, userId))).length
  }

  /** Les effets vivants du joueur, tels qu'un écran les lit. */
  async function readEffects(id: number): Promise<unknown[]> {
    const user = await loadPlayer(db, id)

    return toEffectViews(await effectsQuery(db, id), user)
  }

  async function cast(spell: SpellId, at: Date = NOW): Promise<void> {
    await castSpell(db, await loadPlayer(db, userId), spell, 'self', at)
  }

  it('consomme un exemplaire et pose un effet en attente', async () => {
    await own('VITALITY')

    await cast('VITALITY')

    expect(await copies()).toBe(0)
    expect(await readEffects(userId)).toEqual([
      { spell: 'VITALITY', face: 'boon', casterName: 'gandalf', state: 'pending', lifetime: 'attempt' },
    ])
  })

  // Aucun budget de lancers par attente, deux fois le même sort y compris.
  // Voir specs/bonus.md#où-et-quand.
  it('accepte deux fois le même sort dans une attente', async () => {
    await own('VITALITY', 'VITALITY')

    await cast('VITALITY')
    await cast('VITALITY')

    expect(await copies()).toBe(0)
    expect(await readEffects(userId)).toHaveLength(2)
  })

  // Sur soi, ce qui borne l'empilement est le plafond d'effets positifs : deux
  // magies blanches portées, et la troisième ne part pas.
  // Voir specs/bonus.md#limite-deffets-positifs.
  it('garde l exemplaire d un troisième sort sur soi, au plafond d effets positifs', async () => {
    await own('VITALITY', 'VITALITY', 'RESPITE')

    await cast('VITALITY')
    await cast('VITALITY')
    await cast('RESPITE')

    // L'exemplaire de trop reste en poche : rien n'est dépensé pour rien.
    expect(await copies()).toBe(1)
    expect(await readEffects(userId)).toHaveLength(2)
  })

  // Le plafond porte sur ce que le joueur porte, d'où que ça vienne : deux
  // magies blanches posées par un allié ferment « Sur moi » tout autant.
  it('compte au plafond les magies blanches qu un allié a posées', async () => {
    const other = await createPlayer(db, { discordId: '987654321', username: 'radagast' })
    await db.insert(activeEffects).values(Array.from({ length: rules.maxBoons }, () => ({
      userId,
      casterId: other,
      spell: 'VITALITY' as const,
      face: 'boon' as const,
      castAt: NOW,
      castCooldownStartedAt: NOW,
    })))
    await own('CHRONOMANCY')

    await cast('CHRONOMANCY')

    expect(await copies()).toBe(1)
  })

  // Une magie blanche ancrée a donné à sa tentative ce qu'elle avait à donner :
  // elle rend sa place, et l'attente d'après n'est pas bloquée par elle.
  // Voir specs/bonus.md#limite-deffets-positifs.
  it('rend les places des magies blanches ancrées à l attente suivante', async () => {
    await own('VITALITY', 'VITALITY', 'VITALITY')
    await cast('VITALITY')
    await cast('VITALITY')

    // La tentative s'ouvre et ancre les deux Vitalité, puis le joueur meurt :
    // une nouvelle attente commence, la tentative court encore jusqu'à la
    // suivante.
    const opened = await anchorEffects(db, await loadPlayer(db, userId), NOW)
    const nextStart = new Date(COOLDOWN_UNTIL.getTime() + 60_000)
    await db
      .update(users)
      .set({
        attemptStartedAt: NOW,
        lives: 0,
        cooldownStartedAt: nextStart,
        cooldownUntil: new Date(nextStart.getTime() + rules.cooldownMs),
      })
      .where(eq(users.id, userId))
    expect(opened.lives).toBe(rules.lives + 2)

    await cast('VITALITY', nextStart)

    expect(await copies()).toBe(0)
    expect(await db.select().from(activeEffects).where(eq(activeEffects.casterId, userId))).toHaveLength(3)
  })

  it('laisse lancer un autre sort dans la même attente', async () => {
    await own('VITALITY', 'RESPITE')

    await cast('VITALITY')
    await cast('RESPITE')

    expect(await copies()).toBe(0)
    expect(await readEffects(userId)).toHaveLength(2)
  })

  it('ne lance rien qu on ne possède pas', async () => {
    await cast('VITALITY')

    expect(await readEffects(userId)).toEqual([])
  })

  it('ancre ce qui attendait sur la tentative qui s ouvre', async () => {
    await own('VITALITY')
    await cast('VITALITY')

    const opened = await anchorEffects(db, await loadPlayer(db, userId), NOW)

    expect(opened.lives).toBe(rules.lives + 1)
    await db.update(users).set({ attemptStartedAt: NOW, lives: opened.lives }).where(eq(users.id, userId))
    expect(await readEffects(userId)).toEqual([
      { spell: 'VITALITY', face: 'boon', casterName: 'gandalf', state: 'active', lifetime: 'attempt' },
    ])
  })

  it('additionne deux Vitalité posées avant la même tentative', async () => {
    // Deux lanceurs peuvent viser la même tentative, et leurs effets s'empilent.
    const other = await createPlayer(db, { discordId: '987654321', username: 'radagast' })
    await db.insert(activeEffects).values([
      { userId, casterId: userId, spell: 'VITALITY', face: 'boon', castAt: NOW, castCooldownStartedAt: COOLDOWN_UNTIL },
      { userId, casterId: other, spell: 'VITALITY', face: 'boon', castAt: NOW, castCooldownStartedAt: COOLDOWN_UNTIL },
    ])

    expect((await anchorEffects(db, await loadPlayer(db, userId), NOW)).lives).toBe(rules.lives + 2)
  })

  it('laisse mourir un effet avec la tentative sur laquelle il s est ancré', async () => {
    await own('VITALITY')
    await cast('VITALITY')
    await anchorEffects(db, await loadPlayer(db, userId), NOW)
    await db.update(users).set({ attemptStartedAt: NOW }).where(eq(users.id, userId))

    // La tentative suivante s'ouvre : l'effet d'avant ne la suit pas.
    const later = new Date(NOW.getTime() + 60_000)
    const reopened = await anchorEffects(db, await loadPlayer(db, userId), later)
    await db.update(users).set({ attemptStartedAt: later }).where(eq(users.id, userId))

    expect(reopened.lives).toBe(rules.lives)
    expect(await readEffects(userId)).toEqual([])
  })

  it('garde au journal ce qui a été lancé, et quand', async () => {
    await own('VITALITY')
    await cast('VITALITY')

    expect(await readCastLog(db, await loadPlayer(db, userId))).toEqual([
      { spell: 'VITALITY', face: 'boon', targetName: 'gandalf', castAt: NOW.toISOString() },
    ])
  })

  // Le jeu montre le joueur sous le nom qu'il s'est donné, pas sous son pseudo
  // Discord. Voir specs/spec.md (glossaire, « Nom d'aventurier »).
  it('nomme lanceur et cible par leur nom d aventurier', async () => {
    await db.update(users).set({ adventurerName: 'Bilbon' }).where(eq(users.id, userId))
    await own('VITALITY')
    await cast('VITALITY')

    expect(await readEffects(userId)).toMatchObject([{ casterName: 'Bilbon' }])
    expect(await readCastLog(db, await loadPlayer(db, userId))).toMatchObject([{ targetName: 'Bilbon' }])
  })

  it('garde au journal un sort dont l effet est déjà mort', async () => {
    await own('VITALITY')
    await cast('VITALITY')
    await anchorEffects(db, await loadPlayer(db, userId), NOW)
    await db.update(users).set({ attemptStartedAt: new Date(NOW.getTime() + 60_000) }).where(eq(users.id, userId))

    expect(await readCastLog(db, await loadPlayer(db, userId))).toHaveLength(1)
    expect(await readEffects(userId)).toEqual([])
  })
})
