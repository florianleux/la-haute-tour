# Revue du budget Turso

*2 novembre 2026, #113.* Question posée : 25 joueurs font-ils dépasser le plan Turso en un mois ?

**Réponse : non.** Même au pire cas, le mois consomme moins de 10 % des lignes écrites et 3 % des lignes lues.

## Le plan

Relevé avec `turso plan show` le 2 novembre 2026.

| Ressource | Consommé | Quota mensuel |
|---|---|---|
| Lignes lues | < 0,1 M | 500 M |
| Lignes écrites | 0,1 M | 10 M |
| Stockage | 7,3 Mo | 5 Go |

Plan **starter**, dépassements désactivés : au-delà du quota, la base refuse, rien n'est facturé. Le compteur repart à zéro le 1er décembre 2026. Les 0,1 M écrites comprennent la remise à zéro du lancement (#103).

## Le coût d'une question

Mesuré avec `scripts/simulate-turso-load.ts`, qui fait jouer le vrai code du jeu sur une base montée avec les vraies migrations : 5 joueurs, 1 200 questions chacun, 97 % de bonnes réponses, sorts lancés à chaque attente.

```bash
pnpm tsx scripts/simulate-turso-load.ts --players=5 --days=30 --qpd=40 --spells
```

| Par question jouée | Lignes lues | Lignes écrites |
|---|---|---|
| Tout compris | 63 | 5,3 |

« Tout compris » : question suivante, réponse, et la part de ce qui revient de temps en temps (coffres, attentes, rattrapages, Grimoire, lancers, Volumen, ouverture de l'application). La question suivante et la réponse font 90 % du total.

## Projection sur un mois

25 joueurs, 30 jours.

| Scénario | Questions / mois | Lignes lues | Lignes écrites |
|---|---|---|---|
| Base : 50 q / jour | 37 500 | 2,4 M (0,5 %) | 0,2 M (2 %) |
| Pire cas : 250 q / jour | 187 500 | 11,8 M (2,4 %) | 1,0 M (10 %) |

Le pire cas est aussi un plafond absolu : 250 questions par jour pendant 30 jours font 7 500 questions, la tour entière. Un joueur ne peut pas jouer plus que la tour. Même si les 25 joueurs la finissaient tous dans le même mois, il resterait 90 % des écritures.

Stockage : la simulation ajoute moins de 1 Mo pour 6 000 questions jouées. Une tour finie par 25 joueurs reste sous 50 Mo, soit 1 % du quota.

## Ce que la mesure ne couvre pas

- **Le combat de boss** : le script s'arrête à la porte du premier boss. Six épreuves au plus par étage, contre 1 250 questions : c'est négligeable dans le total.
- **L'administration** : quelques gestes par jour, sans commune mesure avec le jeu.
- **Le compteur de Turso** : le script estime les lignes lues avec le plan de requête de SQLite. Turso compte de son côté. Le relevé de décembre dira de combien les deux s'écartent : avec une marge de ×40 sur les lectures et de ×10 sur les écritures, l'écart ne change pas la conclusion.

## À revoir si

- le nombre de joueurs passe vers 250 (les écritures du pire cas atteindraient le quota) ;
- une requête du chemin de la question change, auquel cas on relance le script et on compare les lignes par question.
