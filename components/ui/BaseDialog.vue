<template>
  <!-- Une boîte de dialogue sur tout l'écran : le fond est la boîte elle-même,
       son contenu posé dedans. Clic sur le fond = fermer. Fond, mise en page
       et animations viennent de l'appelant, par `class`. -->
  <dialog
    ref="dialog"
    tabindex="-1"
    class="fixed inset-0 m-0 h-full max-h-none w-full max-w-none border-0 p-0 text-inherit outline-none backdrop:bg-transparent open:flex"
    :aria-label="label"
    @click.self="$emit('close')"
  >
    <slot />
  </dialog>
</template>

<script setup lang="ts">
// La boîte native, ouverte en modale dès le montage. Le navigateur fait ce
// qu'on recopiait à la main dans chaque modale : il garde le focus dedans, rend
// le reste de la page inerte, et n'adresse Échap qu'à la plus haute — une boîte
// ouverte dans une autre ne ferme qu'elle. Voir BaseModal et le Volumen.
//
// Échap ne ferme pas la boîte de lui-même : il passe par `close`, et c'est
// l'appelant qui décide — démonter, changer de route, animer la sortie. Si le
// navigateur la ferme quand même (il ignore un Échap retenu trop souvent sans
// geste du joueur entre deux), `close` suit aussi.
defineProps<{
  /** Ce que lit une synthèse vocale en entrant dans la boîte. */
  label: string
}>()

const emit = defineEmits<{ close: [] }>()

const dialog = useTemplateRef<HTMLDialogElement>('dialog')

// L'élément lui-même, pour qui doit le lire de l'extérieur — le Volumen y
// attend la fin de ses animations de sortie.
defineExpose({ element: dialog })

function onCancel(event: Event): void {
  event.preventDefault()
  emit('close')
}

function onClose(): void {
  emit('close')
}

onMounted(() => {
  dialog.value?.addEventListener('cancel', onCancel)
  dialog.value?.addEventListener('close', onClose)
  dialog.value?.showModal()
  // Le focus sur la boîte elle-même, pas sur le premier bouton où showModal le
  // pose : ce bouton peut être hors écran pendant une animation d'entrée, et
  // s'allumerait sans que le joueur l'ait choisi. Tab entre ensuite dans le
  // contenu. D'où le `tabindex`, sans quoi la boîte n'est pas focusable.
  dialog.value?.focus({ preventScroll: true })
})

// Démontée sans être fermée, la boîte ne rendrait pas le focus : il tomberait
// sur la page. Fermée d'abord, le navigateur le rend à ce qui l'avait avant —
// la bannière du camp, le parchemin du camp. Sans redire `close` : c'est
// déjà le parent qui la démonte.
//
// Mais le navigateur rallume l'anneau de focus sur l'élément rendu, même à la
// souris : un cadre blanc sur le bouton qui avait ouvert la boîte. Pour un
// joueur à la souris, le focus rendu est donc retiré aussitôt, et confié à la
// boîte qui l'entoure s'il y en a une encore ouverte, pour ne pas sortir d'elle.
// Le clavier le garde : la boîte, ou ce qu'elle contient, porte alors
// `:focus-visible` — dès l'ouverture, qui hérite du clavier qui l'a demandée.
onBeforeUnmount(() => {
  const keyboard = dialog.value?.matches(':focus-visible, :has(:focus-visible)') ?? false
  dialog.value?.removeEventListener('close', onClose)
  dialog.value?.close()
  const restored = document.activeElement
  if (!keyboard && restored instanceof HTMLElement) {
    restored.blur()
    restored.closest<HTMLElement>('dialog[open]')?.focus({ preventScroll: true })
  }
})
</script>
