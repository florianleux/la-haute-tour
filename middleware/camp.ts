import { useGameState } from '../composables/useGameState'
import { isAtCamp } from '../utils/phase'

/**
 * Réservé au camp : les Sorts ne se lancent que là, donc la page qui les
 * porte n'est pas atteignable ailleurs, URL comprise. Nommé plutôt qu'écrit en
 * ligne dans la page, pour qu'une garde de phase se lise à côté de celle des
 * accès (middleware/auth.global.ts).
 *
 * L'état est relu plutôt que pris au cache : la partie peut avoir bougé
 * pendant que le joueur regardait un autre écran, et la page qu'il ouvrirait
 * alors n'aurait rien à montrer — le serveur la refuserait de toute façon.
 * Voir specs/ecrans.md#sorts.
 */
export default defineNuxtRouteMiddleware(async () => {
  const { state, refresh } = await useGameState()
  await refresh()

  if (!isAtCamp(state.value)) {
    return navigateTo('/')
  }
})
