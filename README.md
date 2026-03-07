# attestfor.me

A Linktree-style profile page for AT Protocol, but with proof.

Add links to your GitHub, Twitter, website, and other accounts. When someone visits your page, they can verify that you actually own those accounts, not just that you typed them in. No trust required, because it's already proven.

## Features

- **Identity Claims** - Verify ownership of social accounts by posting a cryptographic proof
- **DNS Verification** - Prove domain ownership via TXT records
- **PGP Keys** - Associate OpenPGP public keys with your identity
- **Key Retraction** - Permanently mark compromised keys as retracted
- **Real-time Verification** - Some claims are verified client-side using [@keytrace/runner](https://npmx.dev/package/@keytrace/runner)
- **Supports keytrace.dev lexicon** - Uses the same lexicon as [@keytrace/lexicon](https://npmx.dev/package/@keytrace/lexicon) so the services are 100% compatible.

## Supported Services

- GitHub (gists)
- Twitter/X
- Mastodon/ActivityPub
- Bluesky
- DNS domains
- OpenPGP keys

## Development

### Prerequisites

- Node.js 24+
- pnpm

### Dev Setup

```bash
pnpm install
cp .env.example .env
```

The app runs at `http://localhost:3000`. For OAuth to work, you need a publicly accessible URL (VS Code dev tunnels, ngrok, etc.).

**Before starting the dev server**, run the URL update script with your tunnel URL:

```bash
pnpm update-oauth-url https://your-tunnel.devtunnels.ms
pnpm dev
```

This updates both `.env` and `public/oauth/client-metadata.json` with your tunnel URL so OAuth redirects work correctly. Run this again whenever your tunnel URL changes.

### Scripts

| Command | Description |
|---------|-------------|
| `pnpm dev` | Start development server with hot reload |
| `pnpm build` | Build for production |
| `pnpm start` | Run production build |
| `pnpm test` | Run tests |
| `pnpm lint` | Lint code |
| `pnpm update-oauth-url <url>` | Update OAuth config for dev tunnels |

### Project Structure

```
├── server/           # Fastify backend
│   ├── routes/       # API endpoints (OAuth, repo proxy, DNS lookup)
│   ├── oauth.ts      # AT Protocol OAuth client
│   └── storage.ts    # Redis/in-memory session storage
├── src/
│   ├── components/   # React components
│   ├── lib/          # Utilities (verification, key parsing)
│   └── pages/        # Page components
├── types/            # TypeScript types (keytrace lexicons)
└── public/           # Static assets (OAuth client metadata)
```

## Deployment

### Quick Deploy

To deploy this to a server with all services included (redis, caddy, etc.), point your domain's DNS to your server. Then, on the server, run:

```bash
curl -fsSL https://raw.githubusercontent.com/AideTechBot/attestfor.me/main/scripts/deploy.sh | bash -s -- your-domain.com
```

### Manual Deploy

A manual deploy is a bit more complicated, there are many ways to do this. Figure it out.

### Update

This pulls the latest image and restarts everything:

```bash
cd ~/attestfor.me && docker compose pull && docker compose up -d
```

## Architecture

- **Frontend**: React 19 with React Router, TanStack Query, Tailwind CSS
- **Backend**: Fastify with AT Protocol OAuth
- **Verification**: Client-side using @keytrace/runner, with server proxy for CORS
- **Storage**: Redis in production, in-memory for development

## License

MIT
