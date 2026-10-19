#!/usr/bin/env bash
# Builds and deploys the website to https://clearflow.ohmyai.app (Cloudflare Workers, static assets + custom domain).
# Needs a Cloudflare login with access to the ohmyai.app zone: `npx wrangler@4.129.0 login` once (or CLOUDFLARE_API_TOKEN).
# Behind a proxy, set HTTPS_PROXY; wrangler uses it.
set -euo pipefail
cd "$(dirname "$0")"
node build.mjs
npx -y wrangler@4.129.0 deploy "$@"
