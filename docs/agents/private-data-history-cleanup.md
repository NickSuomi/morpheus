# Private Data History Cleanup

Morpheus public git history must not contain private target names, private
hostnames, private issue or merge-request URLs, local target paths, tokens,
target-specific evidence, or committed Beads history.

This cleanup is destructive for shared git refs. Run it only after explicit
operator approval and after collaborators know they must re-clone or hard-reset
local clones.

## Current Policy

- `.beads/` is local/private and ignored.
- Private target signoff evidence stays outside Morpheus git.
- Public docs, tests, fixtures, commits, and release artifacts use anonymized
  public target names only.
- `pnpm scan:private-data` is the local/CI gate for current-tree private data.
  Set `MORPHEUS_FORBIDDEN_PRIVATE_PATTERNS` to the current operator-approved
  private target names, hostnames, and path fragments before running it.

## Required Tools

- `gitleaks`
- `git-secrets`
- `git-filter-repo` or an equivalent history rewrite tool

## Cleanup Sequence

Set a shell variable with the current operator-approved forbidden patterns
before running scan commands. Do not commit the real private names or hostnames
in this file.

1. Verify the current tree:

   ```sh
   git ls-files .beads
   pnpm scan:private-data
   rg -n "$MORPHEUS_FORBIDDEN_PRIVATE_PATTERNS" \
     README.md AGENTS.md CONTEXT.md ARCHITECTURE.md docs packages tests fixtures scripts .gitignore package.json
   gitleaks detect --source . --redact --verbose
   git secrets --scan
   ```

2. Inspect all refs before rewriting:

   ```sh
   git grep -n -I -E "$MORPHEUS_FORBIDDEN_PRIVATE_PATTERNS" \
     $(git for-each-ref --format='%(refname)') -- . ':!node_modules' ':!.beads'
   ```

3. Rewrite history with operator-approved replacement rules. At minimum, remove
   committed `.beads/` paths and replace known private target names/hosts with
   anonymized public placeholders.

4. Delete stale local and remote refs that still point to pre-cleanup history.

5. Verify rewritten history:

   ```sh
   gitleaks detect --source . --redact --verbose
   git secrets --scan-history
   git grep -n -I -E "$MORPHEUS_FORBIDDEN_PRIVATE_PATTERNS" \
     $(git for-each-ref --format='%(refname)') -- . ':!node_modules' ':!.beads'
   git ls-files .beads
   ```

6. Push only with explicit approval:

   ```sh
   git push --force-with-lease --all
   git push --force-with-lease --tags
   ```

7. Tell collaborators to re-clone the repository, or fetch and reset to the new
   rewritten public refs. Old branches, tags, forks, and local clones may still
   retain private history until deleted or rewritten.
