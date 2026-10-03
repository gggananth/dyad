# Dyad — human–AI creative collaboration study

Astro SSR app (AHA: Astro + HTMX + Alpine) for a 2×2 writing study: text vs image prompts, human vs AI collaborators, ratings, and LSA epiphany detection.

## What database is in use today?

**Not SQLite.** There is no SQL database in this repo.

Persistence is a **JSON file store**:

- File: [`data/dyad.json`](data/dyad.json)
- Code: [`src/lib/store.ts`](src/lib/store.ts)

On first request the file is loaded into **process memory**. Every write is serialized back to disk. Heartbeats stay in memory only.

That is enough for a single Node process on one machine. It does not scale: two server instances will overwrite each other, Cloudflare Workers cannot use the local filesystem, and labs search scans the whole object graph in RAM.

## How to scale: PlanetScale Postgres + Cloudflare Hyperdrive

Use **PlanetScale Postgres** as the source of truth (real PostgreSQL, not the older Vitess/MySQL API). From Cloudflare, connect through **Hyperdrive** so Workers get connection pooling and fewer TLS round-trips at the edge.

Do **not** use `@planetscale/database` for this path. That driver is for PlanetScale’s MySQL HTTP API. Hyperdrive talks **native Postgres**; use `pg` or `postgres.js`.

Two stages:

1. **Keep the current Node adapter** (`@astrojs/node`) and set `DATABASE_URL` to PlanetScale (port **6432** / PgBouncer for the app). Fastest win: one database, many Node instances.
2. **Deploy on Cloudflare Workers** (Astro Cloudflare adapter) with a Hyperdrive binding. Same Postgres, global pooling, Smart Placement next to the DB region.

Schema for this app lives in [`scripts/schema.sql`](scripts/schema.sql).

---

## 1. Create a PlanetScale Postgres database

