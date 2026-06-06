# DMM Allstars Season 3 Hiscores

Unofficial Deadman Allstars Season 3 roster hiscores viewer.

## What it does

- Stores the known player roster in `data/players.json`.
- Looks up each account on the OSRS Tournament hiscores endpoint.
- Caches API responses through Cloudflare Pages Functions.
- Renders a searchable, sortable table with team filters and player cards.

## Local development

Install dependencies, then run:

```powershell
npm install
npm run dev
```

Cloudflare Pages will serve the static app and the `/api/players` function.

If you only want to preview the static UI without the API, any static file server will work, though live hiscores will show as unavailable.

## Deploy

The cheapest deployment path is Cloudflare Pages:

1. Push this folder to GitHub.
2. Create a Cloudflare Pages project from the repo.
3. Use no build command.
4. Set the output directory to `/`.
5. Deploy.

The API function lives in `functions/api/players.js`, so Cloudflare Pages will automatically expose it at `/api/players`.

## Data source

Hiscore data is fetched from:

```text
https://secure.runescape.com/m=hiscore_oldschool_tournament/index_lite.ws?player=ACCOUNT
```

This is an unofficial fan project and should not be treated as an official Jagex source.
