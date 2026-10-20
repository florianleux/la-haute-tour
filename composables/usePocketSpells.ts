import { useWriteThenReplace } from './useWriteThenReplace'
import type { Ref } from 'vue'
import type { PocketSpellEntryView, PocketSpellsView } from '~~/server/utils/pocketSpells'
import type { CastView, ReceivedView } from '~~/server/utils/effects'
import type { SpellId } from '~~/shared/utils/spells'
import type { TargetKind } from '~~/shared/utils/teams'

/** Cache key of the pocket spells read: one name, so nobody re-types the string. */
export const POCKET_SPELLS_KEY = 'pocketSpells'

export interface PocketSpellsRead {
  entries: Ref<PocketSpellEntryView[]>
  /** Les sorts obtenus au moins une fois, dans l'ordre du catalogue. */
  discovered: Ref<SpellId[]>
  /** Ce que le joueur a lancé, du plus récent au plus ancien. */
  log: Ref<CastView[]>
  /** Ce qu'il a reçu des autres, du plus récent au plus ancien. */
  received: Ref<ReceivedView[]>
  /** Vrai quand le joueur a une équipe : sans elle, ni allié ni ennemi n'existe. */
  canTargetOthers: Ref<boolean>
  /** Vrai quand la lecture a échoué : une poche vide n'est pas la même nouvelle. */
  failed: Ref<boolean>
  /** Faux quand le joueur porte déjà son plafond d'effets positifs : plus de sort sur soi. */
  canTargetSelf: Ref<boolean>
  /** Faux quand aucun allié n'est à portée : personne à toucher de ce côté. */
  canTargetAlly: Ref<boolean>
  /** Faux quand aucun ennemi n'est à portée. */
  canTargetFoe: Ref<boolean>
  /** Le sort dont le lancer est en vol, null au repos. */
  casting: Ref<SpellId | null>
  /** Vrai quand le dernier lancer n'est pas parti. */
  castFailed: Ref<boolean>
  /**
   * Lance un sort sur une catégorie de cible et réaffiche les sorts en poche que le
   * serveur renvoie — le journal y dit qui a été touché.
   */
  cast: (spell: SpellId, target: TargetKind) => Promise<void>
}

/** Les sorts en poche du joueur, tels que le serveur les sert. Refusé hors du camp. */
export function fetchPocketSpells(): Promise<PocketSpellsView> {
  return $fetch<PocketSpellsView>('/api/game/pocket-spells', useApiFetchOptions())
}

/**
 * Les sorts que le joueur possède, tels que le Grimoire les montre. Refusé par
 * le serveur hors du camp — le Grimoire ne s'ouvre que là. Voir specs/ecrans.md#sorts.
 */
export async function usePocketSpells(): Promise<PocketSpellsRead> {
  const { data, error } = await useAsyncData<PocketSpellsView>(POCKET_SPELLS_KEY, fetchPocketSpells)

  const { failed: castFailed, send } = useWriteThenReplace(data)

  // Quel sort est en vol, plutôt qu'un simple « une écriture est en cours » : la
  // page fait tourner le bouton de ce sort-là, pas la liste entière.
  const casting = ref<SpellId | null>(null)

  /**
   * Le lancer rend les sorts en poche tels qu'ils sont ensuite : on réaffiche ce que le
   * serveur renvoie plutôt que de retirer l'exemplaire de son côté. C'est aussi
   * par là que la cible tirée se révèle — le journal revient avec son nom.
   */
  async function cast(spell: SpellId, target: TargetKind): Promise<void> {
    casting.value = spell

    await send(() => $fetch<PocketSpellsView>('/api/game/cast', {
      method: 'POST',
      body: { spell, target },
      ...useApiFetchOptions(),
    }))

    casting.value = null
  }

  return {
    entries: computed<PocketSpellEntryView[]>(() => data.value?.entries ?? []),
    discovered: computed<SpellId[]>(() => data.value?.discovered ?? []),
    log: computed<CastView[]>(() => data.value?.log ?? []),
    received: computed<ReceivedView[]>(() => data.value?.received ?? []),
    canTargetOthers: computed<boolean>(() => data.value?.canTargetOthers ?? false),
    canTargetSelf: computed<boolean>(() => data.value?.canTargetSelf ?? false),
    canTargetAlly: computed<boolean>(() => data.value?.canTargetAlly ?? false),
    canTargetFoe: computed<boolean>(() => data.value?.canTargetFoe ?? false),
    failed: computed<boolean>(() => Boolean(error.value)),
    casting,
    castFailed,
    cast,
  }
}
