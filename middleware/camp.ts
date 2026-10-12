import { useGameState } from '../composables/useGameState'
import { isAtCamp } from '../utils/phase'

/**
 * Réservé au camp : les Sorts ne se lancent que là, et le Volumen ne relit ses
 * réponses que là — le rattrapage tire dans le pool. Les pages qui les portent
 * ne sont pas atteignables ailleurs, URL comprise. Nommé plutôt qu'écrit en
 * ligne dans la page, pour qu'une garde de phase se lise à côté de celle des
 * accès (middleware/auth.global.ts).
 *
 * L'état est relu plutôt que pris au cache : la partie peut avoir bougé
 * pendant que le joueur regardait un autre écran, et la page qu'il ouvrirait
 * alors n'aurait rien à montrer — le serveur la refuserait de toute façon.
 * Voir specs/ecrans.md#sorts et specs/ecrans.md#volumen.
 */
export default defineNuxtRouteMiddleware(async () => {
  const { state, refresh } = await useGameState()
  await refresh()

  if (!isAtCamp(state.value)) {
    return navigateTo('/')
  }
})
