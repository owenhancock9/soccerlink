# SoccerLink — Project Reference Guide

> **Purpose:** This document is the single source of truth for all AI-assisted development on SoccerLink. Every code generation, modification, or feature addition MUST align with the architecture, design system, conventions, and business logic described here.

---

## 1. Product Overview

**SoccerLink** is a marketplace platform connecting soccer players with professional coaches for **personalized VOD (Video on Demand) reviews**. Players upload match footage, book coaching sessions through the platform, and receive timestamped tactical feedback. Coaches earn income by reviewing footage and providing expert analysis.

### Core Value Proposition
- **For Players:** Find verified coaches, book sessions with an escrow-protected payment, and receive pro-level feedback on match footage.
- **For Coaches:** Manage a pipeline of VOD review requests, earn money, and build a verified reputation.
- **For Admins:** Monitor disputes, enforce anti-circumvention policies, and manage platform integrity.

---

## 2. Tech Stack

| Layer          | Technology                                                                 |
|----------------|---------------------------------------------------------------------------|
| **Framework**  | Next.js 16.2.1 (App Router)                                              |
| **Language**   | TypeScript 5.x                                                            |
| **UI Library** | React 19.2.4                                                              |
| **Styling**    | Tailwind CSS 4.x via `@tailwindcss/postcss`, plus custom vanilla CSS      |
| **Fonts**      | Inter (Google Fonts) — weights 400–900                                    |
| **Build**      | `next build` / `next dev`                                                 |
| **Linting**    | ESLint 9.x + `eslint-config-next`                                        |
| **Compiler**   | `babel-plugin-react-compiler` 1.0.0                                       |

### Key Files
```
soccer-link/
├── src/app/
│   ├── page.tsx         ← Main SPA component (all views)
│   ├── layout.tsx       ← Root layout, metadata, font loading
│   ├── globals.css      ← Design tokens, animations, component styles
│   ├── favicon.ico
│   └── readme.md        ← THIS FILE
├── package.json
├── tsconfig.json
├── next.config.ts
├── postcss.config.mjs
└── eslint.config.mjs
```

---

## 3. Architecture — Single Page, Multi-View

The app is a **client-side SPA** rendered inside the Next.js App Router. All views live in a single `page.tsx` file gated by a `view` state variable.

### Views & Roles

| View Key      | Role Required | Component Section  | Description                                 |
|---------------|---------------|--------------------|---------------------------------------------|
| `discovery`   | `player`      | Coach search/grid  | Browse & filter verified coaches            |
| `session`     | `player`      | VOD Portal         | Watch VOD reviews, see coach notes & stats  |
| `dashboard`   | `coach`       | Coach Hub          | Escrow balance, pending VODs, action queue  |
| `admin`       | `admin`       | Admin Console      | Dispute resolution, ban/refund controls     |

### State Management
- **No external state library** — all state is managed via React `useState` + `useCallback`.
- View transitions are triggered by `switchView(v)` which updates `view` and increments `viewKey` (forcing re-animation of the `<main>` element).
- Role switching is done via `handleRoleSwitch(role, name)` which updates `currentUser` and navigates to the appropriate default view.

### Modals
Modals are controlled by `activeModal` state (`"schedule"` | `"checkout"` | `"tos"` | `null`):
- **Schedule Modal** — Calendar date picker + time slot selector
- **Checkout Modal** — Escrow breakdown with Stripe payment CTA
- **TOS Modal** — Terms of Service display

---

## 4. Design System

### Color Palette & Design Tokens

All tokens are defined as CSS custom properties in `globals.css`:

```css
--bg-primary:     #030712       /* Near-black background */
--bg-card:        rgba(15,23,42,0.6)
--bg-card-hover:  rgba(15,23,42,0.85)
--bg-glass:       rgba(15,23,42,0.4)
--border-default: rgba(51,65,85,0.5)
--border-hover:   rgba(99,102,241,0.4)
--accent-blue:    #6366f1       /* Primary indigo */
--accent-indigo:  #818cf8
--accent-emerald: #34d399
--accent-amber:   #fbbf24
--accent-rose:    #fb7185
--glow-blue:      rgba(99,102,241,0.15)
--glow-emerald:   rgba(52,211,153,0.15)
--ease-spring:    cubic-bezier(0.34,1.56,0.64,1)
--ease-smooth:    cubic-bezier(0.22,1,0.36,1)
```

