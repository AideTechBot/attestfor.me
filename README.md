# ATtestfor.me

Todo description

## Deploy

Point your domain's DNS to your server, then:

```bash
curl -fsSL https://raw.githubusercontent.com/AideTechBot/attestfor.me/main/scripts/deploy.sh | bash -s -- your-domain.com
```

This pulls the latest Docker image, sets up Caddy for automatic HTTPS, and starts everything. To update later:

```bash
cd ~/attestfor.me && docker compose pull && docker compose up -d
```

## Development

### Dependencies

We use pnpm and node 24.

### Notice

I know this uses a lot of Bluesky APIs. This is intentional, so I don't have to cache as much and stuff loads faster. If someone can show me how to not do that and use ATproto stuff where I don't have to cache images and use a lot of memory on the server-side, I would be forever grateful.