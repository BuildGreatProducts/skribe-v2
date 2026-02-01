# Skribe MVP - Project Plan

> AI-powered strategic advisor that helps builders create comprehensive project context documents through guided, conversational workflows.

---

## Tech Stack

| Layer | Technology | Purpose |
|-------|------------|---------|
| Frontend | Next.js + React + Tailwind | UI framework with App Router |
| Backend | Convex | Real-time database, serverless functions |
| Auth | Clerk | User authentication, session management |
| Payments | Polar | Subscription billing, customer portal |
| AI | Claude API + Agents SDK | Conversational AI, document generation |
| Integration | GitHub API | OAuth, repo access, commit/push |
| Hosting | Vercel | Frontend deployment |

---

## Design System

| Element | Specification |
|---------|---------------|
| Heading Font | IBM Plex Serif |
| Body Font | Helvetica |
| Border Radius | Rounded corners (lg/xl) |
| Shadows | Soft shadows |
| Color Mode | Light mode |
| Primary Accent | Dark green |
| Secondary Accent | Lime green |

---

## Phase 1: Foundation

**Goal:** User can sign up, connect GitHub, and see a list of their repos

### 1.1 Project Setup

- [ ] Initialize Next.js project with App Router
- [ ] Configure Tailwind CSS with custom design tokens
- [ ] Set up IBM Plex Serif and Helvetica fonts
- [ ] Create base color palette (light mode, dark green, lime green accents)
- [ ] Configure ESLint and Prettier
- [ ] Set up folder structure (`/app`, `/components`, `/lib`, `/hooks`)
- [ ] Create reusable UI components (Button, Card, Input, Modal)
- [ ] Implement global styles with soft shadows and rounded corners

### 1.2 Convex Setup

- [ ] Install and initialize Convex
- [ ] Configure Convex environment variables
- [ ] Create initial schema file structure
- [ ] Set up Convex client provider in Next.js
- [ ] Test basic Convex connection

### 1.3 Clerk Authentication

- [ ] Install Clerk SDK
- [ ] Configure Clerk environment variables
- [ ] Create Clerk provider wrapper
- [ ] Implement sign-up page
- [ ] Implement sign-in page
- [ ] Create protected route middleware
- [ ] Add user profile dropdown component
- [ ] Handle auth error states gracefully

### 1.4 Database Schema - Users & Projects

- [ ] Define `users` table schema (clerkId, email, githubConnected, subscriptionTier, trialEndsAt)
- [ ] Define `projects` table schema (userId, name, description, githubRepoId, githubRepoName)
- [ ] Create user sync function (Clerk webhook → Convex)
- [ ] Implement user creation on first sign-in
- [ ] Add indexes for efficient queries

### 1.5 GitHub OAuth Integration

- [ ] Register GitHub OAuth App
- [ ] Implement GitHub OAuth flow endpoint
- [ ] Store GitHub access tokens securely in Convex
- [ ] Create "Connect GitHub" button component
- [ ] Implement token refresh logic
- [ ] Fetch user's GitHub repositories list
- [ ] Display repositories in selectable list
- [ ] Implement "Disconnect GitHub" functionality
- [ ] Handle OAuth errors (auth failure, scope denial)
- [ ] Add loading and error states for GitHub operations

### 1.6 Landing Page

- [ ] Create marketing landing page layout
- [ ] Add hero section with value proposition
- [ ] Add features section highlighting 9 starting points
- [ ] Add pricing section (Starter $12/mo, Pro $29/mo)
- [ ] Add CTA buttons to sign up
- [ ] Implement responsive design

---

## Phase 2: Project & Chat Core

**Goal:** User can create a project, start a chat, and have a conversation with the AI advisor that has access to all project documents

### 2.1 Project Creation

- [ ] Create "New Project" modal/page
- [ ] Implement project name and description form
- [ ] Add GitHub repo selector (existing repos)
- [ ] Add "Create new empty repo" option via GitHub API
- [ ] Save project to Convex database
- [ ] Redirect to project dashboard after creation
- [ ] Add project validation (name required, repo selection)

### 2.2 Project Dashboard Layout

- [ ] Create project dashboard page structure
- [ ] Add project header (name, description, GitHub repo link)
- [ ] Create sidebar navigation
- [ ] Add documents section placeholder
- [ ] Add starting points grid placeholder
- [ ] Add recent chats section placeholder
- [ ] Implement responsive layout

### 2.3 Database Schema - Chats & Messages

- [ ] Define `chats` table schema (projectId, type, title, systemPrompt, createdAt, updatedAt)
- [ ] Define `messages` table schema (chatId, role, content, createdAt)
- [ ] Add indexes for chat queries (by project, by date)
- [ ] Create helper functions for chat operations

