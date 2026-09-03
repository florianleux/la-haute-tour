<script setup lang="ts">
definePageMeta({ public: true })
</script>

<template>
  <BaseCard title="Accès refusé">
    <template #lead>
      Ton compte Discord n'est pas sur la liste des joueurs autorisés.
      Aucun compte n'a été créé. Demande un accès à l'administrateur.
    </template>
    <BaseButton to="/login" variant="ghost" block class="mt-8">
      Retour
    </BaseButton>
  </BaseCard>
</template>
