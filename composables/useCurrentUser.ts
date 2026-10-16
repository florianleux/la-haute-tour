import type { Ref } from 'vue'
import type { MeResponse, SessionUser } from '~~/server/api/auth/me.get'

/** Cache key of the identity read: one name, so nobody re-types the string. */
export const CURRENT_USER_KEY = 'current-user'

export interface CurrentUser {
  user: Ref<SessionUser | null>
  /**
   * Le compte connecté quand il en incarne un autre, null sinon. L'écran s'en
   * sert pour dire qui joue vraiment.
   */
  impersonator: Ref<SessionUser | null>
  /** Les joueurs test que le sélecteur propose. Vide pour qui n'est pas admin. */
  testPlayers: Ref<SessionUser[]>
  /**
   * Les droits d'admin, lus sur le compte connecté et non sur l'identité
   * servie : sous incarnation, le jeu voit un joueur ordinaire, mais
   * l'administration et le sélecteur doivent rester — sans quoi l'incarnation
   * serait sans retour. La règle vit dans isRealAdmin(). Voir utils/identity.ts.
   */
  isAdmin: Ref<boolean>
  refresh: () => Promise<void>
}

/**
 * Who the player is, always read back from the server. Identity only: floor and
 * lives come from useGameState(). See specs/architecture.md.
 *
 * Backed by useAsyncData so route middleware can await it and share the one
 * request with the page that renders right after.
 *
 * La forme useAsyncData/$fetch est répétée dans les autres lectures à dessein :
 * la cacher derrière un module générique tue l'inférence des routes typées.
 * Voir docs/adr/0001-pas-de-wrapper-generique-autour-de-useasyncdata.md.
 */
export async function useCurrentUser(): Promise<CurrentUser> {
  const { data, refresh } = await useAsyncData<MeResponse>(
    CURRENT_USER_KEY,
    () => $fetch<MeResponse>('/api/auth/me', useApiFetchOptions()),
    {
      default: (): MeResponse => ({ user: null, impersonator: null, testPlayers: [] }),
      // L'identité ne bouge entre deux navigations client ; la relire ne ferait
      // que ralentir l'accueil sans rien apprendre de neuf. Une bascule
      // d'incarnation vide le cache plutôt que de la relire ici.
      getCachedData: (_key, nuxtApp) => nuxtApp.payload.data[CURRENT_USER_KEY] as MeResponse | undefined,
    },
  )

  return {
    user: computed<SessionUser | null>(() => data.value?.user ?? null),
    impersonator: computed<SessionUser | null>(() => data.value?.impersonator ?? null),
    testPlayers: computed<SessionUser[]>(() => data.value?.testPlayers ?? []),
    isAdmin: computed<boolean>(() => isRealAdmin(data.value ?? null)),
    refresh,
  }
}
