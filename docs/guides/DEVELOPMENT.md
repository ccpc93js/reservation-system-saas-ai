# Development Workflow

## Auto-Documentation Updates

This project uses an automated hook system to keep documentation synchronized with code changes.

### How It Works

Every time you commit code, the system automatically:
1. Analyzes which files changed in your commit
2. Identifies affected documentation areas
3. Updates relevant docs (CHANGELOG, ARCHITECTURE, DESIGN, etc.)
4. Includes updated docs in the same atomic commit

### Hook Configuration

**Location:** `.claude/settings.json`

Configured as a `PostToolUse` hook on `Bash` that triggers after `git commit` commands.

**Script:** `.claude/update-docs.sh`

The hook script:
- Extracts files from the commit using `git diff-tree`
- Maps file changes to documentation areas
- Updates CHANGELOG.md with commit details
- Flags architecture and design docs for review if relevant

### Documentation Mapping

File changes trigger documentation updates:

| Changed Files | Updated Docs |
|---|---|
| `src/app/*`, `src/components/*`, `src/lib/*` | ARCHITECTURE.md, DESIGN_SYSTEM.md |
| `supabase/*`, database schema | ARCHITECTURE.md |
| Configuration files (tsconfig, tailwind) | DESIGN_SYSTEM.md |
| `docs/phases/*` | Phase documentation |

### Commit Workflow

When making a commit:

1. **Make code changes**
2. **Update relevant docs manually** if the hook doesn't cover your specific changes
3. **Run `git commit`** - the hook automatically:
   - Updates CHANGELOG.md
   - Identifies affected documentation
   - Stages doc updates
4. **Complete commit** with both code and doc changes

### Manual Documentation Updates

While the hook handles CHANGELOG updates, you may need to manually update these docs:

- `docs/architecture/ARCHITECTURE.md` - Major system changes
- `docs/design/DESIGN_SYSTEM.md` - Component or UI pattern changes
- `docs/phases/*.md` - Phase milestone updates
- `docs/guides/*.md` - Getting started or workflow changes

### Disabling the Hook

To disable auto-updates temporarily:
1. Edit `.claude/settings.json`
2. Comment out or remove the `PostToolUse` hook
3. Re-enable after testing

The hook is safe and non-blocking — failures don't affect your commits.
