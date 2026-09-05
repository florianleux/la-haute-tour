<script setup lang="ts">
// Une URL inconnue ne montre pas d'erreur : elle ramène au jeu, qui est la page
// d'accueil. La redirection est portée par la route elle-même, donc elle
// s'applique avant tout middleware — un visiteur non connecté part vers `/`,
// qui l'enverra à la connexion comme n'importe quelle page fermée.
// Voir specs/ecrans.md#inventaire.
definePageMeta({ redirect: '/' })
</script>

<template>
  <div />
</template>
