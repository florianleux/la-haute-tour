import type { Ref } from 'vue'
import type { AchievementsResponse } from '~~/server/api/profile/achievements.get'
import type { AchievementId } from '~~/shared/utils/achievements'

/** Cache key of the achievements read: one name, so nobody re-types the string. */
export const ACHIEVEMENTS_KEY = 'achievements'

export interface Achievements {
  /** Quand chaque succès a été débloqué, par identifiant. Vide tant que rien n'est acquis. */
  unlockedAt: Ref<Map<AchievementId, string>>
  failed: Ref<boolean>
}

/**
 * Les succès du joueur. Lecture seule : rien ne se débloque en regardant sa page,
 * tout se débloque en jouant. Voir specs/succes.md.
 *
 * Rendus en table plutôt qu'en liste : la grille pose la question dans ce sens —
 * « celui-là, il l'a ? » — cinquante fois de suite.
 */
export async function useAchievements(): Promise<Achievements> {
  const { data, error } = await useAsyncData<AchievementsResponse>(
    ACHIEVEMENTS_KEY,
    () => $fetch<AchievementsResponse>('/api/profile/achievements', useApiFetchOptions()),
  )

  return {
    unlockedAt: computed(() => new Map(
      (data.value?.unlocked ?? []).map(entry => [entry.id, entry.unlockedAt]),
    )),
    failed: computed<boolean>(() => Boolean(error.value)),
  }
}
