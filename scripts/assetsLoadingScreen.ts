import { readdirSync } from 'node:fs'
import { join, relative, sep } from 'node:path'

/**
 * Les fichiers que l'écran de chargement attend, en URLs `/<chemin>`.
 *
 * Tout `public/`, récursivement, parce que le jeu courant y puise sans prévenir :
 * une image ajoutée est attendue d'office, rien à déclarer. Sans ce
 * préchargement, les animations d'entrée (le cadre de jeu qui tombe, le Grimoire
 * qui monte) se jouent avant que leur image arrive.
 *
 * Exclus :
 * - `images/boss/` : ce qui ne s'affiche que dans les phases de boss (porte,
 *   introduction, combat, épreuves) n'a pas à rallonger l'écran de tous —
 *   l'écran de chargement du boss l'attend (bossAssetsLoadingScreenFiles) ;
 * - `images/login/` : la page de connexion, hors de l'écran de chargement, attend
 *   elle-même son image (LoginTitle) ;
 * - les fichiers et dossiers cachés (`.DS_Store`...) : jamais demandés par le jeu.
 *
 * Lu par nuxt.config.ts au démarrage. Voir la section Images de CLAUDE.md.
 */
export function assetsLoadingScreenFiles(publicDir: string): string[] {
  return publicFiles(publicDir)
    .filter(parts => !(parts[0] === 'images' && (parts[1] === 'boss' || parts[1] === 'login')))
    .map(parts => `/${parts.join('/')}`)
}

/**
 * Les fichiers que l'écran de chargement du boss attend, par étage : tout
 * `images/boss/<étage>/`, récursivement. Comme pour le jeu, rien à déclarer :
 * une image posée dans le dossier d'un boss est attendue d'office, à l'arrivée
 * devant sa porte. Un fichier posé à même `images/boss/` n'est à aucun boss,
 * et personne ne l'attend.
 *
 * Lu par nuxt.config.ts au démarrage.
 */
export function bossAssetsLoadingScreenFiles(publicDir: string): Record<string, string[]> {
  const byFloor: Record<string, string[]> = {}
  for (const parts of publicFiles(publicDir)) {
    const [images, boss, floor] = parts
    if (images === 'images' && boss === 'boss' && floor && parts.length > 3) {
      ;(byFloor[floor] ??= []).push(`/${parts.join('/')}`)
    }
  }
  return byFloor
}

/** Les fichiers de `public/`, récursivement, en segments de chemin, sans fichiers ni dossiers cachés. */
function publicFiles(publicDir: string): string[][] {
  return readdirSync(publicDir, { recursive: true, withFileTypes: true })
    .filter(entry => entry.isFile())
    .map(entry => relative(publicDir, join(entry.parentPath, entry.name)).split(sep))
    .filter(parts => !parts.some(part => part.startsWith('.')))
}
