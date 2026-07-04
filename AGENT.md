# Agent Instructions

## Documentation First

Before making any functional, design, or architecture change, read:

- `docs/feishu-content-migration.md`

If the change affects content sourcing, routing, data models, build behavior, deployment, or project architecture, update the relevant documentation in the same change. Do not leave the docs stale after code changes.

## Current Migration Direction

This project is migrating from Notion as the remote build-time content source to Feishu Knowledge Base plus Feishu Docs, with Feishu Bitable as the metadata registry. Keep implementation work aligned with the documented migration plan unless the user approves a revised plan first.

The Feishu Bitable content registry must live inside the user's `编程` knowledge base so the user can see and manage it. Do not create future production registry tables in the app-owned cloud-space root.

## Working Rules

- Keep changes surgical and trace each changed line to the requested task.
- Prefer a stable content-source abstraction over spreading Feishu API calls through Astro pages.
- Keep secrets in `.env`; do not commit real credentials.
- When adding or changing environment variables, update documentation and `.env.example` if the variable is meant for future setup.
- Run verification before claiming completion. For this project, prefer `pnpm run type:check` and `pnpm run build` when implementation changes touch source code.
