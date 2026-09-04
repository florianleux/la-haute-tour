<script setup lang="ts">
// The server guard (requireAdmin) is what protects the data; this flag only
// spares the player a screen the API would refuse to fill. See specs/admin.md.
definePageMeta({ admin: true, layout: 'admin' })
</script>

<template>
  <div>
    <h1 class="text-2xl font-bold">
      Administration
    </h1>

    <div class="mt-8">
      <AdminDisputes />
    </div>

    <div class="mt-12">
      <AdminFocusLosses />
    </div>

    <div class="mt-12">
      <AdminQuestions />
    </div>

    <div class="mt-12">
      <AdminWhitelist />
    </div>

    <BaseButton to="/" variant="ghost" class="mt-8">
      Retour à l'accueil
    </BaseButton>
  </div>
</template>
