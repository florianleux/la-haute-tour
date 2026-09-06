import type { H3Event } from 'h3'

/**
 * L'identifiant numérique que porte une route. Écrit une fois : tout ce que
 * l'administration désigne par un nombre passe par ici — les joueurs via
 * `playerFromRoute()`, les contestations en direct. Les copies qu'il remplace
 * divergeaient déjà sur ce qu'est un identifiant valide, et une de plus est
 * arrivée avec les équipes pendant qu'on les retirait.
 *
 * `refusal` est le message rendu au client : il nomme ce que la route désigne —
 * un joueur, une contestation — pour que le refus dise de quoi il parle.
 */
export function numericRouteId(event: H3Event, refusal: string): number {
  const id = Number(getRouterParam(event, 'id') ?? '')

  // `Number('')` vaut 0, et 0 est un entier : sans le signe, une route sans
  // identifiant serait acceptée puis rejetée plus loin, pour une autre raison.
  if (!Number.isInteger(id) || id <= 0) {
    throw createError({ statusCode: 400, statusMessage: refusal })
  }

  return id
}
