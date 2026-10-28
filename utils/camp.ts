import type { DoorView } from '~~/server/utils/game'
import { KEYS_TO_UNLOCK } from '~~/shared/utils/bossKeys'
import type { TeamId } from '~~/shared/utils/teams'

/** Un objet posé sur le décor du camp. */
export type CampObject = 'rope' | 'banner' | 'scroll' | 'backpack' | 'spellbook' | 'michel'
  // La bannière du poster, qui porte le décompte de l'attente : pas un objet
  // posé sur le décor, mais Michel l'éclaire comme eux.
  | 'posterBanner'

/** Ce que le camp lit de l'état servi pour savoir quels objets poser. */
export interface CampContents {
  /** La guilde du joueur. Sans équipe, pas de bannière. */
  team: TeamId | null
  /** Le joueur a déjà vu une question : le Volumen a de quoi se lire. */
  volumen: boolean
  /** Le joueur a déjà obtenu un sort, même tous lancés depuis. */
  spellbook: boolean
}

/**
 * Les objets du camp qui ont quelque chose à montrer : un joueur neuf ne voit
 * ni parchemin vide ni grimoire sans sort. Tout se déduit de l'état servi, rien
 * n'est stocké en plus. Voir specs/ecrans.md#camp-au-repos.
 */
export function campObjects({ team, volumen, spellbook }: CampContents): Set<CampObject> {
  const objects = new Set<CampObject>(['rope', 'backpack'])
  if (team) objects.add('banner')
  if (volumen) objects.add('scroll')
  if (spellbook) objects.add('spellbook')
  return objects
}

/**
 * Ce que le poster du camp dit de la porte dont le joueur est redescendu : les
 * clés posées sur deux, ou la porte déverrouillée. Les noms des poseurs
 * (`keyHolders`) ne s'affichent pas encore, comme sur la porte.
 * Voir specs/boss.md#attendre-au-camp.
 */
export function campDoorLine(door: DoorView): string {
  return door.unlocked
    ? 'La porte est déverrouillée.'
    : `La porte attend ses clés : ${door.keyHolders.length} sur ${KEYS_TO_UNLOCK}.`
}
