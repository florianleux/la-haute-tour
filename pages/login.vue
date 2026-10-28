<template>
  <div class="flex w-full justify-center">
    <!-- Les nuages flous de l'ascension, sur toute la page : le gabarit centre
         le contenu, le décor passe dessous. -->
    <div class="absolute inset-0 bg-[url(/images/play-bg.webp)] bg-cover bg-center" />
    <div class="relative flex w-full max-w-2xl flex-col items-center">
      <!-- Bornée en hauteur aussi : sur une fenêtre basse, le bouton reste visible. -->
      <LoginTitle class="max-w-[72vh]" />
      <!-- Après la chute du titre : voir LoginTitle. -->
      <div class="mt-10 flex flex-col items-center motion-safe:animate-fade-in [--enter-delay:1.2s]">
        <!-- Le médaillon de « Valider », celui de la question. -->
        <BaseCardButton
          label="Connexion"
          anchor="inline"
          :loading="leaving"
          @click="signIn"
        />
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
definePageMeta({ public: true })

// Le médaillon est un bouton, pas un lien : la route serveur s'ouvre en
// navigation complète, le loader tient la place pendant le départ vers Discord.
const leaving = ref(false)
function signIn(): void {
  leaving.value = true
  navigateTo('/api/auth/discord', { external: true })
}

const { user } = await useCurrentUser()

// Le middleware protège l'autre sens ; ici on évite de proposer une connexion
// à quelqu'un qui en a déjà une.
watchEffect(() => {
  if (user.value) {
    navigateTo('/')
  }
})
</script>
