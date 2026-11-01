/** La réponse d'un drapeau, en deux lignes : le nom, puis ce qui le situe. */
export interface FlagLabel {
  name: string
  /** Plus petit, à la ligne : ce qui suivait la virgule, la date au bout. Null sans virgule. */
  detail: string | null
}

/**
 * Coupe la réponse affichée d'un drapeau à sa première virgule : « État du
 * Katanga (1960-1963), sécession du Congo » donne « État du Katanga », puis
 * « Sécession du Congo (1960-1963) ». La date entre parenthèses suit le
 * sous-titre. Voir specs/boss-etage1-drapeaux.md.
 */
export function splitFlagLabel(label: string): FlagLabel {
  const comma = label.indexOf(', ')
  if (comma < 0) {
    return { name: label, detail: null }
  }
  const head = label.slice(0, comma)
  const tail = label.slice(comma + 2)
  const date = head.match(/\s*(\([^)]*\))$/)
  const name = date ? head.slice(0, date.index) : head
  const detail = date ? `${tail} ${date[1]}` : tail

  return { name, detail: detail.charAt(0).toUpperCase() + detail.slice(1) }
}
