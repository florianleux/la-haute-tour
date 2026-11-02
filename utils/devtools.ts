/**
 * Guetter l'ouverture des outils de développement, pour « La curiosité est un
 * vilain défaut ». Aucun navigateur ne la signale : on lit ce qui la trahit, dit
 * sans DOM pour rester testable. Approximatif, et assumé : le succès est sans
 * effet. Voir specs/succes.md#clins-dœil.
 */

/** Ce qu'il faut d'un appui de touche. `code` plutôt que `key` : Option change la lettre sur Mac. */
export interface ShortcutPress {
  code: string
  ctrlKey: boolean
  metaKey: boolean
  shiftKey: boolean
  altKey: boolean
}

/** Inspecteur, console, sélecteur d'élément. */
const PANEL_CODES = new Set(['KeyI', 'KeyJ', 'KeyC'])

/** F12, Ctrl+Maj+I/J/C, Cmd+Opt+I/J/C. */
export function isDevtoolsShortcut(press: ShortcutPress): boolean {
  if (press.code === 'F12') {
    return true
  }

  const windows = press.ctrlKey && press.shiftKey
  const mac = press.metaKey && press.altKey

  return (windows || mac) && PANEL_CODES.has(press.code)
}

/** Ce qu'un panneau ancré creuse entre la fenêtre et la page, au moins. */
const DOCKED_GAP_PX = 200

export interface WindowSize {
  outerWidth: number
  innerWidth: number
  outerHeight: number
  innerHeight: number
}

/** Un panneau ancré sur le côté ou en bas mange la page, pas la fenêtre. */
export function looksDocked(size: WindowSize): boolean {
  return size.outerWidth - size.innerWidth > DOCKED_GAP_PX
    || size.outerHeight - size.innerHeight > DOCKED_GAP_PX
}
