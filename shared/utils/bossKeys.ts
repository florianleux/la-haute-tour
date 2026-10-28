/**
 * Toujours deux clés, quelle que soit la taille de l'équipe. Partagé parce que
 * les deux côtés en ont besoin : le serveur déverrouille la porte à ce compte,
 * le camp l'écrit (« n sur 2 »). Voir specs/boss.md#porte-à-deux-clés.
 */
export const KEYS_TO_UNLOCK = 2