1. Sign in at [app.planetscale.com](https://app.planetscale.com) and pick an organization.
2. **New database** → engine **Postgres** (not Vitess).
3. Name it (for example `dyad`).
4. Choose a **region close to where the app will run**.
   - Cloudflare Hyperdrive Smart Placement should match that region (examples: `aws:us-east-1`, `gcp:us-east4`).
   - The default PlanetScale region is often **AWS us-east-2**. Region is fixed at branch creation.
5. Create the database. You get a default branch, usually `main`.

CLI equivalent:

```bash
pscale org list
pscale database create dyad --engine postgres --region <REGION_SLUG>
```

List regions with `pscale region list`.

### Credentials (roles)

1. Open the database → **Connect**.
2. Create a **Default role** (or a dedicated app role; do not use the default role long-term if you can avoid it).
3. Save **host**, **username** (`{role}.{branch_id}`), **password** (`pscale_pw_…`), and **database name**. The password is shown once.

Username format must include the branch id. `pscale connect` is **not** supported for Postgres; use a real connection string.

### Ports

| Port | Use |
| --- | --- |
| **5432** | Direct Postgres. Migrations, `psql`, `pg_dump`, long sessions. |
| **6432** | PgBouncer. Application traffic and Hyperdrive. |

SSL is required: `sslmode=verify-full`.

Direct (`psql` / schema apply):

```bash
psql 'host=XXXX-useast1-1.horizon.psdb.cloud \
      port=5432 \
      user=postgres.XXXXXXXX \
      password=pscale_pw_XXXXXXXX \
      dbname=dyad \
      sslnegotiation=direct \
      sslmode=verify-full \
      sslrootcert=system'
```

URI form:

```text
postgresql://USER:PASSWORD@HOST:5432/dyad?sslmode=verify-full&sslrootcert=system&sslnegotiation=direct
```

App / Hyperdrive URI (pooled):

```text
postgresql://USER:PASSWORD@HOST:6432/dyad?sslmode=verify-full
```

### Apply the schema

```bash
psql "$DATABASE_URL_DIRECT" -f scripts/schema.sql
```

Use **5432** for this step. Session `SET`s and DDL do not belong on PgBouncer transaction pooling.

---

## 2. Cloudflare Hyperdrive (edge)

Install Wrangler and log in:

```bash
npm install -D wrangler
npx wrangler login
```

Create a Hyperdrive config from the **pooled** PlanetScale URL:

```bash
npx wrangler hyperdrive create dyad-postgres \
  --connection-string="postgres://USER:PASSWORD@HOST:6432/dyad?sslmode=verify-full"
```

Copy the printed **id** into Wrangler config.

Example [`wrangler.jsonc`](https://developers.cloudflare.com/hyperdrive/examples/connect-to-postgres/postgres-database-providers/planetscale-postgres/):

```jsonc
{
  "$schema": "./node_modules/wrangler/config-schema.json",
  "name": "dyad",
  "compatibility_date": "2026-09-30",
  "compatibility_flags": ["nodejs_compat"],
  "placement": {
    "region": "aws:us-east-1"
  },
  "hyperdrive": [
    {
      "binding": "HYPERDRIVE",
      "id": "<HYPERDRIVE_ID>"
    }
  ]
}
```

Set `placement.region` to the **same cloud + region family** as the PlanetScale cluster.

Local Wrangler can skip Hyperdrive and talk to Postgres directly:

```bash
export CLOUDFLARE_HYPERDRIVE_LOCAL_CONNECTION_STRING_HYPERDRIVE="postgres://USER:PASSWORD@HOST:6432/dyad?sslmode=verify-full"
```

(Binding name `HYPERDRIVE` → suffix `_HYPERDRIVE`.)

In a Worker / Astro Cloudflare adapter, connect with `pg` using `env.HYPERDRIVE.connectionString` (see [Hyperdrive + PlanetScale Postgres](https://developers.cloudflare.com/hyperdrive/examples/connect-to-postgres/postgres-database-providers/planetscale-postgres/)).

Official Cloudflare notes:

- [PlanetScale Postgres + Hyperdrive](https://developers.cloudflare.com/hyperdrive/examples/connect-to-postgres/postgres-database-providers/planetscale-postgres/)
- [Workers + PlanetScale](https://developers.cloudflare.com/workers/databases/third-party-integrations/planetscale/)
- [PlanetScale Postgres connections](https://planetscale.com/docs/postgres/connecting/quickstart)

---

## 3. Local Node server (current stack)

Until the store is switched off JSON, the app still uses `data/dyad.json`.

When the Postgres adapter is wired, put this in `.env` (never commit secrets):

```bash
DATABASE_URL=postgresql://USER:PASSWORD@HOST:6432/dyad?sslmode=verify-full
```

`.env.example` lists the key. Restart `astro dev` after changing env.

Keep a **direct** URL for migrations only:

```bash
DATABASE_URL_DIRECT=postgresql://USER:PASSWORD@HOST:5432/dyad?sslmode=verify-full&sslrootcert=system&sslnegotiation=direct
```

---

## 4. Application env (existing)

| Variable | Purpose |
| --- | --- |
| `GEMINI_API_KEY` | Grammar pass and AI collaborator |
| `GEMINI_MODEL` | Default `gemini-3.8-flash` |
| `LAB_ADMIN_PASSWORD` | Password for `/labs` |
| `WORD_LIMIT` | Solo/collab word cap (default 75) |

```bash
npm install
cp .env.example .env
# set LAB_ADMIN_PASSWORD and optionally GEMINI_API_KEY
npx astro dev --background
```

| Command | Action |
| --- | --- |
| `npm run dev` / `astro dev --background` | SSR at `http://127.0.0.1:4321` |
| `npm run build` | Production build (`@astrojs/node` standalone) |

`/labs` is the researcher dashboard. `/collaborate` is the anonymous peer board.

---

## 5. Code changes still needed (after the database exists)

`src/lib/store.ts` is the only persistence boundary. Replace filesystem load/persist with Postgres queries against `studies`, `sessions`, `drafts`, and `messages`. Keep the same function names (`createStudy`, `getSession`, `updateSession`, …) so pages and APIs stay unchanged.

Realtime pairing today uses in-process Maps and SSE. On Workers, use **Durable Objects** or a small pub/sub; Postgres remains the durable log.

JSON import: map existing `data/dyad.json` rows into `INSERT`s once, then retire the file for production.
