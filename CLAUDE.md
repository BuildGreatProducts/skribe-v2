# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Skribe is an AI-powered strategic advisor that helps builders create comprehensive project context documents through guided, conversational workflows. Users connect GitHub, create projects, and chat with an AI advisor that creates markdown documents (PRDs, personas, market analysis, etc.) stored in `/Skribe/` folders in their repos.

## Development Commands

```bash
npm run dev          # Start Next.js development server (localhost:3000)
npm run build        # Production build
npm run lint         # Run ESLint
npm run format       # Run Prettier on src/**/*.{ts,tsx,js,jsx}
npx convex dev       # Start Convex development server (run in separate terminal)
npx convex deploy    # Deploy Convex to production
```

## Tech Stack

- **Frontend**: Next.js 16 (App Router), React 19, Tailwind CSS 4
- **Backend**: Convex (real-time database + serverless functions)
- **Auth**: Clerk (manages users, sessions, protected routes)
- **Payments**: Polar (subscriptions: Starter $12/mo, Pro $29/mo)
- **AI**: Claude API via `@anthropic-ai/sdk` (streaming responses with tool use)
- **Integration**: GitHub OAuth for repo access and document syncing

## Architecture

### Directory Structure
- `src/app/` - Next.js App Router pages and API routes
- `src/components/` - React components (ui/, billing/, chat/, github/, providers/)
- `src/lib/` - Utilities (encryption.ts, system-prompts.ts, utils.ts)
- `src/hooks/` - Custom React hooks
- `convex/` - Convex backend (schema, queries, mutations)

### Data Flow
1. **Auth**: Clerk middleware (`src/middleware.ts`) protects routes. Public routes: `/`, `/sign-in`, `/sign-up`, `/api/webhooks`, `/api/github/callback`, `/api/feedback`
2. **Database**: Convex schema defines 7 tables: `users`, `projects`, `documents`, `agents`, `messages`, `agentTemplates`, `feedback` (see `convex/schema.ts`)
3. **Chat API**: `/api/agent/route.ts` handles streaming Claude responses with document tool use (create_document, update_document)
4. **GitHub Sync**: Documents pushed to `/Skribe/` folder in connected repos via GitHub API
5. **Feedback API**: Public webhook endpoint (`/api/feedback/[apiKey]`) receives user feedback from external apps

### Key Patterns

**Convex Authentication Helper**: All Convex queries/mutations use `getAuthenticatedUser()` or `requireAuthenticatedUser()` to verify Clerk identity and look up the Convex user.

**Ownership Verification**: Resources are always ownership-checked through the user chain: user → project → documents/chats → messages

**Claude Tool Use**: The chat API provides tools for creating/updating documents. Claude streams responses and can call tools mid-conversation to create documents stored in Convex.

**System Prompts**: 11 guided starting points (idea_refinement, market_validation, customer_persona, brand_strategy, business_model, new_features, tech_stack, create_prd, go_to_market, landing_page, feedback_analysis) with specialized system prompts in `src/lib/system-prompts.ts`. Document and feedback context is injected via `buildSystemPrompt()`.

**Subscription Tiers**: Free trial (3 days), Starter (1 project), Pro (unlimited). Limits enforced in `convex/projects.ts` via `canCreateProject()`.

**Token Encryption**: GitHub tokens encrypted at rest using AES-256-GCM (`src/lib/encryption.ts`). Requires `ENCRYPTION_KEY` env var.

## Environment Variables

See `.env.example` for required variables:
- `NEXT_PUBLIC_CONVEX_URL`, `CONVEX_DEPLOY_KEY` - Convex
- `NEXT_PUBLIC_CLERK_*`, `CLERK_SECRET_KEY` - Clerk auth
- `GITHUB_CLIENT_ID`, `GITHUB_CLIENT_SECRET` - GitHub OAuth
- `POLAR_ACCESS_TOKEN`, `POLAR_WEBHOOK_SECRET` - Polar payments
- `ANTHROPIC_API_KEY` - Claude API
- `ENCRYPTION_KEY` - 32-byte hex string for token encryption

## Design System

- Fonts: Instrument Serif (headings), DM Sans (body)
- Logo: Instrument Serif italic with tight letter spacing (-0.03em)
- Colors: Light mode, black primary (#171717) for buttons, soft pastel accent palette
- Pastel palette: Rose (#FFD6E0), Lavender (#E0D6FF), Sky (#D6EFFF), Mint (#D6FFE4), Peach (#FFE5D6), Lemon (#FFF5D6)
- Style: Rounded corners (lg/xl), soft shadows, borderless sidebar navigation
