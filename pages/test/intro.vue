<template>
  <DialogueScene :dialogue="INTRO" />
</template>

<script setup lang="ts">
// Brouillon de l'introduction de l'aventure : la scène que le joueur verra au
// tout début, jouée ici et nulle part ailleurs tant que son texte n'est pas
// écrit. Rien ne la déclenche dans le jeu — c'est une page de réglage, admin
// seulement, comme pages/test/dialogue.vue.
//
// Le joueur s'appelle « ??? » de bout en bout : l'affiche d'un dialogue est
// déclarée une fois pour toutes (voir ADR 0010), et le faire passer à son vrai
// nom en cours de scène demandera d'en enchaîner deux — le jour où l'on saura à
// quelle réplique il se nomme.
import type { Dialogue } from '~~/utils/dialogue'

definePageMeta({ admin: true })

/**
 * Des répliques bouche-trou : elles tiennent la place et le rythme, pas le
 * propos. Elles alternent les deux places et couvrent les longueurs qui comptent
 * — une courte, une qui remplit la boîte — pour que le cadrage se règle sur le
 * texte que l'intro aura vraiment.
 */
const INTRO: Dialogue = {
  // Le décor flou de l'attente en attendant le sien, cf. components/PlayFrame.vue.
  background: '/images/blurry-cooldown-bg.webp',
  left: { name: '???', portrait: '/images/intro-player.webp' },
  right: { name: 'L\'Inconnu', portrait: '/images/intro-unknown.webp' },
  lines: [
    { place: 'right', text: 'Te voilà devant la porte.' },
    { place: 'left', text: 'Qui es-tu ?' },
    {
      place: 'right',
      text: 'Personne d\'important. Ce qui compte est au-dessus de nous : six étages, '
        + 'et rien qui redescende. Tu monteras, ou tu attendras.',
    },
    { place: 'left', text: 'Et si je tombe ?' },
    { place: 'right', text: 'Alors tu attendras. Puis tu remonteras.' },
  ],
}

// Rien sur `end` : il n'y a pas d'écran suivant à qui rendre la main, la dernière
// réplique reste affichée. Recharger la page rejoue la scène.
</script>
