# La Haute Tour

[▶ Jouer (sur invitation) / Play (invite only)](https://lahautetour.florianleux.fr) · [Page du projet / Project page](https://florianleux.fr/dev/la-haute-tour)

![La Haute Tour – écran titre](https://florianleux.fr/la-haute-tour/haute-tour-titre.webp)

## 🇫🇷 En français

Un jeu de culture générale en forme de RPG, à plusieurs.

Tu gravis une tour de 6 étages en répondant à plus de 6 000 questions. En chemin : des coffres, des sorts, un inventaire et des combats de boss.

Chaque joueur rejoint l'une des deux guildes rivales. Tu peux lancer des sorts sur tes alliés comme sur tes ennemis, et il faut s'unir à sa guilde pour ouvrir les portes des boss.

J'ai imaginé, conçu, illustré et développé le jeu seul. L'accès se fait sur invitation, via Discord.

## 🇬🇧 In English

A multiplayer trivia game shaped like an RPG.

You climb a 6-floor tower by answering more than 6,000 questions. Along the way: chests, spells, an inventory and boss fights.

Each player joins one of two rival guilds. You can cast spells on allies and enemies alike, and you need your whole guild to open the boss doors.

I came up with, designed, illustrated and built the game on my own. Access is invite-only, through Discord.

## Stack

Nuxt 3 · Vue 3 · TypeScript · Drizzle ORM · SQLite / Turso · Discord OAuth · Vitest · Netlify

## Lancer en local / Run locally

```bash
pnpm install
cp .env.example .env    # remplir les valeurs / fill in the values
pnpm db:migrate
pnpm dev
```

<details>
<summary>Documentation technique (FR) / Technical docs (FR)</summary>

Specs dans [`specs/`](specs/spec.md), conventions dans [`CLAUDE.md`](CLAUDE.md).
Le code est en anglais, les specs en français : la correspondance entre les deux est le glossaire de [`specs/spec.md`](specs/spec.md), colonne « Nom en code ».

### Variables d'environnement

| Variable | Rôle |
|----------|------|
| `DATABASE_URL` | Base locale, `file:./local.db` en dev. |
| `TURSO_DATABASE_URL` / `TURSO_AUTH_TOKEN` | Base Turso en prod (env vars Netlify). `DATABASE_URL` prend le pas quand il est défini, pour qu'un poste de dev qui porte les deux reste sur sa base locale. |
| `NUXT_SESSION_PASSWORD` | Secret de scellement du cookie de session, ≥ 32 caractères. Génère-le (`openssl rand -hex 32`) : le serveur refuse de démarrer sur la valeur d'exemple. |
| `NUXT_DISCORD_CLIENT_ID` / `NUXT_DISCORD_CLIENT_SECRET` | App Discord OAuth2. |
| `NUXT_DISCORD_REDIRECT_URI` | Doit correspondre exactement au redirect configuré côté Discord. |

Le serveur refuse de démarrer si l'une d'elles manque.

### App Discord

Sur le [Discord Developer Portal](https://discord.com/developers/applications) : créer une application, onglet OAuth2, ajouter le redirect `http://localhost:3000/api/auth/discord/callback` (et l'URL Netlify en prod).

### Whitelist

Seuls les Discord IDs présents dans la table `whitelist` peuvent s'inscrire. Tant qu'il n'y a pas d'UI admin, on insère à la main :

```sh
sqlite3 local.db "INSERT INTO whitelist (discord_id) VALUES ('123456789');"
sqlite3 local.db "UPDATE users SET is_admin = 1 WHERE discord_id = '123456789';"
```

### Scripts

| Commande | Effet |
|----------|-------|
| `pnpm dev` | Serveur de dev. |
| `pnpm typecheck` | `nuxt typecheck`. |
| `pnpm lint` | ESLint. |
| `pnpm test` | Vitest. |
| `pnpm db:generate` | Génère une migration depuis `server/db/schema.ts`. |
| `pnpm db:migrate` | Applique les migrations (local ou Turso selon l'env). |

</details>
