import { DAY_TIERS, daysAchievement } from '~~/shared/utils/achievements'
import { GAME_STATE_KEY } from './useGameState'
import type { Ref } from 'vue'
import type { AchievementId } from '~~/shared/utils/achievements'
import type { GameState } from '~~/server/utils/game'

/** Combien de temps une annonce reste à l'écran. */
export const TOAST_MS = 4_800

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

/** La file des annonces, partagée : le layout la montre, un écran peut y poser. */
const TOASTS_KEY = 'achievement-toasts'

// L'identifiant ne suffit pas comme clé : un joueur test remis à zéro peut
// redébloquer le même succès, et deux entrées de même clé se confondraient.
let sequence = 0

/**
 * Annoncer des succès que le joueur vient de gagner. Pris en setup, appelé
 * ensuite quand on veut : le geste qui les a gravés n'a pas à passer par l'état
 * de jeu pour être annoncé (le don du Fromage, InventoryOverlay).
 *
 * Le temps est la seule sortie : une annonce s'efface d'elle-même et rien ne la
 * ferme à la main. Un succès n'appelle aucune décision, donc il n'a pas à en
 * demander une pour disparaître. Voir specs/ecrans.md.
 */
export function useAchievementAnnouncer(): (ids: AchievementId[]) => void {
  const toasts = useState<AchievementToast[]>(TOASTS_KEY, () => [])

  return (ids) => {
    for (const id of ids) {
      if (SILENT_IDS.has(id)) {
        continue
      }

      const key = `${id}-${++sequence}`

      toasts.value = [...toasts.value, { key, id }]
      setTimeout(() => {
        toasts.value = toasts.value.filter(toast => toast.key !== key)
      }, TOAST_MS)
    }
  }
}

/**
 * Les déblocages annoncés pendant la partie, pour le layout qui les montre.
 *
 * Un seul observateur, posé sur le cache de l'état de jeu : les actions du joueur
 * y reviennent — répondre, passer à la suite, ouvrir un coffre, lancer un sort —
 * et ces écrans n'ont pas à savoir qu'ils débloquent quelque chose.
 *
 * Rien à dédupliquer ici : `unlocked` ne porte que ce qu'une écriture a réellement
 * gravé, et une relecture rend un tableau vide. Voir server/utils/achievements.ts.
 */
export function useAchievementToasts(): Ref<AchievementToast[]> {
  const announce = useAchievementAnnouncer()
  const state = useNuxtData<GameState>(GAME_STATE_KEY)

  watch(() => state.data.value?.unlocked, unlocked => announce(unlocked ?? []))

  return useState<AchievementToast[]>(TOASTS_KEY, () => [])
}
