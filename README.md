# PDFForge

PDFForge is a focused PDF workspace: **Everything you need to work with PDFs**. It has an original toolkit experience with registry-driven navigation and a safe, temporary-file processing API.

## Architecture

This npm-workspaces monorepo contains a Vite/React 18 TypeScript client, an Express/Node 20 TypeScript server, and a dependency-light `shared/` TypeScript module consumed by both. PDF processing uses `pdf-lib`, with Ghostscript as the preferred compression engine and a pdf-lib fallback.

## Install and run

```bash
npm install
cp .env.example .env
npm run dev
```

The client runs at http://localhost:5173 and the API at http://localhost:5000. Production output is built with `npm run build`.

## System requirements

The phase-1 server uses Ghostscript, qpdf, and Poppler utilities when available. Install them on Ubuntu with:

```bash
sudo apt-get update && sudo apt-get install -y ghostscript qpdf poppler-utils
sudo apt-get install -y libreoffice --no-install-recommends
```

Ghostscript enables strong PDF compression; qpdf enables future security flows; Poppler enables future rasterization and page inspection. LibreOffice enables future office conversion and is optional: conversion degrades honestly when unavailable. Chrome at `/home/ubuntu/.local/bin/google-chrome` can enable future HTML conversion.

## Capability matrix

Implemented in phase 1: PDF compression (Ghostscript/pdf-lib fallback), merge, split (ranges/every page/extract plus ZIP), rotate, page info, registry-driven UI, temporary downloads, and honest capability reporting.

Stubbed for later phases: image, office, OCR, AI, security, repair, editing, conversion, and authentication integrations. Stub modules expose typed interfaces and return `ENGINE_UNAVAILABLE` rather than pretending to process files.

## Environment

See `.env.example` for server ports, upload limits, temporary storage, rate limits, engine paths, AI/OCR settings, OAuth, and JWT configuration. Never place real secrets in source control.

## Privacy

Uploads and generated results live in per-job temporary workspaces and are automatically deleted by the TTL sweeper. Download links expire with those workspaces; dashboard history is local browser history, not cloud storage. No encryption claim is made by this application.

## Design tokens

All visual decisions live in `client/tailwind.config.js` and `client/src/styles/theme.css`: semantic surfaces, text, borders, accent colors, radii, shadows, spacing, and typography. Components use semantic token classes so a future Figma skin can be applied centrally.