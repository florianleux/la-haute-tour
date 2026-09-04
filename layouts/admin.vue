<template>
  <main class="relative min-h-screen bg-slate-950 p-6 text-slate-100">
    <!-- Wider than the default layout: the admin screens are lists, not cards. -->
    <div class="mx-auto w-full max-w-3xl">
      <ProfileLink />
      <slot />
    </div>
  </main>
</template>
