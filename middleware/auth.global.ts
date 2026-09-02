/**
 * Everything is behind the whitelist, so pages are protected by default: a page
 * added without a second thought is closed, not open. Public pages opt out with
 * `definePageMeta({ public: true })`.
 */
export default defineNuxtRouteMiddleware(async (to) => {
  if (to.meta.public) {
    return
  }

  const { user } = await useCurrentUser()
  if (!user.value) {
    return navigateTo('/login')
  }
})
