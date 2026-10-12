import { beforeEach, describe, expect, it } from 'vitest'
import { eq } from 'drizzle-orm'
import { setDatabase } from '../../server/db/client'
import { users, whitelist } from '../../server/db/schema'
import { bondBetween } from '../../shared/utils/teams'
import { loginWithDiscord } from '../../server/utils/auth'
import { createPlayer, createQuestion, createTestDatabase } from '../helpers/db'
import { installNitroGlobals, jsonRequest, mountRoute, sessionCookieFor } from '../helpers/nitro'
import type { Database } from '../../server/db/client'

installNitroGlobals()

const { default: setTeamHandler } = await import('../../server/api/admin/players/[id]/team.put')

const setTeam = mountRoute('put', '/players/:id/team', setTeamHandler)

const crimson = (id: number) => ({ id, team: 'TLM' as const, isTest: false })
const azure = (id: number) => ({ id, team: 'MIDI' as const, isTest: false })
const loner = (id: number) => ({ id, team: null, isTest: false })
/** Un joueur test, dans la couleur qu'on veut : il ne se lie qu'aux siens. */
const tester = (id: number, team: 'TLM' | 'MIDI') => ({ id, team, isTest: true })

describe('relation entre deux joueurs', () => {
  it('reconnaît le lanceur qui se vise lui-même, quelle que soit son équipe', () => {
    expect(bondBetween(crimson(1), crimson(1))).toBe('self')
    expect(bondBetween(loner(1), loner(1))).toBe('self')
  })

  it('fait des coéquipiers des alliés', () => {
    expect(bondBetween(crimson(1), crimson(2))).toBe('ally')
  })

  it('fait de l autre équipe des ennemis', () => {
    expect(bondBetween(crimson(1), azure(2))).toBe('foe')
  })

  it('ne relie jamais un joueur test à un vrai joueur, même sous la même couleur', () => {
    // C'est là que le monde scellé se joue : l'équipe dit de quel côté on est,
    // pas dans quel monde on joue. Voir specs/admin.md#joueurs-test.
    expect(bondBetween(tester(1, 'TLM'), crimson(2))).toBe('none')
    expect(bondBetween(crimson(1), tester(2, 'TLM'))).toBe('none')
    expect(bondBetween(tester(1, 'TLM'), azure(2))).toBe('none')
    expect(bondBetween(azure(1), tester(2, 'MIDI'))).toBe('none')
  })

  it('lie les joueurs test entre eux, ce que le PvP demande d éprouver', () => {
    expect(bondBetween(tester(1, 'TLM'), tester(2, 'TLM'))).toBe('ally')
    expect(bondBetween(tester(1, 'TLM'), tester(2, 'MIDI'))).toBe('foe')
  })

  it('ne relie personne à un joueur sans équipe, dans les deux sens', () => {
    expect(bondBetween(crimson(1), loner(2))).toBe('none')
    expect(bondBetween(loner(1), crimson(2))).toBe('none')
    expect(bondBetween(loner(1), loner(2))).toBe('none')
  })
})

