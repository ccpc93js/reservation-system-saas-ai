## [ec6ca50] - 2026-05-31

### Auto-Documentation Update Hook

Implement automated documentation synchronization on every commit.

**Features:**
- PostToolUse hook analyzes git commits after they complete
- Automatically updates CHANGELOG.md with commit details
- Maps file changes to relevant documentation areas (architecture, design, phases)
- Script detects changes in src/, supabase/, and configuration files
- Non-blocking execution — hook failures don't affect commits

**Files:**
- `.claude/settings.json` - Hook configuration
- `.claude/update-docs.sh` - Documentation analysis script
- `docs/guides/DEVELOPMENT.md` - Development workflow guide

**Impact:**
Documentation stays synchronized with code in every commit, creating an atomic record of what changed and why. Developers don't need to manually update CHANGELOG or flag affected documentation areas.

**Usage:**
Simply commit as normal — the hook runs automatically and updates relevant docs before completing the commit.

# Changelog

All notable changes to this project are documented in this file.

## 2026-05-25 - Tailwind stability fix

### Summary
- Stabilized styling pipeline after Tailwind version/config mismatch caused styles not to apply.
- Standardized dashboard UI to semantic color tokens for maintainable theming.
- Fixed TypeScript issues uncovered during build validation.

### Tailwind and build pipeline
- Migrated to Tailwind CSS 3.4.17 for conservative stability.
- Replaced Tailwind v4 PostCSS plugin usage with Tailwind v3 PostCSS setup.
- Updated global stylesheet directives to Tailwind v3 syntax.

### UI consistency updates
- Migrated layout shell and key dashboard screens to semantic tokens:
  - background, surface, foreground, muted-foreground, border, primary, ring.
- Updated dialogs and reservation drawers to use the same token system.

### Build and type fixes
- Updated dynamic API route handler context typing for current Next.js route expectations.
- Fixed multiple strict TypeScript errors in API handlers, forms, and middleware/server helpers.
- Confirmed successful production build with type checks.

### Verification
- npm run build completed successfully after changes.

### Notes for future upgrades
- If upgrading Tailwind again, verify PostCSS plugin config and global CSS directives together.
- Keep semantic token usage in components to avoid hardcoded color drift.
