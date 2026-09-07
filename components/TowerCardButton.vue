<template>
  <!-- À cheval sur le bord bas du cadre. Le positionnement (translate de calage)
       vit sur ce conteneur ; le hover (scale) vit sur le bouton lui-même, pour
       ne pas composer les deux transforms — sinon le texte dérive légèrement
       de son repère au survol. -->
  <div
    class="absolute bottom-0 left-1/2 z-20 w-[32%] -translate-x-1/2 translate-y-1/2"
    style="aspect-ratio: 634 / 175;"
  >
    <button
      type="button"
      :disabled="disabled"
      class="flex h-full w-full appearance-none items-center justify-center border-0 bg-[url(/images/submit-button.webp)] bg-contain bg-center bg-no-repeat pb-2 font-semibold uppercase leading-none tracking-wider text-amber-600 outline-none transition-[transform,filter] ease-out will-change-transform hover:scale-110 hover:brightness-110 active:scale-105 disabled:cursor-not-allowed disabled:hover:scale-100 disabled:hover:brightness-100 disabled:opacity-60 enabled:cursor-pointer"
      :class="size === 'sm' ? 'text-[2.6cqw]' : 'text-[3.3cqw]'"
      @click="$emit('click')"
    >
      {{ label }}
    </button>
  </div>
</template>

<script setup lang="ts">
// Le bouton en médaillon du bas de carte : « Valider » sur TowerQuestionCard,
// « Ouvrir le coffre » / l'action suivante sur TowerResultCard — même
// illustration, même mécanique de hover, seuls le libellé et la taille de
// texte changent (`size`, le verdict tient un texte plus court).
withDefaults(defineProps<{
  label: string
  disabled?: boolean
  size?: 'lg' | 'sm'
}>(), {
  disabled: false,
  size: 'lg',
})

defineEmits<{ click: [] }>()
</script>
