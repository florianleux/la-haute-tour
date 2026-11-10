# Anti-triche

## Vecteurs couverts

- **Temps illimité sur une question** → timer arbitré par le serveur.
- **Recharger pour changer de question** → la réservation persiste, avec son échéance.
- **Perte de focus** (changement d'onglet, alt-tab, clic hors fenêtre) → la réponse est soumise en l'état, et le joueur est marqué.
- **Multi-comptes Discord** → whitelist manuelle en base (voir [`admin.md`](./admin.md)).
- **DevTools, manipulation du client** → couvert par la perte de focus, et sans effet sur l'arbitrage, qui est entièrement serveur.

## Vecteurs ignorés

- **Partage de questions entre joueurs** → sans objet, il n'y a pas de classement.
- **Scraping des questions via l'API** → sans objet.
- **Recherche en ligne pendant la question** → couvert par le timer et la perte de focus.

- **Clavier décalé de l'intoxication** : appliqué par l'écran, à la frappe. Contournable par les outils de développement, limite assumée. Voir [`champignon.md`](./champignon.md#lascension-intoxiquée).

## Timer

- **Le serveur arbitre.** La question est servie avec une échéance ; toute réponse arrivant après est traitée comme un timeout, à une marge de latence près, quoi qu'affiche le client.
- Le **compte à rebours visible** n'est qu'un rendu de cette échéance. Le trafiquer ne gagne rien.
- Durées par défaut : 60 s en ascension, 60 s en rattrapage. Ces valeurs, comme toutes les autres, viennent du jeu de règles (voir [`mecanique.md`](./mecanique.md#règles-chiffrées)).
- **Le timeout est une erreur ordinaire** : vie perdue, bonne réponse affichée, question versée au Pool Échecs.
- L'échéance ne dépend d'aucun signal du client : elle est fixée au moment où la question est réservée, c'est-à-dire sur une action explicite du joueur.
- **Une exception, la leçon de la question loot** (voir [`ecrans.md`](./ecrans.md#leçons-de-michel)) : le chrono est retenu tant que Michel parle, et son échéance fixée quand la leçon est datée. En échange, l'énoncé n'est pas servi pendant ce temps : retenir le chrono sur une question lisible offrirait un temps de recherche sans limite. La date ne se pose qu'une fois, et le chrono ne se relance donc pas.

## Perte de focus

- **Tolérance d'une seconde** : une perte de focus ramenée en moins d'une seconde est ignorée. Un alt-tab accidentel n'est pas de la triche.
- **La détection ne tourne que pendant qu'un timer tourne** — en ascension et en rattrapage. Jamais sur un écran de verdict, ni pendant l'attente : une attente de six heures sous surveillance n'aurait aucun sens.
- **Conséquence : la réponse est soumise en l'état.** Champ vide → réponse fausse et ses conséquences ordinaires. Bonne réponse déjà saisie → elle est validée. La sanction est de perdre la main sur la question, pas une vie retirée d'office.
- En rattrapage, où le joueur n'a plus de vie à perdre, la question est simplement comptée fausse et son compteur de réussites revient à zéro.
- **Le joueur est informé** : « Tu as quitté la page, ta réponse a été envoyée. » Un joueur honnête doit pouvoir comprendre ce qui s'est passé plutôt que de croire à un bug. La ligne s'affiche sur le verdict, sous sa saisie, comme l'avertissement d'une réponse vide — en ascension, en rattrapage, et sur la Chute si c'était sa dernière vie. Le serveur la porte avec le verdict (`focusLoss`) : elle tient au rechargement et part avec le verdict suivant. Une épreuve de boss n'a pas de flag, donc pas de ligne.
- **La perte de focus est enregistrée** : c'est elle qui porte la ligne du verdict et qui ferme la contestation. Personne ne la consulte, ni le joueur ni l'admin.
- **Pas de contestation** possible sur ce motif.

## Whitelist Discord

- Seuls les **Discord IDs whitelistés en base** peuvent s'inscrire.
- L'admin ajoute manuellement les Discord IDs autorisés, via `/admin` ou directement en base.
- Pas de whitelist → pas d'inscription possible.
- C'est ce qui rend le multi-comptes coûteux : il faut demander l'accès.
