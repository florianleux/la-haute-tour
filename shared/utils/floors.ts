/**
 * La tour, en un seul chiffre. Partagé parce que les deux côtés en ont besoin :
 * le schéma le grave dans sa contrainte d'étage, l'administration en fait une
 * liste déroulante. Deux copies dériveraient.
 *
 * Les 6 étages sont équivalents : les questions y sont réparties au hasard.
 */
export const FLOOR_COUNT = 6

/** Les étages, du premier au dernier. */
export function everyFloor(): number[] {
  return Array.from({ length: FLOOR_COUNT }, (_, index) => index + 1)
}

/** Les étages, tels qu'une liste déroulante les propose. */
export function floorOptions(): { value: string, label: string }[] {
  return everyFloor().map(floor => ({ value: String(floor), label: `Étage ${floor}` }))
}
