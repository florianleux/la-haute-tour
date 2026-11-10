<template>
  <main class="relative min-h-screen bg-slate-950 p-4 pt-16 text-slate-100 sm:p-6">
    <!-- Wider than the default layout: the admin screens are lists, not cards. -->
    <div class="mx-auto w-full max-w-3xl">
      <ImpersonationCorner />
      <slot />
    </div>
  </main>
</template>
