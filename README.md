# IA-RoutingEngine

This repository contains the IA-RoutingEngine used by the PITZBOL website. It
provides an AI-based routing engine (implemented with Ollama models) and a
Next.js frontend (`pitzbol-web`) that generates itineraries for tourists in
Guadalajara, México.

## Getting Started

First, run the development server in the `pitzbol-web` folder:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open http://localhost:3000 with your browser to see the result. You can start
editing the page by modifying `app/page.tsx`. The page auto-updates as you edit
the file.

## How this repo is organized

- `Modelfile`  Ollama model configuration and system prompt used to create the
  `mundial-ai` model on the VPS.
- `src/`  frontend source code for the Next.js app.

## Learn More

To learn more about Next.js, see the official docs: https://nextjs.org/docs

## Deploy

You can deploy the Next.js app on Vercel or any Node-capable host. See
https://nextjs.org/docs/app/building-your-application/deploying for details.

---

_This file was auto-merged to resolve a conflict between local changes and the
remote template._
