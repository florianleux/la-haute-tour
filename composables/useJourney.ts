import type { Ref } from 'vue'
import type { JourneyResponse } from '~~/server/api/profile/journey.get'
import type { JourneyStats } from '~~/server/utils/journey'

/** Cache key of the journey read: one name, so nobody re-types the string. */
export const JOURNEY_KEY = 'journey'

export interface Journey {
  journey: Ref<JourneyStats | null>
  /** True when the journey could not be read: des zéros seraient un mensonge. */
  failed: Ref<boolean>
}

/**
 * Le parcours affiché sur le profil. Lecture seule, et sans effet : elle ne
 * réserve rien et ne fait avancer aucune partie. Voir specs/ecrans.md#profil.
 */
export async function useJourney(): Promise<Journey> {
  const { data, error } = await useAsyncData<JourneyResponse>(
    JOURNEY_KEY,
    () => $fetch<JourneyResponse>('/api/profile/journey', useApiFetchOptions()),
  )

  return {
    journey: computed<JourneyStats | null>(() => data.value?.journey ?? null),
    failed: computed<boolean>(() => Boolean(error.value)),
  }
}
