import { count, eq, min } from 'drizzle-orm'
import { readPhase } from './game'
import {
  castLogQuery,
  castSpell,
  castsLeftThisWait,
  receivedLogQuery,
  toCastViews,
  toReceivedViews,
} from './effects'
import { rulesForFloor } from './rules'
import { inventory } from '../db/schema'
import type { Database } from '../db/client'
import type { User } from '../db/schema'
import type { CastView, ReceivedView } from './effects'
import type { SpellId } from '../../shared/utils/spells'
import type { CastableTargetKind } from '../../shared/utils/teams'

export interface InventoryEntryView {
  spell: SpellId
  /** Le nombre d'exemplaires possédés : les doublons sont illimités. */
  count: number
}

export interface InventoryView {
  entries: InventoryEntryView[]
  /** Le nombre d'exemplaires, toutes lignes confondues. */
  total: number
  /** Le journal du lanceur : ce qu'il a envoyé, sur qui, et quand. */
  log: CastView[]
  /**
   * L'autre journal : ce que les autres lui ont envoyé. Nominatif lui aussi —
   * c'est là, et sur l'écran d'attente, qu'un joueur apprend que le système
   * existe. Voir specs/bonus.md#ce-que-voit-la-cible-et-ce-que-voit-le-lanceur.
   */
  received: ReceivedView[]
  /**
   * Le joueur peut-il viser un allié ? Faux tant qu'il n'a pas d'équipe : la
   * catégorie ne désignerait aucun pool, et l'écran ne la propose donc pas.
   * Voir specs/equipes.md#le-joueur-sans-équipe.
   */
  canTargetAllies: boolean
  /**
   * Ce qu'il reste de lancers pour l'attente en cours. L'écran l'affiche et
   * éteint ses boutons à zéro : la règle se voit avant le clic, elle ne se
   * découvre pas après. Voir specs/bonus.md#où-et-quand.
   */
  castsLeft: number
  /** Ce qu'une attente permet de lancers, pour que l'écran dise la règle. */
  castsPerCooldown: number
}

/**
 * L'inventaire du joueur, un empilement par sort. Groupé plutôt que rendu ligne
 * à ligne : un exemplaire ne se distingue d'un autre par rien, et c'est le
 * nombre qui se lit. Trié par premier exemplaire obtenu, pour qu'un coffre qui
 * ajoute un doublon ne déplace pas la liste sous les yeux du joueur.
 *
 * Refusé hors attente : le lancer n'existe que là, donc la page qui montre
 * l'inventaire n'est pas atteignable ailleurs — URL comprise, d'où le refus ici
 * et pas seulement dans la navigation.
 * Voir specs/bonus.md#sorts et specs/ecrans.md#sorts.
 */
export async function readInventory(db: Database, user: User, now: Date): Promise<InventoryView> {
  await requireCooldown(db, user, now)

  return readSpellPage(db, user)
}

/**
 * Lancer un sort sur une catégorie de cible, puis rendre la page telle qu'elle
 * est maintenant : l'exemplaire en moins, le journal en plus — et le nom de la
 * cible avec lui, car c'est au retour du lancer que le joueur apprend qui il a
 * touché. Un lancer au-delà du budget ne fait rien et rend le même état :
 * l'appel est en retard, pas en faute. Voir specs/bonus.md#où-et-quand.
 */
export async function castFromInventory(
  db: Database,
  user: User,
  spell: SpellId,
  kind: CastableTargetKind,
  now: Date,
): Promise<InventoryView> {
  await requireCooldown(db, user, now)
  await castSpell(db, user, spell, kind, now)

  return readSpellPage(db, user)
}

/**
 * Les Sorts n'existent que pendant l'attente : ni la page qui les montre, ni le
 * lancer qui les consomme n'ont de sens ailleurs — URL comprise, d'où le refus
 * ici et pas seulement dans la navigation. Voir specs/ecrans.md#sorts.
 *
 * La phase se lit par `readPhase`, et non par l'état complet : une garde ne doit
 * pas faire avancer la partie qu'elle protège, et il n'y a qu'un fait à lire.
 */
async function requireCooldown(db: Database, user: User, now: Date): Promise<void> {
  const phase = await readPhase(db, user, now)

  if (phase !== 'cooldown') {
    throw createError({ statusCode: 403, statusMessage: 'Les Sorts ne se lancent qu\'en attente' })
  }
}

/**
 * L'inventaire groupé et les deux journaux : ce que la page Sorts montre, après
 * une lecture comme après un lancer.
 *
 * Les trois listes partent dans le même lot. Elles ne dépendent pas les unes des
 * autres, et la base est distante : servies l'une après l'autre, elles
 * coûteraient trois allers-retours là où l'écran n'en demande qu'un.
 * Voir tests/server/query-budget.test.ts.
 */
async function readSpellPage(db: Database, user: User): Promise<InventoryView> {
  const [stacks, log, received] = await db.batch([
    db
      .select({
        spell: inventory.spell,
        owned: count(),
      })
      .from(inventory)
      .where(eq(inventory.userId, user.id))
      .groupBy(inventory.spell)
      .orderBy(min(inventory.obtainedAt)),
    castLogQuery(db, user.id),
    receivedLogQuery(db, user.id),
  ])

  return {
    entries: stacks.map(({ spell, owned }) => ({ spell, count: owned })),
    total: stacks.reduce((sum, stack) => sum + stack.owned, 0),
    log: toCastViews(log),
    received: toReceivedViews(received),
    castsLeft: await castsLeftThisWait(db, user),
    castsPerCooldown: rulesForFloor(user.currentFloor).castsPerCooldown,
    canTargetAllies: user.team !== null,
  }
}
