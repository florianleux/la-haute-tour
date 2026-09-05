/**
 * Everything is behind the whitelist, so pages are protected by default: a page
 * added without a second thought is closed, not open. Public pages opt out with
 * `definePageMeta({ public: true })`, admin pages tighten with
 * `definePageMeta({ admin: true })`.
 *
 * The server guard (requireAdmin) is what actually protects the data; this only
 * spares the player a screen the API would refuse to fill.
 */
export default defineNuxtRouteMiddleware(async (to) => {
  if (to.meta.public) {
    return
  }

  const { user, isAdmin } = await useCurrentUser()
  if (!user.value) {
    return navigateTo('/login')
  }

  // Les droits viennent du compte connecté, pas de l'identité servie : un admin
  // qui incarne un joueur test garde l'accès à /admin, sinon il ne pourrait
  // plus redevenir lui-même. Voir specs/admin.md#incarnation.
  if (to.meta.admin && !isAdmin.value) {
    return navigateTo('/')
  }
})
