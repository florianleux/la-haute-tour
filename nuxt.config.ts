import { fileURLToPath } from 'node:url'
import tailwindcss from '@tailwindcss/vite'
import { assetsLoadingScreenFiles, bossAssetsLoadingScreenFiles } from './scripts/assetsLoadingScreen'

export default defineNuxtConfig({
  compatibilityDate: '2025-09-02',
  devtools: { enabled: true },
  // `.claude/` porte l'outillage de l'assistant, et parfois des worktrees git —
  // des copies complètes du dépôt, `node_modules` compris. Sans cette ligne, le
  // serveur de dev les surveille : des dizaines de milliers de descripteurs, un
  // `EMFILE`, et un serveur qui écoute sans jamais répondre.
  ignore: ['**/.claude/**'],
  modules: ['@nuxt/eslint'],
  // Les primitives de components/ui/ s'utilisent sans préfixe de dossier :
  // <BaseButton>, pas <UiBaseButton>.
  components: [
    { path: '~/components/ui', pathPrefix: false },
    '~/components',
  ],
  css: ['~/assets/css/main.css'],
  vite: {
    plugins: [tailwindcss()],
    server: {
      // pnpm range les dépendances dans une forêt de liens symboliques sous
      // `node_modules/.pnpm`. Le watcher les suit, ouvre un descripteur par
      // dossier et fait tomber le serveur de dev sur `EMFILE: too many open
      // files` — il écoute, mais ne répond plus. On ne surveille que le code
      // du projet, seul à changer sous les doigts.
      //
      // `.claude/` est ancré sur la racine du projet, pas en `**/.claude/**` :
      // le watcher compare des chemins absolus, et quand le projet tourne
      // lui-même depuis un worktree rangé sous `.claude/worktrees/`, le motif
      // large ignorait tout le code — plus aucun rechargement.
      watch: {
        followSymlinks: false,
        ignored: ['**/node_modules/**', '**/.git/**', '**/.output/**', `${fileURLToPath(new URL('.claude', import.meta.url))}/**`, '**/local.db*'],
      },
    },
  },
  typescript: {
    strict: true,
    typeCheck: false,
  },
  nitro: {
    preset: process.env.NETLIFY ? 'netlify' : undefined,
  },
  // La config DB n'est pas dans runtimeConfig : le client Drizzle et drizzle-kit
  // lisent les mêmes env vars (DATABASE_URL / TURSO_*), une seule source.
  runtimeConfig: {
    sessionPassword: '',
    discord: {
      clientId: '',
      clientSecret: '',
      redirectUri: '',
    },
    public: {
      // Lue au démarrage : en dev, une image ajoutée n'est attendue qu'après
      // redémarrage. Voir scripts/assetsLoadingScreen.ts.
      assetsLoadingScreenFiles: assetsLoadingScreenFiles(fileURLToPath(new URL('public', import.meta.url))),
      bossAssetsLoadingScreenFiles: bossAssetsLoadingScreenFiles(fileURLToPath(new URL('public', import.meta.url))),
    },
  },
})
