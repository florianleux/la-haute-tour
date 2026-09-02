# Anti-triche

## Vecteurs couverts

- **Perte de focus** (changement d'onglet, alt-tab, clic hors fenêtre) → vie consommée + marquée triche.
- **Timer** — 30s en ascension, 60s en rattrapage. Timeout = erreur normale (vie perdue, bonne réponse affichée).
- **Multi-comptes Discord** → whitelist manuelle en base (voir [`admin.md`](./admin.md)).
- **DevTools / manipulation client** → couvert par perte de focus (ouverture de DevTools fait perdre le focus).

## Vecteurs ignorés

- **Partage de questions entre joueurs** → on s'en fiche, pas de classement.
- **Scraping des questions via API** → on s'en fiche.
- **Google/Wiki pendant la question** → couvert par timer + perte de focus.

## Timer

- **Ascension : 20s** par question.
- **Rattrapage : 60s** par question.
- **Timeout = erreur normale** : à l'expiration, la question est comptée comme mauvaise réponse → vie perdue, bonne réponse affichée, question → Pool Échecs.
- **Timer visible** : le joueur voit le compte à rebours.

## Perte de focus

- **Tolérance 1s** : la perte de focus n'est comptée que si elle dure > 1s. Un alt-tab accidentel ramené en < 1s n'est pas triche.
- **Conséquence** : vie perdue + marquée triche dans le profil joueur (visible admin seulement).
- **Avertissement invisible** : le joueur ne sait pas qu'il a perdu le focus — la vie est perdue silencieusement, il découvre en voyant son compteur de vies.
- **Pas de contestation** : la triche n'est pas contestable. Une vie perdue pour triche est perdue. L'admin voit les flags pour repérer les tricheurs systémiques.

## Profil admin

- Les vies perdues pour triche sont **marquées** dans le profil du joueur.
- **Visible par l'admin seulement** — le joueur ne voit pas son propre compteur de triche.
- Permet à l'admin de repérer les tricheurs systémiques (ex. 10 pertes de focus en 5 questions).

## Whitelist Discord

- Seuls les **Discord IDs whitelistés en base** peuvent s'inscrire.
- L'admin ajoute manuellement les Discord IDs autorisés (via `/admin` ou directement en base).
- Pas de whitelist → pas d'inscription possible.
- Évite le multi-comptes (le joueur doit te demander l'accès).
