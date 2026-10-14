/**
 * Réservé à qui a une équipe : les Haut-faits s'ouvrent sur la bannière de la
 * guilde du joueur, et sans équipe il n'y a pas de bannière — ni au camp, ni
 * dans la boîte. La page n'est pas atteignable, URL comprise. Nommé plutôt
 * qu'écrit en ligne dans la page, comme la garde du camp (middleware/camp.ts).
 * Voir specs/ecrans.md#haut-faits et specs/equipes.md.
 */
export default defineNuxtRouteMiddleware(async () => {
  const { user } = await useCurrentUser()

  if (!user.value?.team) {
    return navigateTo('/')
  }
})
