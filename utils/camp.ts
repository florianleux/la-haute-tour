import type { DoorView } from '~~/server/utils/game'
import { BOSS_DOORS } from './bossDoors'
import type { TeamId } from '~~/shared/utils/teams'

/** Un objet posé sur le décor du camp. */
export type CampObject = 'rope' | 'banner' | 'scroll' | 'backpack' | 'spellbook' | 'mushroom' | 'michel'
  // La bannière du poster, qui porte le décompte de l'attente : pas un objet
  // posé sur le décor, mais Michel l'éclaire comme eux.
  | 'posterBanner'

/**
 * Le clic qui cueille le Champignon : le troisième d'un triple clic, ou un clic
 * au clavier (`detail` nul), qui n'en fait jamais trois.
 */
export function picksMushroom(clickCount: number): boolean {
  return clickCount === 0 || clickCount >= 3
}

/** D'où le Champignon cueilli part à l'écran : ce qu'ItemReveal attend en `from`. */
export interface PickedFrom {
  x: number
  y: number
  width: number
}

/** Ce que le camp lit de l'état servi pour savoir quels objets poser. */
export interface CampContents {
  /** La guilde du joueur. Sans équipe, pas de bannière. */
  team: TeamId | null
  /** Le joueur a déjà vu une question : le Volumen a de quoi se lire. */
  volumen: boolean
  /** Le joueur a déjà obtenu un sort, même tous lancés depuis. */
  spellbook: boolean
  /** Un Champignon appétissant pousse : un triple clic le cueille. */
  mushroom: boolean
}

/**
 * Les objets du camp qui ont quelque chose à montrer : un joueur neuf ne voit
 * ni parchemin vide ni grimoire sans sort. Tout se déduit de l'état servi, rien
 * n'est stocké en plus. Voir specs/ecrans.md#camp-au-repos.
 */
export function campObjects({ team, volumen, spellbook, mushroom }: CampContents): Set<CampObject> {
  const objects = new Set<CampObject>(['rope', 'backpack'])
  if (team) objects.add('banner')
  if (volumen) objects.add('scroll')
  if (spellbook) objects.add('spellbook')
  if (mushroom) objects.add('mushroom')
  return objects
}

/**
 * Ce que le poster du camp dit de la porte dont le joueur est redescendu,
 * nommée au catalogue des portes : la clé qui manque, ou la porte
 * déverrouillée. Les noms des poseurs (`keyHolders`) ne s'affichent pas
 * encore, comme sur la porte. Voir specs/boss.md#attendre-au-camp.
 */
export function campDoorLine(door: DoorView, floor: number): string {
  const name = BOSS_DOORS[floor] ? `La ${BOSS_DOORS[floor].name}` : 'La porte'

  if (door.unlocked) {
    return `${name} est déverrouillée, tu peux maintenant l'ouvrir.`
  }

  return door.keyHolders.length
    ? `${name} attend toujours sa deuxième clé.`
    : `${name} attend toujours ses deux clés.`
}
