import type { H3Event } from 'h3'

/**
 * L'identifiant numérique que porte une route. Écrit une fois : trois gestes
 * d'administration le lisent, et les trois copies divergeaient déjà sur ce
 * qu'est un identifiant valide.
 *
 * `unknown` nomme ce que la route désigne — un joueur, une contestation — pour
 * que le refus dise de quoi il parle.
 */
export function numericRouteId(event: H3Event, unknown: string): number {
  const id = Number(getRouterParam(event, 'id') ?? '')

  // `Number('')` vaut 0, et 0 est un entier : sans le signe, une route sans
  // identifiant serait acceptée puis rejetée plus loin, pour une autre raison.
  if (!Number.isInteger(id) || id <= 0) {
    throw createError({ statusCode: 400, statusMessage: unknown })
  }

  return id
}
