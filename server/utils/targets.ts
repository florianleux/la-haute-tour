import { and, asc, eq, isNull, ne } from 'drizzle-orm'
import { deckFloors, reservations, users } from '../db/schema'
import { drawByRank, hasStarted, phaseOf } from './mechanics'
import { bondBetween } from '../../shared/utils/teams'
import type { Database } from '../db/client'
import type { User } from '../db/schema'
import type { DrawnTargetKind } from '../../shared/utils/teams'

/**
 * Qui le sort touche, faute d'avoir été choisi. Le lanceur désigne une catégorie
 * et le serveur tire dedans : aléatoire, mais pondéré, et jamais annoncé avant
 * le lancer. Voir specs/bonus.md#tirage-de-la-cible.
 *
 * Personne, quand le pool éligible est vide : le sort part quand même et ne fait
 * rien, comme une Purge sur un Pool Échecs vide.
 *
 * Le hasard vient de l'appelant, comme pour le coffre — c'est ce qui rend le
 * tirage jouable dans un test sans dé.
 */
export async function drawTarget(
  db: Database,
  caster: User,
  kind: DrawnTargetKind,
  now: Date,
  random: () => number = Math.random,
): Promise<User | null> {
  // Sans équipe, le lanceur ne désigne aucun pool : ni allié ni ennemi n'existe
  // pour lui. Voir specs/equipes.md#le-joueur-sans-équipe.
  if (caster.team === null) {
    return null
  }

  const rows = await db
    .select({
      user: users,
      // Ce que l'étage du candidat contient, pour savoir s'il a fini sa partie.
      // Lu au deck en une ligne jointe, comme les fiches de l'administration.
      floorTotal: deckFloors.total,
      // La question qu'il tient peut-être. Jointe plutôt que comptée : un joueur
      // n'a jamais qu'une réservation, et elle porte son identifiant en clé —
      // la jointure lit donc une ligne, là où un `count(*)` en parcourrait.
      heldQuestion: reservations.questionId,
    })
    .from(users)
    .leftJoin(deckFloors, eq(deckFloors.floor, users.currentFloor))
    .leftJoin(reservations, and(
      eq(reservations.userId, users.id),
      isNull(reservations.resolvedAt),
    ))
    // Le pool se réduit en base à la seule équipe concernée, et au seul monde du
    // lanceur : la facture est aux lignes lues, et lire la table entière pour la
    // filtrer ensuite en mémoire les paierait toutes.
    .where(and(
      ne(users.id, caster.id),
      kind === 'ally' ? eq(users.team, caster.team) : ne(users.team, caster.team),
      eq(users.isTest, caster.isTest),
    ))
    // Le classement de progression, croissant : étage, puis questions vues à
    // l'étage, puis ancienneté du compte pour que l'ordre soit total et stable.
    // Il ne sort jamais du serveur — il pondère, il ne se montre pas.
    // Voir specs/ecrans.md#ce-quaucun-écran-joueur-ne-montre.
    .orderBy(asc(users.currentFloor), asc(users.floorSeen), asc(users.createdAt), asc(users.id))

  const eligible = rows
    // La relation se lit d'un seul endroit, jamais réécrite ici : c'est elle qui
    // scelle les deux mondes autant qu'elle dit la couleur.
    .filter(row => bondBetween(caster, row.user) === kind)
    .filter(row => isEligible(row, now))
    .map(row => row.user)

  return drawByRank(eligible, kind, random)
}

type Candidate = { user: User, floorTotal: number | null, heldQuestion: string | null }

/**
 * Un joueur que le tirage garde. Sont écartés ceux qui ont fini leur partie —
 * ils n'auront jamais de prochaine tentative, l'effet serait mort-né — et ceux
 * qui n'ont jamais commencé.
 *
 * Le filtre passe **avant** le classement : un joueur retiré du pool ne pèse
 * plus dans la distribution. Voir specs/bonus.md#tirage-de-la-cible.
 */
function isEligible({ user, floorTotal, heldQuestion }: Candidate, now: Date): boolean {
  const hasLiveReservation = heldQuestion !== null

  const phase = phaseOf({
    user,
    hasLiveReservation,
    seen: user.floorSeen,
    floorTotal: floorTotal ?? 0,
  }, now)

  return phase !== 'gameOver' && hasStarted(user, hasLiveReservation)
}
