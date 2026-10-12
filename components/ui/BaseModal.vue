<template>
  <BaseDialog
    :label="title"
    class="items-center justify-center bg-slate-950/80 p-6 text-slate-100 backdrop-blur-sm"
    @close="$emit('close')"
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
  </BaseDialog>
</template>

<script setup lang="ts">
// Une carte posée sur un fond sombre. Échap ferme, comme partout : la modale
// est un détour, pas une étape. Focus, inertie du reste de la page et Échap
// viennent de BaseDialog.
defineProps<{ title: string }>()

defineEmits<{ close: [] }>()
</script>
