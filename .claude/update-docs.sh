#!/bin/bash

# Auto-update documentation based on committed files
# Analyzes git commit and updates relevant docs

set -e

# Get files changed in the last commit
CHANGED_FILES=$(git diff-tree --no-commit-id --name-only -r HEAD)

if [ -z "$CHANGED_FILES" ]; then
  exit 0
fi

# Track which docs need updating
UPDATE_ARCHITECTURE=0
UPDATE_DESIGN=0
UPDATE_PHASES=0

# Analyze changed files
while IFS= read -r file; do
  case "$file" in
    src/app/*|src/lib/*|src/components/*)
      UPDATE_ARCHITECTURE=1
      UPDATE_DESIGN=1
      ;;
    supabase/*|src/lib/types/*)
      UPDATE_ARCHITECTURE=1
      ;;
    docs/*)
      # Documentation changes don't need auto-update
      ;;
    package.json|tsconfig.json|tailwind.config.ts)
      UPDATE_DESIGN=1
      ;;
  esac
done <<< "$CHANGED_FILES"

# Get commit message. Strip stray "@" marker lines (caveman-commit artifact).
COMMIT_HASH=$(git log -1 --format="%h" HEAD)
COMMIT_MSG=$(git log -1 --format="%B" HEAD | sed '/^@$/d')
# First meaningful line (skip blanks / "@") — used to detect a manual entry.
COMMIT_SUBJECT=$(printf '%s\n' "$COMMIT_MSG" | grep -vE '^\s*$' | head -1)

# Update CHANGELOG — idempotently. Skip if this commit is already recorded,
# either by hash (hook re-run) or by its subject line (a manual entry already
# added before committing). Prevents the duplicate/triplicate entries the old
# unconditional prepend produced.
if [ -f CHANGELOG.md ]; then
  already_logged=0
  grep -qF "[$COMMIT_HASH]" CHANGELOG.md && already_logged=1
  [ -n "$COMMIT_SUBJECT" ] && grep -qF "$COMMIT_SUBJECT" CHANGELOG.md && already_logged=1

  if [ "$already_logged" -eq 0 ]; then
    DATE=$(date +"%Y-%m-%d")
    {
      echo "## [$COMMIT_HASH] - $DATE"
      echo ""
      echo "$COMMIT_MSG"
      echo ""
      cat CHANGELOG.md
    } > CHANGELOG.md.tmp
    mv CHANGELOG.md.tmp CHANGELOG.md
  fi
fi

# Update architecture doc if needed
if [ $UPDATE_ARCHITECTURE -eq 1 ] && [ -f docs/architecture/ARCHITECTURE.md ]; then
  echo "✓ Architecture documentation relevant to this commit"
fi

# Update design doc if needed
if [ $UPDATE_DESIGN -eq 1 ] && [ -f docs/design/DESIGN_SYSTEM.md ]; then
  echo "✓ Design system documentation relevant to this commit"
fi

# Update phases if working on phase files
if echo "$CHANGED_FILES" | grep -q "docs/phases/"; then
  UPDATE_PHASES=1
fi

if [ $UPDATE_PHASES -eq 1 ] && [ -f docs/phases/README.md ]; then
  echo "✓ Phase documentation updated"
fi

exit 0
