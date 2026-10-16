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

// Une fois par onglet : le module vit autant que l'application côté client.
let started = false

export interface AssetsLoadingScreen {
  loaded: Ref<number>
  total: number
  done: ComputedRef<boolean>
  start: () => void
}

/**
 * Le préchargement des fichiers du jeu, avant son premier affichage dans
 * l'onglet. Un fichier en erreur compte comme arrivé : il ne doit pas tenir
 * l'écran. Aucun objet `Image` n'est gardé : le cache mémoire du navigateur
 * sert le fichier quand le jeu le demande dans la même page. D'une visite à
 * l'autre, chaque image est revalidée (`netlify.toml`) : un 304 sans contenu si
 * elle n'a pas changé.
 *
 * `start()` ne part que d'un `onMounted`, donc jamais côté serveur.
 */
export function useAssetsLoadingScreen(): AssetsLoadingScreen {
  const files = useRuntimeConfig().public.assetsLoadingScreenFiles
  const total = files.length
  const loaded = useState('assetsLoadingScreen', () => 0)
  const done = computed(() => loaded.value >= total)

  function start(): void {
    if (started) {
      return
    }
    started = true

    // Borné : un fichier arrivé après le plafond ne fait pas déborder la barre.
    const settle = (): void => {
      loaded.value = Math.min(loaded.value + 1, total)
    }

    for (const url of files) {
      const image = new Image()
      image.onload = settle
      image.onerror = settle
      image.src = url
    }

    // Les téléchargements en vol continuent en fond ; l'écran, lui, s'en va.
    setTimeout(() => {
      loaded.value = total
    }, ASSETS_LOADING_CEILING_MS)
  }

  return { loaded, total, done, start }
}
