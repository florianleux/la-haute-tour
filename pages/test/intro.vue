<template>
  <div />
</template>

<script setup lang="ts">
// Le banc de l'introduction, rangé avec les autres bancs : l'introduction est
// devenue une vraie page (/intro), rejouable à tout moment, et ce raccourci y
// renvoie. Admin seulement, comme les autres bancs. Le garde global passe
// avant ce middleware : un joueur ordinaire ne va pas plus loin que lui.
// La fin de l'introduction la marque faite pour le compte servi : rien de neuf
// pour un admin qui l'a déjà finie.
definePageMeta({ admin: true, middleware: () => navigateTo('/intro') })
</script>
