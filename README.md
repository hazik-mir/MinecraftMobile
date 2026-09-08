# Minecraft Mobile — Bedrock Community

Independent Minecraft Bedrock/mobile community portal with:

- Dark, dense directory UI
- Bedrock/Add-On/Resource Pack/Behavior Pack/World/Map/Skin/Shader/Server/Tutorial categories
- PvP tier explanations and real published player records
- YouTube creator/video integration using YouTube Data API v3
- Google Sign in with Google using Google Identity Services and server-side ID-token verification
- Optional community profile (name, YouTube, Discord)
- Google profile photo is used by the browser after sign-in and is not stored in the database
- Community submission endpoint for YouTube/project links, stored as pending
- Privacy and credits pages
- Render Node backend
- GitHub Pages static frontend deployment

## Production architecture

GitHub Pages frontend -> Render API -> PostgreSQL

The frontend is also served by the Node server on Render, so you can use one Render URL without GitHub Pages. If you use GitHub Pages, configure the Actions secrets below.

## Environment variables

Copy `.env.example` into your deployment configuration.

Required for Google authentication:

- `GOOGLE_CLIENT_ID`
- `SESSION_SECRET`

Required for persistent production accounts:

- `DATABASE_URL`

Required for real YouTube creator/video loading:

- `YOUTUBE_API_KEY`
- `YOUTUBE_CHANNEL_HANDLE` (defaults to `@HeyHazik`)

If `DATABASE_URL` is absent, local development uses `data/users.json`. Do not rely on that fallback for a production deployment with ephemeral storage.

## Google OAuth setup

Use Google Identity Services for a Web application OAuth client. Add your exact production origin/redirect configuration in Google Cloud. The frontend only needs the client ID; the server verifies the Google ID token using `GOOGLE_CLIENT_ID`.

For GitHub Pages, the browser origin is:

`https://hazik-mir.github.io`

The API should normally be the Render service URL, for example:

`https://your-service.onrender.com`

Set `FRONTEND_ORIGIN=https://hazik-mir.github.io` on Render when GitHub Pages is the frontend. The server then uses cross-site secure cookies for the account session.

## GitHub Pages setup

Repository secrets:

- `API_BASE_URL` = your Render backend URL
- `GOOGLE_CLIENT_ID` = your Google web client ID

The included workflow writes those public runtime values into `public/runtime-config.js` during deployment. No OAuth secret belongs in GitHub Pages.

## YouTube setup

Enable YouTube Data API v3 for your Google Cloud project and put the API key in Render as `YOUTUBE_API_KEY`.

The backend resolves `@HeyHazik`, reads the channel's uploads playlist, then loads the latest public videos. It does not copy or host the videos.

## Local development

```bash
npm install
npm start
```

Open `http://localhost:10000`.

For local Google sign-in, configure the Google OAuth client to allow your localhost origin and set the environment variables first.

## Real data

`data/projects.json` starts empty on purpose. `data/players.json` starts empty on purpose. No fake download counts, subscriber counts, players or projects are generated.

`data/creators.json` starts with the real configured community creator `@HeyHazik`.

Community submissions are stored in `data/submissions.json` only when the JSON fallback is used. In production, replace the moderation store with a database-backed moderation table before treating it as a high-scale platform.

## Important

Minecraft is a trademark of Mojang Studios / Microsoft. This is an independent community project and is not affiliated with Mojang Studios or Microsoft.