### Accent Color Associations
| Color          | Usage                                      |
|----------------|--------------------------------------------|
| **Indigo**     | Primary brand, player UI, CTAs, nav active |
| **Emerald**    | Coach-specific UI, success, payouts        |
| **Rose/Pink**  | Admin UI, disputes, warnings, bans         |
| **Amber**      | Star ratings, mental stat, caution         |
| **Cyan**       | Tactical stat bar, secondary accent        |
| **Orange**     | Pending states, action-required indicators |

### Typography
- **Font Family:** Inter (Google Fonts), fallback to `system-ui, -apple-system, sans-serif`
- **Monospace:** JetBrains Mono / Geist Mono (for prices, stats, timestamps)
- **Sizing Pattern:** `text-[10px]` / `text-[11px]` for labels, `text-sm` for body, `text-base` to `text-4xl` for headings
- **Weight Pattern:** `font-medium` (labels), `font-semibold` (buttons/tags), `font-bold` to `font-extrabold` (headings), `font-black` (brand name)

### CSS Component Classes

| Class           | Purpose                                                              |
|-----------------|----------------------------------------------------------------------|
| `.glass-card`   | Frosted glass card with backdrop-blur, border, hover lift & glow     |
| `.gradient-text` | Animated indigo-violet gradient text via `background-clip: text`    |
| `.glow-btn`     | Button with animated glow effect on hover (pseudo-element blur)      |
| `.shimmer`      | Horizontal shimmer loading effect                                    |
| `.modal-backdrop` | Animated backdrop blur + darken for modals                         |
| `.float-dot`    | Gentle floating animation (up/down 6px)                              |
| `.stat-bar-fill` | Animated width fill for stat bars                                   |

### Animation System

All animations use custom easing curves (`--ease-spring` and `--ease-smooth`):

| Class                | Animation              | Duration | Notes                    |
|----------------------|------------------------|----------|--------------------------|
| `.anim-fade-in`      | Opacity 0→1            | 500ms    | General fade-in          |
| `.anim-fade-in-up`   | Opacity + translateY   | 600ms    | Content sections         |
| `.anim-fade-in-down` | Opacity + translateY   | 400ms    | Dropdowns, mobile menu   |
| `.anim-scale-in`     | Opacity + scale        | 350ms    | Modals (spring easing)   |
| `.anim-slide-right`  | Opacity + translateX   | 500ms    | Slide entrances          |
| `.stagger-children`  | Children fade-in-up    | Varies   | 60ms delay between items |

### Visual Signatures
- **Ambient Background Glow:** Two large, blurred gradient circles (indigo + violet) positioned at corners
- **Grain Texture:** SVG noise overlay via `body::before` at `opacity: 0.03`
- **Custom Scrollbar:** 6px wide, indigo-tinted thumb with hover state
- **Selection Color:** Indigo-tinted background

---

## 5. Component Inventory

### Helper Components

| Component   | Props                                    | Purpose                                    |
|-------------|------------------------------------------|--------------------------------------------|
| `Stars`     | `{ rating: number }`                     | Renders gold star icons (full + half)      |
| `StatBar`   | `{ label, value, color, delay? }`        | Animated horizontal stat bar (0–100)       |
| `CoachCard` | `{ coach: Coach, index, onBook }`        | Coach listing card with CTA                |
| `NavBtn`    | `{ active, onClick, children, accent? }` | Navigation button with active/hover states |

### Data Interfaces

```typescript
interface Coach {
  id: number;
  name: string;
  style: string;       // e.g., "Tiki-Taka", "Gegenpressing"
  role: string;        // e.g., "Midfield", "Striker", "Defense", "Tactical"
  rate: number;        // Hourly rate in USD
  verified: boolean;
  rating: number;      // 0–5 scale
  reviews: number;
  bio: string;
  avatar: string;      // Single character
  gradient: string;    // Tailwind gradient classes
}
```

