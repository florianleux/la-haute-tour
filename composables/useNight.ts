import { isNight } from '~~/shared/utils/time'
import type { AchievementId } from '~~/shared/utils/achievements'

/**
 * La nuit, décidée à l'arrivée sur l'écran : un booléen et non un état suivi,
 * le décor ne change pas sous les yeux du joueur à 20h. `?night` la force sur
 * les bancs `/test/…`, pour la voir en journée.
 */
export function useNight(): boolean {
  const route = useRoute()
  return isNight(new Date()) || (route.path.startsWith('/test/') && 'night' in route.query)
}

/**
 * Grave « Oiseau de nuit » quand le camp s'affiche la nuit. Une fois réclamé, plus
 * de requête pour cette page : le serveur écarte de toute façon ce qui est déjà
 * acquis. Voir specs/succes.md#clins-dœil.
 */
export function useNightCampWatch(atCamp: () => boolean): void {
  const announce = useAchievementAnnouncer()
  let claimed = false

  watch(atCamp, async (shown) => {
    if (claimed || !shown || !import.meta.client || !isNight(new Date())) {
      return
    }

    claimed = true

    const { unlocked } = await $fetch<{ unlocked: AchievementId[] }>('/api/profile/night-camp', {
      method: 'POST',
      ...useApiFetchOptions(),
    })

    announce(unlocked)
  }, { immediate: true })
}
