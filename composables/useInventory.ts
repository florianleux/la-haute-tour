import { useWriteThenReplace } from './useWriteThenReplace'
import type { Ref } from 'vue'
import type { InventoryEntryView, InventoryView } from '~~/server/utils/inventory'
import type { CastView, ReceivedView } from '~~/server/utils/effects'
import type { SpellId } from '~~/shared/utils/spells'
import type { CastableTargetKind } from '~~/shared/utils/teams'

/** Cache key of the inventory read: one name, so nobody re-types the string. */
export const INVENTORY_KEY = 'inventory'

export interface InventoryRead {
  entries: Ref<InventoryEntryView[]>
  /** Le nombre d'exemplaires possédés, doublons compris. */
  total: Ref<number>
  /** Ce que le joueur a lancé, du plus récent au plus ancien. */
  log: Ref<CastView[]>
  /** Ce qu'il a reçu des autres, du plus récent au plus ancien. */
  received: Ref<ReceivedView[]>
  /** Vrai quand le joueur a une équipe : sans elle, la catégorie Allié ne vise rien. */
  canTargetAllies: Ref<boolean>
  /** Vrai quand la lecture a échoué : un inventaire vide n'est pas la même nouvelle. */
  failed: Ref<boolean>
  /** Ce qu'il reste de lancers pour l'attente en cours. */
  castsLeft: Ref<number>
  /** Ce qu'une attente permet de lancers : la règle, dite au joueur. */
  castsPerCooldown: Ref<number>
  /** Le sort dont le lancer est en vol, null au repos. */
  casting: Ref<SpellId | null>
  /** Vrai quand le dernier lancer n'est pas parti. */
  castFailed: Ref<boolean>
  /**
   * Lance un sort sur une catégorie de cible et réaffiche l'inventaire que le
   * serveur renvoie — le journal y dit qui a été touché.
   */
  cast: (spell: SpellId, target: CastableTargetKind) => Promise<void>
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

  const { failed: castFailed, send } = useWriteThenReplace(data)

  // Quel sort est en vol, plutôt qu'un simple « une écriture est en cours » : la
  // page fait tourner le bouton de ce sort-là, pas la liste entière.
  const casting = ref<SpellId | null>(null)

  /**
   * Le lancer rend l'inventaire tel qu'il est ensuite : on réaffiche ce que le
   * serveur renvoie plutôt que de retirer l'exemplaire de son côté. C'est aussi
   * par là que la cible tirée se révèle — le journal revient avec son nom.
   */
  async function cast(spell: SpellId, target: CastableTargetKind): Promise<void> {
    casting.value = spell

    await send(() => $fetch<InventoryView>('/api/game/cast', {
      method: 'POST',
      body: { spell, target },
      ...useApiFetchOptions(),
    }))

    casting.value = null
  }

  return {
    entries: computed<InventoryEntryView[]>(() => data.value?.entries ?? []),
    total: computed<number>(() => data.value?.total ?? 0),
    log: computed<CastView[]>(() => data.value?.log ?? []),
    received: computed<ReceivedView[]>(() => data.value?.received ?? []),
    canTargetAllies: computed<boolean>(() => data.value?.canTargetAllies ?? false),
    castsLeft: computed<number>(() => data.value?.castsLeft ?? 0),
    castsPerCooldown: computed<number>(() => data.value?.castsPerCooldown ?? 0),
    failed: computed<boolean>(() => Boolean(error.value)),
    casting,
    castFailed,
    cast,
  }
}
