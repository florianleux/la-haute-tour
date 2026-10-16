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
 *   combat, épreuves) n'a pas à rallonger l'écran de tous ;
 * - les fichiers et dossiers cachés (`.DS_Store`...) : jamais demandés par le jeu.
 *
 * Lu par nuxt.config.ts au démarrage. Voir la section Images de CLAUDE.md.
 */
export function assetsLoadingScreenFiles(publicDir: string): string[] {
  return readdirSync(publicDir, { recursive: true, withFileTypes: true })
    .filter(entry => entry.isFile())
    .map(entry => relative(publicDir, join(entry.parentPath, entry.name)).split(sep))
    .filter(parts => !parts.some(part => part.startsWith('.')))
    .filter(parts => !(parts[0] === 'images' && parts[1] === 'boss'))
    .map(parts => `/${parts.join('/')}`)
}