### 2.4 Chat Interface UI

- [ ] Create chat page layout
- [ ] Implement message list component with auto-scroll
- [ ] Create message bubble components (user/assistant styling)
- [ ] Build chat input with send button
- [ ] Add typing indicator for AI responses
- [ ] Implement chat header with title and back navigation
- [ ] Add loading states for message submission
- [ ] Style with design system (rounded corners, soft shadows)

### 2.5 Claude API Integration

- [ ] Set up Claude API client
- [ ] Create Convex action for Claude API calls
- [ ] Implement streaming response handling
- [ ] Create base system prompt for Skribe advisor persona
- [ ] Handle API errors gracefully
- [ ] Add rate limiting considerations

### 2.6 Document Context Injection

- [ ] Create function to fetch all project documents
- [ ] Format documents for Claude context
- [ ] Inject document context into system prompt
- [ ] Test context availability in conversations
- [ ] Handle large context gracefully (chunking if needed)

### 2.7 Chat Message Flow

- [ ] Implement message creation mutation
- [ ] Create streaming message update logic
- [ ] Save completed AI responses to database
- [ ] Implement chat history loading
- [ ] Add optimistic updates for sent messages
- [ ] Handle failed message sends with retry option

---

## Phase 3: Guided Starting Points

**Goal:** User can select any starting point and receive specialized guidance

### 3.1 Starting Point System Prompts

- [ ] Create system prompt for "Product Refinement"
- [ ] Create system prompt for "Market Validation"
- [ ] Create system prompt for "Brand Strategy"
- [ ] Create system prompt for "Customer Persona"
- [ ] Create system prompt for "Business Model"
- [ ] Create system prompt for "New Features"
- [ ] Create system prompt for "Tech Stack"
- [ ] Create system prompt for "Create PRD"
- [ ] Create system prompt for "Go to Market Strategy"
- [ ] Store prompts in configuration file

### 3.2 Starting Points UI

- [ ] Create starting points grid component
- [ ] Design individual starting point cards with icons
- [ ] Add visual indicator for suggested order (new projects)
- [ ] Implement starting point selection handler
- [ ] Add hover/active states for cards
- [ ] Show completion status for each starting point (optional)

### 3.3 Guided Chat Creation

- [ ] Create function to initialize guided chat with correct system prompt
- [ ] Pre-populate chat title based on starting point
- [ ] Navigate to chat interface after selection
- [ ] Support multiple guided chats in progress simultaneously
- [ ] Display chat type indicator in chat list

### 3.4 Custom Chat Creation

- [ ] Add "Create Custom Chat" button to dashboard
- [ ] Create custom chat modal with system prompt input
- [ ] Save custom system prompt to chat record
- [ ] Allow editing custom system prompt
- [ ] Persist custom prompt across sessions
- [ ] Ensure document context injection works for custom chats

---

## Phase 4: Document Management

**Goal:** User can create documents via chat, view them in dashboard, edit, download as markdown, and see warnings for long documents

### 4.1 Database Schema - Documents

- [ ] Define `documents` table schema (projectId, title, content, type, createdAt, updatedAt, syncStatus)
- [ ] Add indexes for document queries
- [ ] Create document helper functions (create, update, delete)

### 4.2 Document Creation via Chat

- [ ] Add document creation tool for Claude
- [ ] Implement document preview rendering in chat
- [ ] Create "Save Document" action from chat
- [ ] Allow AI to suggest document titles
- [ ] Parse markdown content properly
- [ ] Handle document creation confirmation

### 4.3 Document Editing via Chat

- [ ] Enable AI to reference existing documents
- [ ] Implement document update tool for Claude
- [ ] Show diff/changes in chat when editing
- [ ] Save document revisions
- [ ] Allow natural language edit requests

### 4.4 Document Dashboard Display

- [ ] Create documents list/grid view component
- [ ] Display document title, type, and last modified
- [ ] Add document type icons/badges
- [ ] Implement sorting (by date, by name, by type)
- [ ] Add empty state for no documents
- [ ] Show sync status indicator per document

### 4.5 Document Viewer & Editor

- [ ] Create document view page
- [ ] Implement markdown renderer
- [ ] Add manual edit mode with textarea/editor
- [ ] Save manual edits to database
- [ ] Add "Back to Dashboard" navigation
- [ ] Show last modified timestamp

### 4.6 Document Download

- [ ] Add "Download as Markdown" button
- [ ] Implement file download with proper filename
- [ ] Set correct MIME type for .md files

### 4.7 Document Deletion

- [ ] Add delete button to document view
- [ ] Implement confirmation modal
- [ ] Delete document from database
- [ ] Update dashboard after deletion
- [ ] Handle deletion errors

