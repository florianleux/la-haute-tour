import type { Ref } from 'vue'
import type { ItemsView } from '~~/server/api/game/items.get'
import type { ItemId } from '~~/shared/utils/items'

export interface ItemsRead {
  /** Les Objets du joueur, dans l'ordre où il les a reçus. */
  items: Ref<ItemId[]>
  /** Vrai quand la lecture a échoué : un sac vide n'est pas la même nouvelle. */
  failed: Ref<boolean>
}

/**
 * Les Objets du joueur, tels que l'Inventaire les montre. Refusé par le serveur
 * hors du camp — le sac ne s'ouvre que là. Voir specs/ecrans.md#inventaire.
 */
export async function useItems(): Promise<ItemsRead> {
  const { data, error } = await useAsyncData<ItemsView>(
    'items',
    () => $fetch<ItemsView>('/api/game/items', useApiFetchOptions()),
  )

  return {
    items: computed(() => data.value?.items ?? []),
    failed: computed<boolean>(() => Boolean(error.value)),
  }
}