### Mock Data

- **4 Coaches:** Ricardo (Tiki-Taka/Midfield/$60), Marco (Gegenpressing/Tactical/$45), Sarah (Target Man/Striker/$55), Diego (Catenaccio/Defense/$50)
- **Player Stats:** Technical 88, Tactical 75, Physical 92, Mental 81
- **Player Profile:** Alex Rivera, Midfielder
- **Platform Fee:** 13% (`PLATFORM_CUT = 0.13`)

---

## 6. Business Logic

### Escrow Payment Flow
1. Player clicks **"Check Availability"** on a coach card → Schedule Modal opens
2. Player selects a date from the calendar grid (dates 10–23 shown)
3. Player selects a time slot (10:00 AM, 2:00 PM, or 6:30 PM)
4. Player clicks **"Continue to Escrow"** → Checkout Modal opens
5. Checkout displays: Session Rate + Platform Fee (13%) = Total Escrow
6. Player clicks **"Pay via Stripe"** → Funds locked in escrow
7. Coach reviews the VOD → Funds released to coach

### Anti-Circumvention Policy
- Off-platform payment requests are flagged and result in IP bans
- Admins can view disputes with quoted evidence
- Admin actions: **Ban Coach** or **Refund Player Escrow**

### Coach Dashboard Metrics
- Escrow Pending (locked funds)
- Available Payout (ready to withdraw)
- Pending VODs (queue count)
- Platform Fee Paid (total fees deducted)

---

## 7. UX Conventions

### Interaction Patterns
- **Hover lift:** Cards lift 2px on hover with indigo border glow
- **Active press:** Buttons scale to `0.97` on click (`active:scale-[0.97]`)
- **Staggered entry:** Grid items animate in with 60ms delays between siblings
- **View transitions:** Entire `<main>` re-keys on view change to trigger entry animations

### Responsive Breakpoints
- **Mobile-first** with `md:` (768px) and `lg:` (1024px) breakpoints
- Mobile menu: Full-screen overlay with role switching options
- Navigation: Horizontal desktop nav, hamburger menu on mobile
- Content max-width: `max-w-6xl` (1152px)

### Accessibility IDs
All interactive elements have unique IDs for testing:
- `coach-search`, `filter-toggle`, `role-switcher`
- `book-coach-{id}`, `continue-to-escrow`, `pay-stripe`
- `modal-close`, `tos-link`, `mobile-menu-toggle`

---

## 8. Development Rules

### MUST Follow
1. **Read Next.js docs** in `node_modules/next/dist/docs/` before using any Next.js API — this is Next.js 16 with breaking changes from training data.
2. **Preserve the design system** — use existing CSS tokens, animation classes, and component patterns.
3. **Dark mode only** — the platform is dark-themed by design. Never introduce light backgrounds.
4. **Glass morphism aesthetic** — all cards use `.glass-card`. Maintain backdrop-blur, subtle borders, and glow effects.
5. **Inter font** for all text. JetBrains Mono for monospace contexts (prices, timestamps, stats).
6. **13% platform fee** — all pricing must account for `PLATFORM_CUT = 0.13`.
7. **Unique IDs** on all interactive elements for browser testing.
8. **Client component** — `page.tsx` is `"use client"`. Respect client/server boundaries.

### SHOULD Follow
- Use Tailwind utility classes inline; reserve `globals.css` for reusable patterns and animations.
- Keep animations performant — use `transform` and `opacity` only for GPU-accelerated transitions.
- Match existing spacing: `gap-4`/`gap-5`/`gap-6` rhythm, `p-4` to `p-8` padding scale.
- Tags/badges: `text-[10px]` uppercase tracking-wider with subtle background + border.
- Use `shrink-0` on elements that should not collapse in flex layouts.

### AVOID
- External state management libraries (Redux, Zustand, etc.)
- Light mode or white backgrounds
- Generic/unstyled HTML elements
- Placeholder images — generate real assets if needed
- Breaking the single-page architecture without explicit approval
