import type { Ref } from 'vue'
import type { InventoryEntryView, InventoryView } from '~~/server/utils/inventory'

/** Cache key of the inventory read: one name, so nobody re-types the string. */
export const INVENTORY_KEY = 'inventory'

export interface InventoryRead {
  entries: Ref<InventoryEntryView[]>
  /** Le nombre d'exemplaires possédés, doublons compris. */
  total: Ref<number>
  /** Vrai quand la lecture a échoué : un inventaire vide n'est pas la même nouvelle. */
  failed: Ref<boolean>
}

/**
 * Les sorts que le joueur possède, tels que la page Sorts les montre. Refusé par
 * le serveur hors attente — la page n'existe que là. Voir specs/ecrans.md#sorts.
 */
export async function useInventory(): Promise<InventoryRead> {
  const { data, error } = await useAsyncData<InventoryView>(
    INVENTORY_KEY,
    () => $fetch<InventoryView>('/api/game/inventory', useApiFetchOptions()),
  )

  return {
    entries: computed<InventoryEntryView[]>(() => data.value?.entries ?? []),
    total: computed<number>(() => data.value?.total ?? 0),
    failed: computed<boolean>(() => Boolean(error.value)),
  }
}
