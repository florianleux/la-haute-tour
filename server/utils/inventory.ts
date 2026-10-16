import { count, eq, min } from 'drizzle-orm'
import { requireCamp } from './camp'
import {
  castLogQuery,
  castSpell,
  receivedLogQuery,
  toCastViews,
  toReceivedViews,
} from './effects'
import { candidatesQuery, targetableKinds } from './targets'
import { activeEffects, inventory } from '../db/schema'
import { SPELL_IDS } from '../../shared/utils/spells'
import type { Database } from '../db/client'
import type { User } from '../db/schema'
import type { CastView, ReceivedView } from './effects'
import type { SpellId } from '../../shared/utils/spells'
import type { TargetKind } from '../../shared/utils/teams'

export interface InventoryEntryView {
  spell: SpellId
  /** Le nombre d'exemplaires possédés : les doublons sont illimités. */
  count: number
}

export interface InventoryView {
  entries: InventoryEntryView[]
  /**
   * Les sorts obtenus au moins une fois, dans l'ordre du catalogue : encore en
   * poche, ou déjà lancés. Le pentacle montre leur médaillon, même sans
   * exemplaire ; les autres y gardent un point d'interrogation.
   * Voir specs/ecrans.md#sorts.
   */
  discovered: SpellId[]
  /** Le journal du lanceur : ce qu'il a envoyé, sur qui, et quand. */
  log: CastView[]
  /**
   * L'autre journal : ce que les autres lui ont envoyé. Nominatif lui aussi —
   * c'est là, et sur l'écran d'attente, qu'un joueur apprend que le système
   * existe. Voir specs/bonus.md#ce-que-voit-la-cible-et-ce-que-voit-le-lanceur.
   */
  received: ReceivedView[]
  /**
   * Le joueur peut-il viser quelqu'un d'autre — allié ou ennemi ? Faux tant
   * qu'il n'a pas d'équipe : les deux catégories ne désigneraient aucun pool, et
   * l'écran ne les propose donc pas. Un seul drapeau pour les deux, parce que
   * c'est la même absence qui les ferme.
   * Voir specs/equipes.md#le-joueur-sans-équipe.
   */
  canTargetOthers: boolean
  /**
   * Le joueur peut-il encore se lancer un sort ? Faux quand il porte déjà son
   * plafond d'effets positifs : l'écran éteint « Sur moi », et le refus se voit
   * avant le clic plutôt qu'un exemplaire dépensé pour rien.
   * Voir specs/bonus.md#limite-deffets-positifs.
   */
  canTargetSelf: boolean
  /**
   * Reste-t-il un allié, un ennemi à toucher ? Faux quand le pool éligible de la
   * catégorie est vide — tous en fin de partie, jamais partis ou saturés :
   * l'écran éteint le bouton plutôt que de laisser dépenser un exemplaire pour
   * rien. Jamais qui, ni pourquoi les autres sont écartés.
   * Voir specs/bonus.md#tirage-de-la-cible.
   */
  canTargetAlly: boolean
  canTargetFoe: boolean
}

/**
 * L'inventaire du joueur, un empilement par sort. Groupé plutôt que rendu ligne
 * à ligne : un exemplaire ne se distingue d'un autre par rien, et c'est le
 * nombre qui se lit. Trié par premier exemplaire obtenu, pour qu'un coffre qui
 * ajoute un doublon ne déplace pas la liste sous les yeux du joueur.
 *
 * Refusé hors du camp : le lancer n'existe que là, et l'inventaire ne se montre
 * qu'au camp. Refusé ici, pas seulement à l'écran : l'API se demande sans
 * passer par lui.
 * Voir specs/bonus.md#sorts et specs/ecrans.md#sorts.
 */
export async function readInventory(db: Database, user: User, now: Date): Promise<InventoryView> {
  await requireCamp(db, user, now)

  return readSpellPage(db, user, now)
}

/**
 * Lancer un sort sur une catégorie de cible, puis rendre la page telle qu'elle
 * est maintenant : l'exemplaire en moins, le journal en plus — et le nom de la
 * cible avec lui, car c'est au retour du lancer que le joueur apprend qui il a
 * touché. Un lancer refusé — plus d'exemplaire, ou sur soi au plafond
 * d'effets positifs — ne fait rien et rend le même état : l'appel est en
 * retard, pas en faute. Voir specs/bonus.md#où-et-quand.
 */
export async function castFromInventory(
  db: Database,
  user: User,
  spell: SpellId,
  kind: TargetKind,
  now: Date,
): Promise<InventoryView> {
  await requireCamp(db, user, now)
  await castSpell(db, user, spell, kind, now)

  return readSpellPage(db, user, now)
}

/**
 * L'inventaire groupé, les sorts découverts et les deux journaux : ce que le
 * Grimoire montre, après une lecture comme après un lancer.
 *
 * Un sort lancé quitte l'inventaire : ce que le joueur a découvert se lit donc
 * aussi dans ses lancers.
 *
 * Les quatre listes et les cibles possibles partent dans le même lot. Elles ne
 * dépendent pas les unes des autres, et la base est distante : servies l'une
 * après l'autre, elles coûteraient cinq allers-retours là où elles n'en
 * demandent qu'un. Ce que chacun porte d'effets — le joueur, ses alliés, ses
 * ennemis — se lit ensuite, en un second : il passe par le même filtre que le
 * tirage, qui ne se met pas en lot.
 * Voir tests/server/query-budget.test.ts.
 */
async function readSpellPage(db: Database, user: User, now: Date): Promise<InventoryView> {
  const [stacks, castSpells, log, received, candidates] = await db.batch([
    db
      .select({
        spell: inventory.spell,
        owned: count(),
      })
      .from(inventory)
      .where(eq(inventory.userId, user.id))
      .groupBy(inventory.spell)
      .orderBy(min(inventory.obtainedAt)),
    db
      .selectDistinct({ spell: activeEffects.spell })
      .from(activeEffects)
      .where(eq(activeEffects.casterId, user.id)),
    castLogQuery(db, user.id),
    receivedLogQuery(db, user.id),
    candidatesQuery(db, user),
  ])

  const targetable = await targetableKinds(db, user, candidates, now)
  const discoveredSpells = new Set([...stacks, ...castSpells].map(({ spell }) => spell))

  return {
    entries: stacks.map(({ spell, owned }) => ({ spell, count: owned })),
    discovered: SPELL_IDS.filter(spell => discoveredSpells.has(spell)),
    log: toCastViews(log),
    received: toReceivedViews(received),
    canTargetSelf: targetable.self,
    canTargetOthers: user.team !== null,
    canTargetAlly: targetable.ally,
    canTargetFoe: targetable.foe,
  }
}
