<template>
  <div
    class="relative w-full"
    :class="ready ? 'motion-safe:animate-title-drop' : 'invisible'"
    :style="{ aspectRatio: `${LOGO.width} / ${LOGO.height}` }"
    role="img"
    aria-label="La Haute Tour"
  >
    <div
      class="absolute inset-0"
      :class="ready && 'motion-safe:animate-title-float'"
    >
      <img
        ref="image"
        :src="SRC"
        alt=""
        class="block w-full"
      >
      <!-- Le reflet, découpé à la forme du logo par son propre alpha. -->
      <div
        v-if="ready"
        class="absolute inset-0 bg-[linear-gradient(110deg,transparent_40%,rgb(255_255_255/0.7)_50%,transparent_60%)] bg-size-[300%_100%] [mask-size:100%_100%] motion-safe:animate-title-sheen motion-reduce:hidden"
        :style="{ maskImage: `url(${SRC})` }"
      />
      <template v-if="ready">
        <SparkleStar
          v-for="gem in GEMS"
          :key="gem.delay"
          glow="#fff7d6"
          class="w-[5%] opacity-0 motion-safe:animate-twinkle"
          :style="{
            left: `calc(${(gem.x / LOGO.width) * 100}% - 2.5%)`,
            top: `calc(${(gem.y / LOGO.height) * 100}% - 2.5% * ${LOGO.width / LOGO.height})`,
            animationDelay: `${1.2 + gem.delay}s`,
          }"
        />
      </template>
    </div>
  </div>
</template>

<script setup lang="ts">
// Le titre de la page de connexion : le logo tombe du haut de la fenêtre et
// rebondit (`title-drop`), puis flotte (`title-float`) ; un reflet le
// traverse (`title-sheen`) et les gemmes scintillent tour à tour (`twinkle`).
// La page n'a pas d'écran de chargement : le logo attend sa propre image avant
// de tomber, et le dit (`ready`) pour que la page cale la suite dessus.

const emit = defineEmits<{ ready: [] }>()

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
// `load` est passé, `complete` le dit.
onMounted(async () => {
  const img = image.value
  if (img && !img.complete) {
    await new Promise(resolve => img.addEventListener('load', resolve, { once: true }))
  }
  ready.value = true
  emit('ready')
})
</script>