### 4.8 Context Length Warning

- [ ] Calculate document token count
- [ ] Define warning threshold (approaching Claude limits)
- [ ] Display warning banner in document editor
- [ ] Show warning in chat when creating long documents
- [ ] Provide guidance on document optimization

---

## Phase 5: GitHub Sync

**Goal:** User can push documents to their connected GitHub repo and see sync status

### 5.1 GitHub API Integration - Push

- [ ] Implement GitHub API client for repo operations
- [ ] Create function to push single file to repo
- [ ] Handle `/Skribe/` folder creation if not exists
- [ ] Generate meaningful commit messages
- [ ] Handle push errors gracefully

### 5.2 Single Document Push

- [ ] Add "Push to GitHub" button on document view
- [ ] Implement push action for individual document
- [ ] Update document sync status after push
- [ ] Show success/error feedback
- [ ] Handle authentication errors

### 5.3 Bulk Document Push

- [ ] Add "Push All to GitHub" button on dashboard
- [ ] Implement batch push for all documents
- [ ] Create single commit for all changes
- [ ] Show progress indicator during push
- [ ] Update all document sync statuses

### 5.4 Sync Status Tracking

- [ ] Define sync status enum (synced, pending, error)
- [ ] Track last pushed content hash
- [ ] Compare with current content for pending detection
- [ ] Display sync status icons in document list
- [ ] Add "Pending changes" summary on dashboard

### 5.5 Error Handling & Conflicts

- [ ] Detect push conflicts (remote changes)
- [ ] Display clear error messages
- [ ] Provide resolution guidance
- [ ] Implement retry mechanism
- [ ] Log sync errors for debugging

---

## Phase 6: Payments & Launch Prep

**Goal:** Full payment flow works, limits enforced, downgrade flow handles multiple projects gracefully, ready for public launch

### 6.1 Polar Integration Setup

- [ ] Create Polar account and configure products
- [ ] Set up Starter tier ($12/mo) product
- [ ] Set up Pro tier ($29/mo) product
- [ ] Configure webhook endpoint in Convex
- [ ] Store Polar API keys securely
- [ ] Test webhook delivery

### 6.2 Subscription Database Schema

- [ ] Add subscription fields to users table
- [ ] Track subscription status (trial, active, cancelled)
- [ ] Store subscription tier (starter, pro)
- [ ] Record trial end date
- [ ] Track subscription period end date

### 6.3 Free Trial Implementation

- [ ] Set 3-day trial on new user creation
- [ ] Grant full access during trial
- [ ] Calculate and display trial countdown
- [ ] Show trial status in UI header
- [ ] Create trial expiration check
- [ ] Block features after trial expires

### 6.4 Subscription Purchase Flow

- [ ] Create pricing/upgrade page
- [ ] Add "Subscribe" buttons for each tier
- [ ] Redirect to Polar checkout
- [ ] Handle successful payment webhook
- [ ] Update user subscription status
- [ ] Show confirmation and redirect to app

### 6.5 Subscription Management

- [ ] Add billing section to settings
- [ ] Display current subscription status
- [ ] Link to Polar customer portal
- [ ] Handle subscription cancellation webhook
- [ ] Handle subscription renewal webhook
- [ ] Update UI based on subscription state

### 6.6 Starter Tier Limits - Projects

- [ ] Implement project count check for Starter users
- [ ] Block project creation when at limit (1 project)
- [ ] Display upgrade CTA when blocked
- [ ] Show project limit in UI
- [ ] Allow Pro users unlimited projects

### 6.7 Starter Tier Limits - Chat History

- [ ] Define chat history cap for Starter tier
- [ ] Implement chat history truncation/archival
- [ ] Display upgrade prompt when approaching limit
- [ ] Show "Upgrade for full history" CTA
- [ ] Allow Pro users unlimited history

### 6.8 Upgrade Prompts

- [ ] Create upgrade prompt component
- [ ] Show prompts at limit boundaries
- [ ] Add upgrade CTA to relevant UI locations
- [ ] Track upgrade prompt impressions (optional)
- [ ] A/B test prompt messaging (optional)

### 6.9 Downgrade Flow - Project Selection

- [ ] Detect Pro → Starter downgrade initiation
- [ ] Check if user has multiple projects
- [ ] Create project selection modal
- [ ] Display list of projects with selection
- [ ] Show clear warning about project deletion
- [ ] Require explicit deletion confirmation
- [ ] Block downgrade until selection complete
- [ ] Delete non-selected projects after confirmation
- [ ] Update subscription tier

### 6.10 Launch Checklist

