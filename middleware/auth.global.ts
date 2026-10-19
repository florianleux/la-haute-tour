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

  // Tant que l'introduction n'est pas finie, tout y ramène : c'est par elle que
  // le joueur entre dans la Tour. Les pages d'admin restent ouvertes — l'admin
  // qui incarne un joueur test neuf doit pouvoir en sortir. Voir specs/spec.md
  // (glossaire, « Introduction »).
  if (!user.value.introDone && !to.meta.admin && to.path !== '/intro') {
    return navigateTo('/intro')
  }

  // Finie, elle se ferme : c'est elle qui donne le Fromage, une fois par
  // partie. Seul un admin la revoit, pour la relire — le serveur, lui, ne
  // redonne rien à une introduction finie (server/api/profile/intro.post.ts).
  if (user.value.introDone && !isAdmin.value && to.path === '/intro') {
    return navigateTo('/')
  }
})
