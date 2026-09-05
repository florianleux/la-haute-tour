/** Combien d'avatars par défaut Discord propose, pour les comptes sans image. */
const DEFAULT_AVATAR_COUNT = 6n

/**
 * L'avatar d'un joueur, tel que le CDN Discord le sert. Le hash vient de la
 * connexion : Discord le donne avec le profil, et l'interroger après coup
 * demanderait un token de bot que l'application n'a pas.
 *
 * Sans hash — compte sans image, ou joueur pas encore reconnecté depuis que la
 * colonne existe — on rend l'avatar par défaut que Discord attribue lui-même à
 * ce compte. Il n'y a donc jamais de trou à la place d'une tête.
 *
 * Un joueur test porte un identifiant synthétique, que Discord n'aurait jamais
 * produit : il retombe sur le premier avatar par défaut plutôt que de faire
 * échouer la fiche entière. Voir specs/admin.md#joueurs-test.
 */
export function discordAvatarUrl(discordId: string, avatar: string | null): string {
  if (avatar) {
    return `https://cdn.discordapp.com/avatars/${discordId}/${avatar}.png?size=64`
  }

  const index = /^\d+$/.test(discordId)
    ? (BigInt(discordId) >> 22n) % DEFAULT_AVATAR_COUNT
    : 0n

  return `https://cdn.discordapp.com/embed/avatars/${index}.png`
}
