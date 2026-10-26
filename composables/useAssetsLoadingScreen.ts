import { behindMobileWall } from '../utils/mobileWall'
import type { ComputedRef, Ref } from 'vue'

/** Au plus combien de temps l'écran de chargement tient, depuis `start()`. */
export const ASSETS_LOADING_CEILING_MS = 10_000

/**
 * Vrai pour le jeu, l'introduction et les pages de test : celles dont les
 * animations d'entrée partent sur des images. Décide pour toutes les pages à la
 * fois — le layout l'applique, comme `blockedByMaintenance`, et une nouvelle
 * page `/test/…` est couverte d'office. Voir specs/ecrans.md.
 */
export function showsAssetsLoadingScreen(path: string): boolean {
  return path === '/' || path === '/intro' || path.startsWith('/test/')
}

// Une fois par écran et par onglet — le jeu, chaque boss —, à la clé de son
// état : le module vit autant que l'application côté client.
const started = new Set<string>()

// Les images préchargées, tenues jusqu'à la fin de l'onglet. Lâchées, le
// navigateur les oublie au premier ménage de sa mémoire, et les redemande au
// réseau quand le jeu les affiche — revalidées à chaque fois (`netlify.toml`) :
// le parchemin du Volumen s'ouvrait sans son image, le camp visible à travers,
// le temps de la réponse.
const kept: HTMLImageElement[] = []

export interface AssetsLoadingScreen {
  loaded: Ref<number>
  total: number
  done: ComputedRef<boolean>
  start: () => void
}

/**
 * Le préchargement des fichiers du jeu, avant son premier affichage dans
 * l'onglet. Un fichier en erreur compte comme arrivé : il ne doit pas tenir
 * l'écran. Chaque objet `Image` est gardé (`kept`) : le navigateur sert alors
 * le fichier de sa mémoire quand le jeu le demande dans la même page. D'une visite à
 * l'autre, chaque image est revalidée (`netlify.toml`) : un 304 sans contenu si
 * elle n'a pas changé.
 *
 * `start()` ne part que d'un `onMounted`, donc jamais côté serveur.
 */
export function useAssetsLoadingScreen(): AssetsLoadingScreen {
  return preloading(useRuntimeConfig().public.assetsLoadingScreenFiles, 'assetsLoadingScreen')
}

/**
 * Le même préchargement, pour les phases d'un boss (`bossAssetsLoadingScreen`) :
 * les fichiers de son dossier, `public/images/boss/<étage>/`, à l'arrivée
 * devant sa porte. Une fois par boss et par onglet. Un étage sans dossier n'a
 * rien à attendre : l'écran est fini d'emblée. Voir specs/spec.md#glossaire.
 */
export function useBossAssetsLoadingScreen(floor: number): AssetsLoadingScreen {
  // Typée sur les dossiers présents au démarrage : relue comme une table
  // ouverte, un étage sans dossier y est permis.
  const byFloor: Record<string, string[]> = useRuntimeConfig().public.bossAssetsLoadingScreenFiles
  const files = byFloor[String(floor)] ?? []
  return preloading(files, `bossAssetsLoadingScreen-${floor}`)
}

/** Le préchargement de ces fichiers, sous cette clé : celle de son état, et de son départ. */
function preloading(files: string[], key: string): AssetsLoadingScreen {
  const total = files.length
  const loaded = useState(key, () => 0)
  const done = computed(() => loaded.value >= total)

  function start(): void {
    if (started.has(key)) {
      return
    }

    // Derrière le mur mobile, le jeu ne s'affichera pas : pas ses images sur un
    // téléphone. Une rotation peut lever le mur, d'où le nouvel essai.
    if (behindMobileWall()) {
      window.addEventListener('resize', start, { once: true })
      return
    }
    started.add(key)

    // Borné : un fichier arrivé après le plafond ne fait pas déborder la barre.
    const settle = (): void => {
      loaded.value = Math.min(loaded.value + 1, total)
    }

    for (const url of files) {
      const image = new Image()
      image.onload = settle
      image.onerror = settle
      image.src = url
      kept.push(image)
    }

    // Les téléchargements en vol continuent en fond ; l'écran, lui, s'en va.
    setTimeout(() => {
      loaded.value = total
    }, ASSETS_LOADING_CEILING_MS)
  }

  return { loaded, total, done, start }
}
