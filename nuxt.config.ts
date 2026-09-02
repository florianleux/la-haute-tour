import tailwindcss from '@tailwindcss/vite'

export default defineNuxtConfig({
  compatibilityDate: '2025-09-02',
  devtools: { enabled: true },
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
  },
})
