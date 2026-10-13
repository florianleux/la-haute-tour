/**
 * Une route d'API inconnue répond 404, et non la page d'accueil. L'attrape-tout
 * des pages ne vaut que pour ce qu'un humain tape dans sa barre d'adresse : sans
 * celui-ci, un appel d'API mal formé recevrait une redirection vers du HTML, ce
 * qu'aucun client ne sait lire. Voir specs/ecrans.md#liste-des-écrans.
 */
export default defineEventHandler(() => {
  throw createError({ statusCode: 404, statusMessage: 'Route inconnue' })
})
