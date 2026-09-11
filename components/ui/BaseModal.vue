<template>
  <div
    class="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 p-6 backdrop-blur-sm"
    role="dialog"
    aria-modal="true"
    :aria-label="title"
    @click.self="$emit('close')"
  >
    <div class="w-full max-w-md rounded-2xl border border-slate-800 bg-slate-900 p-6 shadow-2xl">
      <div class="flex items-start justify-between gap-4">
        <h2 class="text-lg font-semibold">{{ title }}</h2>
        <button
          type="button"
          class="-m-2 cursor-pointer rounded-lg p-2 text-slate-400 hover:bg-slate-800 hover:text-slate-100"
          aria-label="Fermer"
          @click="$emit('close')"
        >
          <svg class="size-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
            <path d="M6 6l12 12M18 6L6 18" stroke-linecap="round" />
          </svg>
        </button>
      </div>
      <div class="mt-4">
        <slot />
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
// Pas de Teleport : la page n'a aucun conteneur qui rogne, et `fixed inset-0`
// suffit à couvrir l'écran depuis n'importe où — c'est déjà ce que fait
// ChestCard.vue. Un Teleport n'ajouterait qu'un point de montage à gérer.
defineProps<{ title: string }>()

const emit = defineEmits<{ close: [] }>()

// Échap ferme, comme partout : la modale est un détour, pas une étape.
function onKeydown(event: KeyboardEvent): void {
  if (event.key === 'Escape') {
    emit('close')
  }
}

onMounted(() => window.addEventListener('keydown', onKeydown))
onUnmounted(() => window.removeEventListener('keydown', onKeydown))
</script>
