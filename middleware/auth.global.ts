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

  const { user } = await useCurrentUser()
  if (!user.value) {
    return navigateTo('/login')
  }

  if (to.meta.admin && !user.value.isAdmin) {
    return navigateTo('/')
  }
})
