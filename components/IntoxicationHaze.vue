<template>
  <!-- Le filtre de l'intoxication, appelé par main.css sur la racine, les boîtes
       et les toasts. Taille nulle et non `hidden` : un SVG masqué perd ses
       filtres sur certains navigateurs. -->
  <svg class="pointer-events-none fixed size-0" aria-hidden="true">
    <filter id="intoxicated-haze" x="0" y="0" width="100%" height="100%" color-interpolation-filters="sRGB">
      <!-- Plus longues en large qu'en haut, comme une houle. -->
      <feTurbulence type="fractalNoise" baseFrequency="0.0025 0.008" numOctaves="1" seed="4" />
      <feColorMatrix type="matrix" :values="haze.swell" result="swell" />
      <feDisplacementMap in="SourceGraphic" in2="swell" :scale="haze.displacement" xChannelSelector="R" yChannelSelector="G" />
      <feColorMatrix type="hueRotate" :values="String(haze.hue)" />
      <feColorMatrix type="saturate" :values="String(haze.saturation)" />
    </filter>
  </svg>
</template>

<script setup lang="ts">
// Les vagues et les couleurs de l'intoxication : un filtre SVG, seul à déformer
// l'écran autrement que d'un bloc. Une `animation` CSS ne sait pas le faire : un
// filtre `url()` ne s'interpole pas, et ses attributs ne sont pas du CSS. Monté,
// il monte de lui-même (hazeAt). Voir specs/champignon.md.
const haze = ref(hazeAt(0))

let frame = 0

function animate(start: number, now: number): void {
  haze.value = hazeAt(now - start)
  frame = requestAnimationFrame(next => animate(start, next))
}

onMounted(() => {
  if (prefersReducedMotion()) {
    haze.value = STILL_HAZE
  }
  else {
    animate(performance.now(), performance.now())
  }
})

onUnmounted(() => cancelAnimationFrame(frame))
</script>
