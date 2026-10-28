<template>
  <!-- `--landed` : l'instant où le logo se pose, 0,2 s d'attente + 0,9 s de
       chute. Tout ce qui suit la chute (flottement, reflet, gemmes, contenu du
       slot) part de là. -->
  <div class="flex w-full flex-col items-center [--landed:1.1s]">
    <div
      class="relative w-full"
      :class="ready ? 'motion-safe:animate-[drop-in_0.9s_linear_0.2s_both] [--drop-from:-100vh]' : 'invisible'"
      :style="{ aspectRatio: `${LOGO.width} / ${LOGO.height}` }"
      role="img"
      aria-label="La Haute Tour"
    >
      <div
        class="absolute inset-0"
        :class="ready && 'motion-safe:animate-[float_3.2s_ease-in-out_var(--landed)_infinite] [--float-rise:-2%]'"
      >
        <img
          ref="image"
          :src="SRC"
          alt=""
          class="block w-full"
        >
        <template v-if="ready">
          <!-- Le reflet : une bande qui glisse, dans une boîte découpée à la
               forme du logo par son propre alpha. -->
          <div
            class="absolute inset-0 overflow-hidden [mask-size:100%_100%] motion-reduce:hidden"
            :style="{ maskImage: `url(${SRC})` }"
          >
            <div class="absolute inset-y-0 left-0 w-2/5 bg-[linear-gradient(110deg,transparent,rgb(255_255_255/0.7),transparent)] motion-safe:animate-title-sheen" />
          </div>
          <SparkleStar
            v-for="gem in GEMS"
            :key="gem.delay"
            glow="#fff7d6"
            class="w-[5%] opacity-0 motion-safe:animate-twinkle"
            :style="{
              left: `calc(${(gem.x / LOGO.width) * 100}% - 2.5%)`,
              top: `calc(${(gem.y / LOGO.height) * 100}% - 2.5% * ${LOGO.width / LOGO.height})`,
              animationDelay: `calc(var(--landed) + 0.1s + ${gem.delay}s)`,
            }"
          />
        </template>
      </div>
    </div>
    <!-- Ce que la page pose sous le logo : n'apparaît qu'avec lui. -->
    <slot v-if="ready" />
  </div>
</template>

<script setup lang="ts">
// Le titre de la page de connexion : le logo tombe du haut de la fenêtre et
// rebondit (`drop-in`), puis flotte (`float`) ; un reflet le traverse
// (`title-sheen`) et les gemmes scintillent tour à tour (`twinkle`).
// La page n'a pas d'écran de chargement : le logo attend sa propre image avant
// de tomber, et le contenu du slot l'attend avec lui.

const SRC = '/images/login/title.webp'

/** La taille du logo, en px : les gemmes s'y relèvent. */
const LOGO = { width: 672, height: 509 }

/** Le centre de chaque gemme, en px du logo, et son décalage dans le cycle. */
const GEMS = [
  { x: 116, y: 101, delay: 0 },
  { x: 346, y: 183, delay: 1 },
  { x: 628, y: 156, delay: 2 },
  { x: 251, y: 319, delay: 3 },
]

const image = useTemplateRef<HTMLImageElement>('image')
const ready = ref(false)

// Rendue côté serveur, l'image peut être arrivée avant l'hydratation : son
// `load` est passé, `complete` le dit. Une image en erreur compte comme
// arrivée, comme à l'écran de chargement : la page ne reste pas vide.
onMounted(async () => {
  const img = image.value
  if (img && !img.complete) {
    await new Promise((resolve) => {
      img.addEventListener('load', resolve, { once: true })
      img.addEventListener('error', resolve, { once: true })
    })
  }
  ready.value = true
})
</script>
