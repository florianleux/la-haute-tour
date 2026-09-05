# La Haute Tour

Jeu web de culture générale, accès sur invitation Discord.
Specs dans [`specs/`](specs/spec.md), conventions dans [`CLAUDE.md`](CLAUDE.md).

## Démarrer en local

```sh
pnpm install
cp .env.example .env      # puis remplir les valeurs (voir ci-dessous)
pnpm db:migrate           # applique les migrations sur ./local.db
pnpm dev
```

### Variables d'environnement

| Variable | Rôle |
|----------|------|
| `DATABASE_URL` | Base locale, `file:./local.db` en dev. |
| `TURSO_DATABASE_URL` / `TURSO_AUTH_TOKEN` | Base Turso en prod (env vars Netlify). `DATABASE_URL` prend le pas quand il est défini, pour qu'un poste de dev qui porte les deux reste sur sa base locale. |
| `NUXT_SESSION_PASSWORD` | Secret de scellement du cookie de session, ≥ 32 caractères. Génère-le (`openssl rand -hex 32`) : le serveur refuse de démarrer sur la valeur d'exemple. |
| `NUXT_DISCORD_CLIENT_ID` / `NUXT_DISCORD_CLIENT_SECRET` | App Discord OAuth2. |
| `NUXT_DISCORD_REDIRECT_URI` | Doit correspondre exactement au redirect configuré côté Discord. |

Le serveur refuse de démarrer si l'une d'elles manque.

Le code est en anglais, les specs en français : la correspondance entre les deux
est le glossaire de [`specs/spec.md`](specs/spec.md), colonne « Nom en code ».

### App Discord

Sur le [Discord Developer Portal](https://discord.com/developers/applications) :
créer une application, onglet OAuth2, ajouter le redirect
`http://localhost:3000/api/auth/discord/callback` (et l'URL Netlify en prod).

## Whitelist

Seuls les Discord IDs présents dans la table `whitelist` peuvent s'inscrire.
Tant qu'il n'y a pas d'UI admin, on insère à la main :

```sh
sqlite3 local.db "INSERT INTO whitelist (discord_id) VALUES ('123456789');"
```

Pour se donner les droits admin :

```sh
sqlite3 local.db "UPDATE users SET is_admin = 1 WHERE discord_id = '123456789';"
```

## Scripts

| Commande | Effet |
|----------|-------|
| `pnpm dev` | Serveur de dev. |
| `pnpm typecheck` | `nuxt typecheck`. |
| `pnpm lint` | ESLint. |
| `pnpm test` | Vitest. |
| `pnpm db:generate` | Génère une migration depuis `server/db/schema.ts`. |
| `pnpm db:migrate` | Applique les migrations (local ou Turso selon l'env). |
