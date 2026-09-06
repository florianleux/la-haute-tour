import type { Ref } from 'vue'

export interface WriteThenReplace<T> {
  /** Vrai de l'envoi jusqu'à ce que la réponse soit posée. */
  pending: Ref<boolean>
  /** Vrai quand la dernière écriture n'est pas partie. */
  failed: Ref<boolean>
  /**
   * Écrit, puis remplace la vue par ce que le serveur rend. Rend false quand le
   * serveur a refusé : la vue affichée n'a alors pas bougé d'un pouce, et
   * l'appelant décide quoi en dire.
   */
  send: (write: () => Promise<T>) => Promise<boolean>
}

/**
 * Écrire, puis réafficher : la réponse **est** la nouvelle vue, on la pose telle
 * quelle. Aucune écriture ne devine son résultat — pas de vie retirée du côté
 * client, pas d'exemplaire ôté de l'inventaire en espérant que le serveur suive.
 *
 * Le jumeau de [`useWriteThenRead`](./useWriteThenRead.ts), pour les écritures
 * dont la réponse porte l'état : là-bas on relit, ici on remplace.
 *
 * L'écriture est passée toute faite, et non son URL : c'est ce qui laisse
 * `$fetch<T>` s'écrire au site d'appel, sur une route connue. Un paramètre
 * `url: string` ici ramènerait exactement ce que refuse l'[ADR 0001](../docs/adr/0001-pas-de-wrapper-generique-autour-de-useasyncdata.md)
 * — une URL sans route derrière, et un `T` que le typecheck ne sait plus relier
 * à ce que la réponse porte.
 */
export function useWriteThenReplace<T>(view: Ref<T>): WriteThenReplace<T> {
  const pending = ref(false)
  const failed = ref(false)

  async function send(write: () => Promise<T>): Promise<boolean> {
    pending.value = true
    failed.value = false

    try {
      view.value = await write()
      return true
    }
    catch {
      failed.value = true
      return false
    }
    finally {
      pending.value = false
    }
  }

  return { pending, failed, send }
}
