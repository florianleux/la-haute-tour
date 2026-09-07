<template>
  <!-- À cheval sur le bord bas du cadre. Le positionnement (translate de calage)
       vit sur ce conteneur ; le hover (scale) vit sur le bouton lui-même, pour
       ne pas composer les deux transforms — sinon le texte dérive légèrement
       de son repère au survol. -->
  <div
    class="absolute left-1/2 z-20 w-[65%] sm:w-[32%] -translate-x-1/2 translate-y-1/2"
    :class="anchor === 'card-bottom' ? 'sm:top-[76%] top-[62%] sm:bottom-0' : 'bottom-0'"
    style="aspect-ratio: 634 / 175;"
  >
    <button
      type="button"
      :disabled="disabled"
      class="sm:text-[3.3cqw] text-[6.6cqw]  flex h-full w-full appearance-none items-center justify-center border-0 bg-[url(/images/submit-button.webp)] bg-contain bg-center bg-no-repeat pb-2 font-semibold uppercase leading-none tracking-wider text-amber-600 outline-none transition-[transform,filter] ease-out will-change-transform hover:scale-110 hover:brightness-110 active:scale-105 disabled:cursor-not-allowed disabled:hover:scale-100 disabled:hover:brightness-100 disabled:opacity-60 enabled:cursor-pointer "
      @click="$emit('click')"
    >
      {{ label }}
    </button>
  </div>
</template>

<script setup lang="ts">
// Le bouton en médaillon du bas de carte : « Valider » sur QuestionCard,
// « Ouvrir le coffre » / l'action suivante sur ResultCard — même
// illustration, même mécanique de hover, seuls le libellé et la taille de
// texte changent (`size`, le verdict tient un texte plus court).
//
// `anchor` distingue deux cadres différents : sur le cadre large (desktop
// partout, et ChestCard qui n'a pas de variante mobile), le bas du bouton
// coïncide avec le bas de l'image — 'image-bottom'. Sur QuestionCard/ResultCard
// en mobile, le cadre portrait laisse les rubans dépasser sous le bas réel du
// cadre : le bouton doit se caler sur ce bord-là, pas sur celui de l'image —
// 'card-bottom'.
withDefaults(defineProps<{
  label: string
  disabled?: boolean
  size?: 'lg' | 'sm'
  anchor?: 'image-bottom' | 'card-bottom'
}>(), {
  disabled: false,
  size: 'lg',
  anchor: 'image-bottom',
})

defineEmits<{ click: [] }>()
</script>