describe('assignation d une équipe par l admin', () => {
  let db: Database
  let adminCookie: string
  let playerId: number

  beforeEach(async () => {
    db = await createTestDatabase()
    setDatabase(db)
    await createQuestion(db)
    playerId = await createPlayer(db, { discordId: '111', username: 'frodon' })
    adminCookie = await sessionCookieFor(
      await createPlayer(db, { discordId: '999', username: 'saruman', isAdmin: true }),
    )
  })

  const teamOf = async (id: number): Promise<string | null> =>
    (await db.select().from(users).where(eq(users.id, id)))[0].team

  it('refuse tout sans session', async () => {
    const response = await setTeam(
      jsonRequest(`http://test/players/${playerId}/team`, 'PUT', { team: 'TLM' }),
    )

    expect(response.status).toBe(401)
  })

  it('refuse un joueur qui n est pas admin', async () => {
    const cookie = await sessionCookieFor(playerId)

    const response = await setTeam(
      jsonRequest(`http://test/players/${playerId}/team`, 'PUT', { team: 'TLM' }, cookie),
    )

    expect(response.status).toBe(403)
  })

  it('met un joueur dans une équipe', async () => {
    const response = await setTeam(
      jsonRequest(`http://test/players/${playerId}/team`, 'PUT', { team: 'TLM' }, adminCookie),
    )

    expect(response.status).toBe(200)
    expect(await teamOf(playerId)).toBe('TLM')
  })

  it('déplace un joueur d une équipe à l autre', async () => {
    await setTeam(jsonRequest(`http://test/players/${playerId}/team`, 'PUT', { team: 'TLM' }, adminCookie))

    await setTeam(jsonRequest(`http://test/players/${playerId}/team`, 'PUT', { team: 'MIDI' }, adminCookie))

    expect(await teamOf(playerId)).toBe('MIDI')
  })

  it('retire l équipe avec null : l appartenance est facultative', async () => {
    await setTeam(jsonRequest(`http://test/players/${playerId}/team`, 'PUT', { team: 'TLM' }, adminCookie))

    await setTeam(jsonRequest(`http://test/players/${playerId}/team`, 'PUT', { team: null }, adminCookie))

    expect(await teamOf(playerId)).toBeNull()
  })

  it('rejette une équipe qui n existe pas', async () => {
    const response = await setTeam(
      jsonRequest(`http://test/players/${playerId}/team`, 'PUT', { team: 'VERTE' }, adminCookie),
    )

    expect(response.status).toBe(400)
    expect(await teamOf(playerId)).toBeNull()
  })

  // Une requête mal formée se refuse pour ce qu'elle est, sans qu'un identifiant
  // introuvable prenne les devants : le corps se lit avant d'aller chercher le
  // joueur en base. Voir server/utils/routes.ts.
  it('refuse le corps avant l identifiant, et l identifiant impossible en 400', async () => {
    const badBody = await setTeam(
      jsonRequest('http://test/players/4242/team', 'PUT', { team: 'VERTE' }, adminCookie),
    )
    expect(badBody.status).toBe(400)

    const noSuchPlayer = await setTeam(
      jsonRequest('http://test/players/4242/team', 'PUT', { team: 'TLM' }, adminCookie),
    )
    expect(noSuchPlayer.status).toBe(404)

    const impossibleId = await setTeam(
      jsonRequest('http://test/players/0/team', 'PUT', { team: 'TLM' }, adminCookie),
    )
    expect(impossibleId.status).toBe(400)
  })

  it('naît sans équipe : rien n en attribue une tout seul', async () => {
    expect(await teamOf(playerId)).toBeNull()
  })

  it('place aussi un joueur test : sans équipe, il ne sert à rien au PvP', async () => {
    const testPlayerId = await createPlayer(db, {
      discordId: 'test-1',
      username: 'Testeur A',
      isTest: true,
    })

    const response = await setTeam(
      jsonRequest(`http://test/players/${testPlayerId}/team`, 'PUT', { team: 'MIDI' }, adminCookie),
    )

    expect(response.status).toBe(200)
    expect(await teamOf(testPlayerId)).toBe('MIDI')
  })

  it('oppose deux joueurs test une fois placés', async () => {
    expect(bondBetween(tester(1, 'TLM'), tester(2, 'MIDI'))).toBe('foe')
  })
})

describe('l équipe décidée à l invitation', () => {
  let db: Database

  const profile = {
    discordId: '777',
    username: 'samsagace',
    email: null,
    avatar: null,
  }

  beforeEach(async () => {
    db = await createTestDatabase()
    setDatabase(db)
  })

  const invite = async (team: 'TLM' | 'MIDI' | null): Promise<void> => {
    await db.insert(whitelist).values({ discordId: profile.discordId, team })
  }

  it('donne au joueur l équipe choisie en l autorisant', async () => {
    await invite('MIDI')

    const result = await loginWithDiscord(db, profile)

    expect(result.status).toBe('ok')
    expect(result.status === 'ok' && result.user.team).toBe('MIDI')
  })

  it('laisse sans équipe qui a été autorisé sans en choisir', async () => {
    await invite(null)

    const result = await loginWithDiscord(db, profile)

    expect(result.status === 'ok' && result.user.team).toBeNull()
  })

  it('ne déplace personne à la reconnexion : la fiche joueur fait foi ensuite', async () => {
    await invite('MIDI')
    const first = await loginWithDiscord(db, profile)
    expect(first.status === 'ok' && first.user.team).toBe('MIDI')

    // L'admin déplace le joueur, puis quelqu'un réédite la whitelist.
    await db.update(users).set({ team: 'TLM' }).where(eq(users.discordId, profile.discordId))
    await db.update(whitelist).set({ team: 'MIDI' }).where(eq(whitelist.discordId, profile.discordId))

    const again = await loginWithDiscord(db, profile)

    expect(again.status === 'ok' && again.user.team).toBe('TLM')
  })

  it('ne crée toujours aucun compte hors whitelist', async () => {
    expect((await loginWithDiscord(db, profile)).status).toBe('refused')
  })
})
