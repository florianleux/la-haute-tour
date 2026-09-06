<template>
  <!-- Les deux faces ensemble, même quand une seule est atteignable : c'est ce
       qui fait comprendre au joueur que le catalogue a un envers, avant que les
       équipes ne le lui mettent entre les mains.
       Voir specs/bonus.md#catégories-de-cible. -->
  <dl class="text-[13px] leading-snug text-slate-500">
    <div class="flex gap-1.5">
      <dt class="shrink-0 text-slate-400">Blanche</dt>
      <dd>{{ effects.boon }}</dd>
    </div>
    <div class="flex gap-1.5">
      <dt class="shrink-0 text-slate-400">Noire</dt>
      <dd>{{ effects.curse }}</dd>
    </div>
  </dl>
</template>

<script setup lang="ts">
// Ce qu'un sort fait, face par face — une légende, pas un paragraphe : le joueur
// vient lancer, pas lire. Écrit une fois : l'inventaire le montre aujourd'hui, et
// la magie noire aura le même besoin.
import type { SpellId } from '~~/shared/utils/spells'

const props = defineProps<{ spell: SpellId }>()

const effects = computed(() => spellEffects(props.spell))
</script>