- [ ] Security audit (tokens, auth, data isolation)
- [ ] Performance testing
- [ ] Error monitoring setup (Sentry or similar)
- [ ] Analytics integration
- [ ] SEO meta tags and social cards
- [ ] Terms of service and privacy policy pages
- [ ] 404 and error pages
- [ ] Mobile responsiveness final check
- [ ] Cross-browser testing (Chrome, Firefox, Safari, Edge)
- [ ] Load testing for expected traffic
- [ ] Backup and recovery procedures
- [ ] Documentation for support team

---

## User Story Completion Tracking

### US-1: Account Creation & GitHub Connection
- [ ] User can sign up via Clerk authentication
- [ ] User can connect GitHub account via OAuth
- [ ] User can view list of their GitHub repositories
- [ ] User can disconnect GitHub and reconnect a different account
- [ ] Error states handled gracefully (auth failure, scope denial)

### US-2: Project Creation
- [ ] User can create a new project with a name and description
- [ ] User can select an existing GitHub repo or create a new empty repo
- [ ] Documents are stored in `/Skribe/` folder in the repository
- [ ] Project dashboard displays after creation
- [ ] Starter tier users are blocked from creating more than 1 project with clear upgrade CTA

### US-3: Guided Context Creation
- [ ] User sees 9 starting points on project dashboard
- [ ] Starting points display with subtle suggested order for new projects
- [ ] Selecting a starting point opens a chat with that topic's specialized system prompt
- [ ] AI guides user through relevant questions and frameworks
- [ ] User can have multiple guided chats in progress simultaneously
- [ ] AI has access to all existing project documents in every chat for full context

### US-4: Custom Chat Creation
- [ ] User can create a new blank chat
- [ ] User can add/edit a custom system prompt for that chat
- [ ] Custom chats function identically to guided chats for document creation
- [ ] Custom system prompt persists across chat sessions
- [ ] AI has access to all existing project documents in custom chats

### US-5: Document Creation via Chat
- [ ] AI can create a new markdown document based on conversation
- [ ] AI presents document preview within chat
- [ ] User can request edits to document through natural language
- [ ] Documents are saved to project automatically
- [ ] Documents display in project dashboard with title, type, and last modified date
- [ ] Warning message appears in UI if document length approaches or exceeds Claude context limits

### US-6: Document Management
- [ ] Project dashboard shows all documents in a clear list/grid view
- [ ] User can open any document to view full content
- [ ] User can manually edit documents outside of chat
- [ ] User can delete documents with confirmation
- [ ] User can download individual documents as markdown files

### US-7: GitHub Sync
- [ ] User can push individual documents to GitHub
- [ ] User can push all documents at once
- [ ] Documents are pushed to `/Skribe/` folder (e.g., `/Skribe/prd.md`)
- [ ] Push creates a commit with clear commit message
- [ ] User can see sync status (synced, pending changes, error)
- [ ] Conflicts or errors surface clearly with resolution guidance

### US-8: Subscription Management
- [ ] New users start with 3-day free trial with full access
- [ ] Trial users see clear countdown and conversion CTA
- [ ] User can subscribe to Starter ($12/mo) or Pro ($29/mo)
- [ ] Starter users are limited to 1 project
- [ ] Starter users have capped chat history
- [ ] Pro users have unlimited projects and unlimited chat history
- [ ] Starter users see upgrade prompts when hitting limits
- [ ] User can manage billing through Polar customer portal

### US-9: Subscription Downgrade Handling
- [ ] When Pro user initiates downgrade, system checks for multiple projects
- [ ] If multiple projects exist, user is shown a selection screen
- [ ] User must select exactly one project to retain
- [ ] Clear warning displayed: "The following projects will be permanently deleted: [list]"
- [ ] User must confirm deletion before downgrade completes
- [ ] Non-selected projects are deleted only after explicit confirmation
- [ ] Downgrade is blocked until user completes project selection

### US-10: Return User Experience
- [ ] Dashboard shows recent projects and recent chats
- [ ] Chat history is preserved and loadable
- [ ] User can continue any previous guided or custom chat
- [ ] AI has context of all project documents plus previous conversation within the same chat thread

---

## Out of Scope (v2+)

- MCP integration / persistent context server
- Pulling context from existing codebase
- Team collaboration / shared projects
- AI proactively suggesting missing context
- Mobile app
- Integrations beyond GitHub (GitLab, Bitbucket)
- Custom domain / white-labeling
- Document version history
- Maximum document length enforcement (warnings only for MVP)

---

## Notes

- All GitHub tokens must be stored securely, never exposed to client
- User data must be isolated per account
- Clerk handles auth security
- Polar handles PCI compliance for payments
- GitHub API rate limits must be respected
