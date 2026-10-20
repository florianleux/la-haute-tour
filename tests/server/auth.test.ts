import { eq } from 'drizzle-orm'
import { beforeEach, describe, expect, it } from 'vitest'
import { loginWithDiscord } from '../../server/utils/auth'
import { users, whitelist } from '../../server/db/schema'
import { rulesForFloor } from '../../server/utils/rules'
import { createTestDatabase } from '../helpers/db'
import type { Database } from '../../server/db/client'

const profile = {
  discordId: '123456789',
  username: 'gandalf',
  email: 'gandalf@example.com',
  avatar: 'abc123',
}

describe('loginWithDiscord', () => {
  let db: Database

  beforeEach(async () => {
    db = await createTestDatabase()
  })

  it('refuse un Discord ID absent de la whitelist', async () => {
    const result = await loginWithDiscord(db, profile)

    expect(result.status).toBe('refused')
    expect(await db.select().from(users)).toHaveLength(0)
  })

  it('crée le joueur avec son état initial au premier login whitelisté', async () => {
    await db.insert(whitelist).values({ discordId: profile.discordId })

    const result = await loginWithDiscord(db, profile)

    expect(result).toMatchObject({
      status: 'ok',
      user: {
        discordId: '123456789',
        username: 'gandalf',
        email: 'gandalf@example.com',
        isAdmin: false,
        currentFloor: 1,
        lives: rulesForFloor(1).lives,
      },
    })
  })

  it('synchronise le pseudo sur le username Discord à chaque login', async () => {
    await db.insert(whitelist).values({ discordId: profile.discordId })
    await loginWithDiscord(db, profile)

    const result = await loginWithDiscord(db, { ...profile, username: 'mithrandir' })

    expect(result).toMatchObject({ status: 'ok', user: { username: 'mithrandir' } })
  })

  // Le nom d'aventurier prime sur le pseudo à l'affichage : la connexion ne
  // l'écrase pas. Voir specs/spec.md (glossaire, « Nom d'aventurier »).
  it('ne touche jamais au nom d aventurier', async () => {
    await db.insert(whitelist).values({ discordId: profile.discordId })
    await loginWithDiscord(db, profile)
    await db.update(users).set({ adventurerName: 'Bilbon' }).where(eq(users.discordId, profile.discordId))

    const result = await loginWithDiscord(db, { ...profile, username: 'mithrandir' })

    expect(result).toMatchObject({ status: 'ok', user: { username: 'mithrandir', adventurerName: 'Bilbon' } })
  })

  it('préserve l état de jeu au re-login', async () => {
    await db.insert(whitelist).values({ discordId: profile.discordId })
    await loginWithDiscord(db, profile)
    await db
      .update(users)
      .set({ currentFloor: 4, lives: 1, isAdmin: true })
      .where(eq(users.discordId, profile.discordId))

    const result = await loginWithDiscord(db, { ...profile, username: 'mithrandir' })

    expect(result).toMatchObject({
      status: 'ok',
      user: { currentFloor: 4, lives: 1, isAdmin: true },
    })
  })

  it('ne crée pas de doublon au re-login', async () => {
    await db.insert(whitelist).values({ discordId: profile.discordId })
    await loginWithDiscord(db, profile)
    await loginWithDiscord(db, profile)

    expect(await db.select().from(users)).toHaveLength(1)
  })
})
