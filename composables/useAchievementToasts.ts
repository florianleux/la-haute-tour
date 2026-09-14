import { DAY_TIERS, daysAchievement } from '~~/shared/utils/achievements'
import { GAME_STATE_KEY } from './useGameState'
import type { Ref } from 'vue'
import type { AchievementId } from '~~/shared/utils/achievements'
import type { GameState } from '~~/server/utils/game'

/** Combien de temps une annonce reste à l'écran. */
export const TOAST_MS = 6_000

/**
 * L'Assiduité ne s'annonce jamais en toast, seulement sur la page : ces succès se
 * gagnent hors jeu, un toast surgirait sans rapport avec ce que le joueur est en
 * train de faire. Le serveur grave ces succès comme les autres — `unlocked` porte
 * la vérité complète — c'est ici, à l'affichage, que la famille se tait.
 * Voir specs/succes.md#affichage.
 */
const SILENT_IDS: ReadonlySet<AchievementId> = new Set([
  ...DAY_TIERS.map(daysAchievement),
  'TWO_DAYS_IN_A_ROW',
])

export interface AchievementToast {
  key: string
  id: AchievementId
}

/**
 * Les déblocages annoncés pendant la partie.
 *
 * Un seul observateur, posé sur le cache de l'état de jeu : toutes les actions du
 * joueur y reviennent — répondre, passer à la suite, ouvrir un coffre, lancer un
 * sort — et aucun écran n'a donc à savoir qu'il pourrait débloquer quelque chose.
 *
 * Le temps est la seule sortie : une annonce s'efface d'elle-même et rien ne la
 * ferme à la main. Un succès n'appelle aucune décision, donc il n'a pas à en
 * demander une pour disparaître. Voir specs/ecrans.md.
 *
 * Rien à dédupliquer ici : `unlocked` ne porte que ce qu'une écriture a réellement
 * gravé, et une relecture rend un tableau vide. Voir server/utils/achievements.ts.
 */
export function useAchievementToasts(): Ref<AchievementToast[]> {
  const toasts = ref<AchievementToast[]>([])
  let sequence = 0
  const state = useNuxtData<GameState>(GAME_STATE_KEY)

  watch(() => state.data.value?.unlocked, (unlocked) => {
    for (const id of unlocked ?? []) {
      if (SILENT_IDS.has(id)) {
        continue
      }

      // L'identifiant ne suffit pas comme clé : un joueur test remis à zéro peut
      // redébloquer le même succès, et deux entrées de même clé se confondraient.
      const key = `${id}-${++sequence}`

      toasts.value = [...toasts.value, { key, id }]
      setTimeout(() => {
        toasts.value = toasts.value.filter(toast => toast.key !== key)
      }, TOAST_MS)
    }
  })

  return toasts
}
