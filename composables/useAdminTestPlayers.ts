import { useWriteThenRead } from './useWriteThenRead'
import type { Ref } from 'vue'
import type { TestPlayersResponse } from '~~/server/api/admin/test-players/index.get'
import type { PlayerCard } from '~~/server/utils/players'
import type { SpellId } from '~~/shared/utils/spells'
import type { TeamId } from '~~/shared/utils/teams'

/** Cache key of the testPlayer roster read: one name, so nobody re-types the string. */
export const ADMIN_TEST_PLAYERS_KEY = 'admin-test-players'

export interface AdminTestPlayers {
  testPlayers: Ref<PlayerCard[]>
  /** Vrai quand la liste n'a pas pu être lue : « aucun » serait un mensonge. */
  failed: Ref<boolean>
  loading: Ref<boolean>
  /** Vrai de l'envoi d'un geste jusqu'à ce que la liste soit relue. */
  acting: Ref<boolean>
  create: () => Promise<boolean>
  remove: (userId: number) => Promise<boolean>
  grantSpell: (userId: number, spell: SpellId) => Promise<boolean>
  advance: (userId: number, count: number, correct: boolean) => Promise<boolean>
  rewind: (userId: number, count: number) => Promise<boolean>
  sendToCooldown: (userId: number) => Promise<boolean>
  skipCooldown: (userId: number) => Promise<boolean>
  grantLife: (userId: number) => Promise<boolean>
  /** Met le joueur test dans une équipe, ou l'en retire avec null. */
  setTeam: (userId: number, team: TeamId | null) => Promise<boolean>
  reset: (userId: number) => Promise<boolean>
  refresh: () => Promise<void>
}

/**
 * Les joueurs test et les gestes qu'on exerce sur eux. Admin seulement — la
 * garde serveur est ce qui protège. Voir specs/admin.md#joueurs-test.
 *
 * Rendre une vie, passer l'attente et changer d'équipe passent par les endpoints
 * joueurs : ce sont exactement les mêmes gestes, et un joueur test est un joueur.
 * L'équipe compte double ici — sans elle, deux joueurs test ne sont ni alliés ni
 * ennemis, et le PvP qu'ils servent à éprouver ne s'applique pas.
 */
export async function useAdminTestPlayers(): Promise<AdminTestPlayers> {
  const { data, error, status, refresh } = await useAsyncData<TestPlayersResponse>(
    ADMIN_TEST_PLAYERS_KEY,
    () => $fetch<TestPlayersResponse>('/api/admin/test-players', useApiFetchOptions()),
    { default: (): TestPlayersResponse => ({ testPlayers: [] }) },
  )

  // L'identité servie est relue avec la liste : un geste sur le joueur que
  // l'admin incarne la change — remis à zéro, il doit rejouer l'introduction,
  // et le garde des pages lirait sinon l'ancienne.
  const { refresh: refreshUser } = await useCurrentUser()
  const { pending: acting, send } = useWriteThenRead(async () => {
    await Promise.all([refresh(), refreshUser()])
  })

  return {
    testPlayers: computed<PlayerCard[]>(() => data.value?.testPlayers ?? []),
    failed: computed<boolean>(() => Boolean(error.value)),
    loading: computed<boolean>(() => status.value === 'pending'),
    acting,
    create: () => send('/api/admin/test-players', 'POST'),
    remove: userId => send(`/api/admin/test-players/${userId}`, 'DELETE'),
    grantSpell: (userId, spell) => send(`/api/admin/test-players/${userId}/grant-spell`, 'POST', { spell }),
    advance: (userId, count, correct) =>
      send(`/api/admin/test-players/${userId}/advance`, 'POST', { count, correct }),
    rewind: (userId, count) => send(`/api/admin/test-players/${userId}/rewind`, 'POST', { count }),
    sendToCooldown: userId => send(`/api/admin/test-players/${userId}/cooldown`, 'POST'),
    skipCooldown: userId => send(`/api/admin/players/${userId}/skip-cooldown`, 'POST'),
    grantLife: userId => send(`/api/admin/players/${userId}/grant-life`, 'POST'),
    setTeam: (userId, team) => send(`/api/admin/players/${userId}/team`, 'PUT', { team }),
    reset: userId => send(`/api/admin/test-players/${userId}/reset`, 'POST'),
    refresh,
  }
}
