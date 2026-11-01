<template>
  <button
    ref="trigger"
    type="button"
    class="rounded-md px-2 py-1 text-lg leading-none text-slate-400 transition-colors hover:bg-slate-800 hover:text-slate-100 disabled:cursor-not-allowed disabled:opacity-50"
    :aria-label="label"
    :aria-busy="loading"
    :disabled="loading"
    @click="open"
  >
    <BaseSpinner v-if="loading" class="justify-center" />
    <span v-else aria-hidden="true">⋯</span>
  </button>

  <!-- `popover="auto"` : un clic dehors ou Échap le referme, sans écouteur à
       nous. Il passe dans la couche du dessus, donc aucun `overflow` du tableau
       ne le rogne ; sa place se calcule à l'ouverture, sous le bouton. -->
  <div
    ref="menu"
    popover="auto"
    role="menu"
    class="m-0 min-w-48 rounded-lg border border-slate-700 bg-slate-900 py-1 text-sm shadow-xl"
    :style="position"
  >
    <template v-for="(item, index) in items" :key="item.id">
      <hr v-if="item.separated && index > 0" class="my-1 border-slate-700">
      <button
        type="button"
        role="menuitem"
        class="block w-full px-3 py-1.5 text-left transition-colors hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-transparent"
        :class="item.danger ? 'text-red-400' : 'text-slate-200'"
        :disabled="item.disabled"
        @click="choose(item.id)"
      >
        {{ item.label }}
      </button>
    </template>
  </div>
</template>

<script setup lang="ts" generic="Id extends string">
export interface MenuItem<Id extends string = string> {
  id: Id
  label: string
  disabled?: boolean
  /** Geste qui efface : en rouge. */
  danger?: boolean
  /** Un trait le sépare de l'entrée du dessus. */
  separated?: boolean
}

defineProps<{
  items: MenuItem<Id>[]
  /** Ce que le bouton « ⋯ » annonce aux lecteurs d'écran. */
  label: string
  /** Un geste lancé depuis ce menu est en vol : le bouton montre un loader. */
  loading?: boolean
}>()

const emit = defineEmits<{ select: [Id] }>()

const trigger = useTemplateRef<HTMLButtonElement>('trigger')
const menu = useTemplateRef<HTMLDivElement>('menu')
const position = ref<Record<string, string>>({})

function open(): void {
  const box = trigger.value?.getBoundingClientRect()
  if (!box) {
    return
  }
  // Aligné sur le bord droit du bouton : le menu vit en fin de ligne.
  position.value = { position: 'fixed', top: `${box.bottom + 4}px`, right: `${window.innerWidth - box.right}px`, left: 'auto', bottom: 'auto' }
  menu.value?.showPopover()
}

function choose(id: Id): void {
  menu.value?.hidePopover()
  emit('select', id)
}
</script>
