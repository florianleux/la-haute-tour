import { isForeignOrigin } from '../utils/origin'

/**
 * Aucune écriture ne vient d'un autre site. Posé en middleware plutôt qu'en tête
 * de handler : une route ajoutée sans y penser est gardée, et il n'y a pas une
 * garde par endpoint à tenir à jour.
 *
 * Ce que la décision vaut et pourquoi : server/utils/origin.ts.
 */
export default defineEventHandler((event): void => {
  // `xForwardedHost` parce que Netlify sert derrière un proxy : l'en-tête `host`
  // brut n'y porte pas le domaine public, et tout se ferait refuser en prod.
  const host = getRequestHost(event, { xForwardedHost: true })

  if (isForeignOrigin(event.method, getRequestHeader(event, 'origin'), host)) {
    throw createError({ statusCode: 403, statusMessage: 'Origine non autorisée' })
  }
})
