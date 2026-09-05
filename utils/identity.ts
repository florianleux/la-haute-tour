import type { MeResponse } from '~~/server/api/auth/me.get'

/**
 * Les droits d'admin d'une identité servie. Ils suivent le compte connecté et
 * non le joueur incarné : sous incarnation, le jeu voit un joueur ordinaire,
 * mais le bouclier et le sélecteur doivent rester — sans quoi l'incarnation
 * serait sans retour.
 *
 * Dit ici plutôt que dans chaque écran : la barre, le middleware et l'écran de
 * jeu posaient la même question, et trois copies auraient fini par diverger.
 * Voir specs/admin.md#incarnation.
 */
export function isRealAdmin(identity: MeResponse | null): boolean {
  return Boolean(identity?.impersonator?.isAdmin ?? identity?.user?.isAdmin)
}
