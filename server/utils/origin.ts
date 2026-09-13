/**
 * Ce qu'une requête annonce d'où elle vient, et ce qu'on en fait.
 *
 * Seconde couche de la protection CSRF, derrière le `SameSite=Lax` du cookie de
 * session (voir server/utils/auth.ts). La première délègue tout au navigateur :
 * elle ne vaut rien sur un client qui ignore l'attribut, et Chrome laisse
 * volontairement passer les cookies de moins de deux minutes sur un POST
 * cross-site. Celle-ci ne dépend d'aucune version de navigateur.
 */

/** Ce qui n'écrit pas. Le retour OAuth de Discord en fait partie : c'est un GET. */
const READ_METHODS = ['GET', 'HEAD', 'OPTIONS']

/**
 * La requête vient-elle d'ailleurs ? Les navigateurs actuels envoient une
 * `Origin` sur **chaque** requête non-GET, soumission de formulaire cross-site
 * comprise — c'est justement celle qu'on veut attraper. Le `Referer`, lui, est
 * tronqué par les politiques de référent et par les extensions : s'y fier
 * refuserait des requêtes légitimes.
 *
 * Une requête sans `Origin` passe : un navigateur en envoie toujours une sur une
 * requête non-GET, donc l'absence désigne un client qui n'en est pas — curl, un
 * test, un appel serveur à serveur — et celui-là n'a aucun cookie de victime à
 * détourner. Refuser là-dessus casserait du légitime sans rien protéger.
 */
export function isForeignOrigin(method: string, origin: string | undefined, host: string): boolean {
  if (READ_METHODS.includes(method)) {
    return false
  }

  if (!origin) {
    return false
  }

  return originHost(origin) !== host
}

/**
 * L'hôte que l'origine désigne. On compare les hôtes et non les chaînes
 * entières : le schéma est déjà contraint par le `Secure` du cookie.
 *
 * Rend `null` sur ce qui n'est pas une URL — au premier chef l'`Origin: null`
 * d'un contexte opaque, iframe bac à sable ou document `data:`. Aucun hôte ne
 * vaut `null`, donc ces requêtes-là sont refusées, et c'est bien ce qu'on veut :
 * rien d'opaque n'a à écrire ici.
 */
function originHost(origin: string): string | null {
  try {
    return new URL(origin).host
  }
  catch {
    return null
  }
}
