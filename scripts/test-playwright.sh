#!/usr/bin/env bash
# test-playwright.sh — Verifies Playwright MCP works inside a claude -p call.
# Mirrors exactly how overnight-run.sh invokes Claude.

set -uo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

# Load env the same way overnight-run.sh does
for env_file in "$REPO_ROOT/goed/.env.local" "$REPO_ROOT/goed/.env" "$REPO_ROOT/.env.local" "$REPO_ROOT/.env"; do
  if [[ -f "$env_file" ]]; then
    set -a; source "$env_file"; set +a
    echo "[info] Loaded env: $env_file"
    break
  fi
done

PROMPT='Use the mcp__playwright__browser_navigate tool to navigate to https://example.com, then use mcp__playwright__browser_snapshot to capture the page, and report: (1) what the page title is, (2) whether Playwright launched successfully, (3) any errors encountered. Do nothing else.

IMPORTANT: You are running in fully automated mode with no user present. Never call AskUserQuestion. Complete the task and exit.'

echo ""
echo "=== Running claude -p with Playwright prompt (same flags as overnight-run.sh) ==="
echo ""

cd "$REPO_ROOT"

timeout 120 claude -p "$PROMPT" \
  --dangerously-skip-permissions \
  --max-budget-usd 1 \
  2>&1

echo ""
echo "=== Exit code: $? ==="
