import type { Ref } from 'vue'

export interface WriteThenRead {
  /** Vrai depuis l'envoi jusqu'à ce que la relecture soit revenue. */
  pending: Ref<boolean>
  /** Écrit puis relit. Rend false quand le serveur a refusé l'écriture. */
  send: (
    url: string,
    method: 'POST' | 'PUT' | 'DELETE',
    body?: Record<string, unknown>,
  ) => Promise<boolean>
}

/**
 * Écrire, puis relire : aucune écriture ne devine son résultat, l'écran montre
 * ce que la base contient et rien d'autre. Le drapeau ne retombe qu'après la
 * relecture — avant, la liste n'est pas à jour.
 *
 * L'[ADR 0001](../docs/adr/0001-pas-de-wrapper-generique-autour-de-useasyncdata.md)
 * refuse un wrapper générique autour des *lectures* : il ferait passer l'URL en
 * `string` et tuerait l'inférence des routes typées de Nitro. Ici rien n'est
 * typé par la réponse — elle est ignorée, seul le refus compte.
 */
export function useWriteThenRead(refresh: () => Promise<void>): WriteThenRead {
  const pending = ref(false)

  async function send(
    url: string,
    method: 'POST' | 'PUT' | 'DELETE',
    body?: Record<string, unknown>,
  ): Promise<boolean> {
    pending.value = true

    try {
      await $fetch(url, { method, body })
    }
    catch {
      // L'appelant décide quoi dire : une écriture refusée et une liste
      // illisible sont deux nouvelles différentes.
      pending.value = false
      return false
    }

    await refresh()
    pending.value = false

    return true
  }

  return { pending, send }
}
