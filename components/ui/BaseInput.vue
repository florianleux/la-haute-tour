<template>
  <BaseField :label="label">
    <template #default="{ classes }">
      <input
        ref="field"
        v-model="model"
        type="text"
        :placeholder="placeholder"
        :maxlength="maxlength"
        :class="classes"
      >
    </template>
  </BaseField>
</template>

<script setup lang="ts">
const props = defineProps<{
  label: string
  placeholder?: string
  /**
   * Le nombre de caractères que le champ laisse écrire. Posé sur le champ et
   * non vérifié après coup : mieux vaut que la frappe s'arrête que d'annoncer
   * une faute à qui ne pouvait pas la voir venir.
   */
  maxlength?: number
  /**
   * Le champ prend le clavier dès qu'il paraît. Posé ici et non par l'attribut
   * HTML `autofocus`, que les navigateurs n'honorent qu'au chargement de la page
   * et non sur un champ inséré après coup — or c'est exactement le cas qui
   * compte : chaque question monte un champ neuf.
   */
  autofocus?: boolean
}>()

const model = defineModel<string>({ required: true })
const field = useTemplateRef<HTMLInputElement>('field')

onMounted(() => {
  if (props.autofocus) {
    field.value?.focus()
  }
})
</script>
