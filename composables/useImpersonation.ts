import type { Ref } from 'vue'

export interface Impersonation {
  /** Vrai le temps que la bascule parte et que la page suivante s'ouvre. */
  pending: Ref<boolean>
  /** Vrai quand le serveur a refusé la bascule : l'écran le dit. */
  failed: Ref<boolean>
  /** Incarne un joueur test, ou redevient soi-même avec `null`. */
  actAs: (userId: number | null) => Promise<void>
}

/**
 * La bascule d'identité de l'admin. À part de useCurrentUser(), qui ne fait que
 * lire : celle-ci écrit — elle change la session, jette les lectures en cache et
 * navigue. Même partage que useLogout(). Voir specs/admin.md#incarnation.
 */
export function useImpersonation(): Impersonation {
  const pending = ref(false)
  const failed = ref(false)

  async function actAs(userId: number | null): Promise<void> {
    failed.value = false
    pending.value = true

    try {
      await $fetch('/api/admin/impersonate', { method: 'POST', body: { userId } })
    }
    catch {
      // Le serveur a refusé : on reste qui on était plutôt que de naviguer vers
      // une partie qu'on ne joue pas.
      failed.value = true
      pending.value = false
      return
    }

    // L'application redémarre pour de bon, elle ne navigue pas. Vider les
    // caches ne relance aucune lecture, et aller vers `/` depuis `/` ne fait
    // rien du tout : l'écran resterait celui du joueur qu'on vient de quitter,
    // vidé de son état. Un rechargement complet rebâtit tout — identité, état
    // de jeu, inventaire — sous la nouvelle personne, sans énumérer ce qu'il
    // faut jeter. Le jeu étant la page d'accueil, c'est là qu'on atterrit.
    reloadNuxtApp({ path: '/', persistState: false })

    // Pas de remise à zéro de `pending` : la page s'en va, et le sélecteur doit
    // rester inerte jusqu'à ce qu'elle parte.
  }

  return { pending, failed, actAs }
}
