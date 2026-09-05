<template>
  <div class="flex items-center gap-2">
    <BaseSelect
      v-model="selected"
      :options="options"
      :disabled="pending"
      aria-label="Jouer en tant que"
      title="Jouer en tant que"
      :class="impersonator
        ? 'border-amber-600 bg-amber-950/60 text-amber-200'
        : 'border-slate-800 bg-slate-900 text-slate-400'"
    />

    <BaseHint v-if="failed" tone="danger">
      Bascule refusée.
    </BaseHint>
  </div>
</template>

<script setup lang="ts">
// Qui joue : l'admin lui-même, ou l'un des joueurs test. Visible du seul admin,
// sur toutes les pages, et teinté pendant l'incarnation — on ne doit jamais se
// demander de qui on regarde la partie. Voir specs/admin.md#incarnation.
import type { SessionUser } from '~~/server/api/auth/me.get'

const props = defineProps<{
  /** L'identité que le jeu sert : un joueur test, ou l'admin lui-même. */
  actingAs: SessionUser | null
  /** Le compte connecté quand il en incarne un autre, null sinon. */
  impersonator: SessionUser | null
  testPlayers: SessionUser[]
}>()

const { actAs, pending, failed } = useImpersonation()

// La valeur d'un `<select>` est une chaîne ; « moi » n'est pas un identifiant.
const SELF = 'self'

const options = computed(() => [
  { value: SELF, label: props.impersonator?.username ?? props.actingAs?.username ?? 'Moi' },
  ...props.testPlayers.map(testPlayer => ({ value: String(testPlayer.id), label: testPlayer.username })),
])

// La sélection suit ce que le serveur sert : la bascule recharge la page, donc
// le champ n'a jamais à retenir un choix que la session n'aurait pas pris.
const selected = computed<string>({
  get: () => (props.impersonator ? String(props.actingAs?.id) : SELF),
  set: (value: string) => {
    actAs(value === SELF ? null : Number(value))
  },
})
</script>
