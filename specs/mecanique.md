# Mécanique de jeu

## Ascension

- Progression **linéaire stricte** : le joueur doit voir toutes les questions de l'étage 1 avant de passer à l'étage 2, etc.
- Chaque étage a un **tirage** : la question suivante est tirée au hasard parmi celles que le joueur n'a pas encore vues dans l'étage. L'ordre est propre à chaque joueur et se décide question par question — il n'est pas calculé à l'avance.
- **3 vies par cycle**. Chaque mauvaise réponse consomme une vie.
- La **bonne réponse est affichée sur échec** (apprentissage immédiat).
- À la 3e erreur → **blocage**. Position sauvegardée.
- Session de jeu **illimitée** : le joueur continue tant qu'il a des vies. Pas de palier par session.
- **Timer 20s** par question en ascension. Timeout = erreur normale (vie perdue, bonne réponse affichée, question → Pool Échecs). Voir [`anti-triche.md`](./anti-triche.md).

### Multi-appareil

Le joueur peut jouer sur plusieurs appareils simultanément. Le serveur garde l'état en base. Les appareils se sync au prochain request. Pas de gestion de sessions.

## Cycle de blocage et rattrapage

1. 3 vies perdues → **blocage**.
2. **12h après la perte de la 3e vie** :
   - Pool Échecs de l'étage courant **< 5** → 3 vies restaurées, reprise immédiate.
   - Pool Échecs **≥ 5** → **rattrapage** : 5 questions **au hasard, distinctes** tirées du Pool Échecs de l'étage courant.
     - **≥ 1/5** bonnes réponses → 3 vies restaurées, reprise immédiate.
     - **0/5** bonnes réponses → **4h** de blocage supplémentaires → nouveau rattrapage. Réessai **illimité**.

### Feedback du rattrapage

- **Immédiat après chaque question** : le joueur sait tout de suite s'il a bon ou faux, voit la bonne réponse si faux, puis passe à la suivante. Cohérent avec l'ascension. Le résultat (≥1/5 ou 0/5) se construit au fil des questions.
- **Timer 60s** par question en rattrapage. Voir [`anti-triche.md`](./anti-triche.md).

## Pool Échecs

- **Par étage**, **persistant** (jamais reset entre jours).
- Toute question ratée (en ascension ou en rattrapage manqué) entre dans le Pool Échecs de son étage.
- Une question sort du Pool Échecs **uniquement** si elle est réussie en rattrapage.
- Le rattrapage tire **uniquement** du Pool Échecs de l'étage courant. Les Pools Échecs des étages précédents sont **abandonnés** quand le joueur monte.

## Fin d'étage

- Le joueur passe à l'étage suivant après avoir **vu** toutes les questions de l'étage courant.
- Le Pool Échecs peut être non-vide — les ratées non rattrapées sont abandonnées.

## Fin de partie

- Toutes les questions du deck **vues** en ascension (tous étages confondus) → message de félicitations.
- Pas de classement.
- Le Pool Échecs de l'étage 6 peut être non-vide.
