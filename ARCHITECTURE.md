# NTK Creator Command — Architecture

## Overview
**NTK Creator Command** is a lightweight, local-first Next.js 15 (App Router, TypeScript) + SQLite (Prisma ORM) studio built for low-RAM Windows laptops (no Docker, no Redis, no local LLMs, no heavy in-app rendering).

## Core Layers
1. **Encrypted Key Vault & Multi-Key Auto-Failover Router (`src/lib/ai-router/`)**
   - AES-256-GCM encryption at rest using auto-generated `.ntk-vault-key` (never exposed to browser or git).
   - Unlimited keys across `GEMINI` (`gemini-3.5-flash-lite` -> `gemini-3.8-flash` -> `gemini-4-hydrogen`), `GROQ` (`openai/gpt-oss-120b` -> `openai/gpt-oss-20b` -> `qwen/qwen3.8-27b`, auto-chunked under 8,000 TPM), `OPENROUTER` (`openrouter/free`, `nvidia/nemotron-3.5-super-vl:free`, `nvidia/nemotron-3.5-lightning:free`, `google/gemma-4-26b-a4b:free`), `CUSTOM` (any OpenAI-compatible `baseUrl`), and `YOUTUBE` (Data API v3).
   - Automatic HTTP 429 / 5xx / 401-403 / 404 classification, per-key and per-model cooldowns, midnight reset windows, Priority Failover or Round-Robin rotation, and `FailoverLog` telemetry.
   - **Checkpointing (`GenerationJob`):** Every multi-step build persists each completed step to SQLite immediately; if all keys exhaust, jobs pause cleanly as `PAUSED_QUOTA` and export a Zero-Key Master Prompt for remaining steps only.

2. **Agent Pack Studios (`src/lib/packs/` & `/packs/*`)**
   - Google Flow AI Movie & Series Pack Builder (outline -> character & location profiles -> scene shots -> CPU-friendly `-c copy` / `h264_qsv` / `libx264 -preset veryfast` FFmpeg edit plan).
   - Google Flow Bulk Image & Style Cloner (vision style extraction -> single Nano Banana header + numbered `01..NN` scenes + narration).
   - Kaggle & Google Colab Free GPU Notebooks (valid nbformat 4 `.ipynb` packs).
   - Brand/Mascot & Ad Library Spy Packs + Universal Any-Platform Playbooks.
   - Publishing & OAuth Pack Generator (Mode A BrowserOS neo `FEAICCWS` draft flow; Mode B Python OAuth resumable uploader).

3. **Digital Product Studio & Analyzers (`src/lib/products/` & `/products/*`)**
   - Local HTML-to-PDF renderer (Playwright headless Chromium with `pdfkit` fallback) for Ebooks, 30/365-Day Hyperlinked Planners, and Journals/Workbooks.
   - Real multi-sheet `.xlsx` generator via `exceljs` with live Excel formulas (`=SUM`, `=SUMIF`, `=AVERAGE`) and Recharts previews.
   - Storefront Copy & Funnel Builder + Live Shopify `/products.json` & Product Replication Analyzer.

4. **Research & Coaching (`/research/*`, `/coach`, `/notebooklm`)**
   - Faceless Finder SQLite tracker (30 seeded starter channels, digital product link scanning, YouTube Data API v3 sync).
   - Trend Finder with Recharts momentum visualization & Google Trends YouTube Search deep links.
   - Persistent Viral Hook Coach (with YouTube handle availability buttons) & NotebookLM Channel Blueprint Wizard.

5. **Operational Folder Isolation**
   - `FILES/`, `WORKING/`, `HANDOFF_TO_GEMINI/`, `ARCHIVE/`, `DEPLOY_MANUAL/`, and `storage/` remain outside git history.
