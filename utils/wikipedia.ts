/**
 * Le lien vers la page Wikipédia d'une réponse affichée, construit à la volée :
 * `go` mène à l'article quand le titre correspond, sinon aux résultats, jamais
 * à une page morte. Voir specs/ecrans.md#volumen.
 */
export function wikipediaUrl(answerLabel: string): string {
  return `https://fr.wikipedia.org/w/index.php?${new URLSearchParams({ search: searchTerm(answerLabel), go: 'Go' })}`
}

/**
 * « FLEMING (Alexander) » se cherche « Alexander FLEMING » : un nom en capitales
 * annonce une personne. Sinon la parenthèse précise, et n'est pas un titre :
 * « Bombyx du mûrier (ver à soie) » se cherche « Bombyx du mûrier ».
 */
function searchTerm(answerLabel: string): string {
  const [, name, note] = answerLabel.match(/^(.+?) \((.+)\)$/) ?? []

  if (!name) {
    return answerLabel
  }

  return name === name.toUpperCase() ? `${note} ${name}` : name
}
