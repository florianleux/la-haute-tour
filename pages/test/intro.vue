<template>
  <div />
</template>

<script setup lang="ts">
// Le banc de l'introduction, rangé avec les autres bancs : l'introduction est
// devenue une vraie page (/intro), que seul un admin peut revoir une fois
// finie, et ce raccourci y renvoie. Admin seulement, comme les autres bancs. Le
// garde global passe avant ce middleware : un joueur ordinaire ne va pas plus
// loin que lui. La fin d'une introduction déjà finie ne change rien : ni date
// réécrite, ni second Fromage.
definePageMeta({ admin: true, middleware: () => navigateTo('/intro') })
</script>
