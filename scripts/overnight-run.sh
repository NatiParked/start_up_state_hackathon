#!/usr/bin/env bash
# overnight-run.sh — State-machine epic executor.
#
# Each iteration of the outer loop reads .project/ files to determine
# the single next action, runs ONE "claude -p" call to do it, then
# loops. Fresh Claude context every action. Rate limits pause the loop
# without losing state. Kill and restart at any time — it resumes.
#
# Usage:
#   ./scripts/overnight-run.sh epic 0001          # drive whole epic
#   ./scripts/overnight-run.sh feature 0002       # drive one feature
#   ./scripts/overnight-run.sh epic 0001 --dry-run
#   ./scripts/overnight-run.sh epic 0001 --start-server
#   ./scripts/overnight-run.sh epic 0001 --budget 5 --timeout 1800
#
# Options:
#   --dry-run        Print next action without calling Claude
#   --start-server   Start npm dev server before verify steps
#   --port PORT      Dev server port (default: auto-detect)
#   --app-dir DIR    App subdirectory for dev server (default: auto-detect)
#   --dev-cmd CMD    Dev server command (default: "npm run dev")
#   --budget USD     Max USD per claude invocation (default: 10)
#   --timeout SECS   Max seconds per claude invocation (default: 1800)

set -uo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
PROJECT_DIR="$REPO_ROOT/.project"
LOG_DIR="$REPO_ROOT/logs"
INVOCATION_LOG="${HOME}/.claude/overnight-invocations.log"

# Appended to every prompt so Claude never calls AskUserQuestion.
AUTONOMOUS_SUFFIX="

IMPORTANT: You are running in fully automated mode with no user present. Never call AskUserQuestion. When you encounter ambiguity, make a reasonable choice, document it, and proceed. Complete the task and exit."

# Defaults — overridable via flags
MODE=""
TARGET_ID=""
DRY_RUN=false
START_SERVER=false
DEV_PORT=""
APP_DIR=""
DEV_CMD="npm run dev"
MAX_BUDGET_USD=10
CLAUDE_TIMEOUT=1800
RATE_LIMIT_BUFFER=120   # extra seconds beyond stated retry-after
ACTION_PAUSE=5           # seconds between successful actions
DEV_SERVER_PID=""

BOLD=$'\033[1m'; RED=$'\033[0;31m'; GREEN=$'\033[0;32m'
YELLOW=$'\033[1;33m'; BLUE=$'\033[0;34m'; CYAN=$'\033[0;36m'; NC=$'\033[0m'

# ── Logging ───────────────────────────────────────────────────────────────────

LOG_FILE="/dev/stderr"  # replaced in init

log_raw() { printf '%s\n' "$*" | tee -a "$LOG_FILE"; }

ts() { date '+%H:%M:%S'; }

log_info()  { log_raw "[$(ts)] ${BLUE}INFO${NC}  $*"; }
log_ok()    { log_raw "[$(ts)] ${GREEN}OK${NC}    $*"; }
log_warn()  { log_raw "[$(ts)] ${YELLOW}WARN${NC}  $*"; }
log_err()   { log_raw "[$(ts)] ${RED}ERROR${NC} $*"; }
log_action(){ log_raw "[$(ts)] ${CYAN}▶${NC}     $*"; }

banner() {
  local line="────────────────────────────────────────────────────────"
  log_raw ""
  log_raw "${BOLD}${line}${NC}"
  log_raw " $*"
  log_raw "${BOLD}${line}${NC}"
  log_raw ""
}

# ── Cleanup ───────────────────────────────────────────────────────────────────

cleanup() {
  [[ -n "$DEV_SERVER_PID" ]] && kill "$DEV_SERVER_PID" 2>/dev/null || true
}
trap cleanup EXIT INT TERM

# ── File-based state detection ────────────────────────────────────────────────
# All state comes from .project/ files. No bash variables carry state
# between loop iterations.

roadmap_phase_count() {
  local rf="$PROJECT_DIR/features/$1/ROADMAP.md"
  [[ -f "$rf" ]] || { echo 0; return; }
  local n
  n=$(grep -cE '^#{2,3} Phase [0-9]' "$rf" 2>/dev/null) || n=0
  echo "$n"
}

phase_plan_exists() {
  [[ -f "$PROJECT_DIR/features/$1/phases/phase-$2/PLAN.md" ]]
}

phase_verify_pass() {
  local vf="$PROJECT_DIR/features/$1/phases/phase-$2/VERIFICATION.md"
  [[ -f "$vf" ]] && grep -qE '\*\*Overall: PASS\*\*|^VERIFICATION: PASS' "$vf"
}

phase_verify_fail() {
  local vf="$PROJECT_DIR/features/$1/phases/phase-$2/VERIFICATION.md"
  [[ -f "$vf" ]] && grep -qE '\*\*Overall: FAIL\*\*|^VERIFICATION: FAIL' "$vf"
}

phase_executed() {
  # A phase is "executed" if: (a) VERIFICATION.md exists (any result), OR
  # (b) EXECUTED sentinel file exists (written by post_action_hook), OR
  # (c) STATE.md marks it as complete/in-progress (not Pending).
  local vf="$PROJECT_DIR/features/$1/phases/phase-$2/VERIFICATION.md"
  [[ -f "$vf" ]] && return 0
  local ef="$PROJECT_DIR/features/$1/phases/phase-$2/EXECUTED"
  [[ -f "$ef" ]] && return 0
  local sf="$PROJECT_DIR/features/$1/STATE.md"
  [[ -f "$sf" ]] || return 1
  grep -q "Phase $2:.*[Cc]omplete\|Phase $2:.*✅\|Phase $2:.*In Progress" "$sf"
}

feature_has_roadmap() { [[ -f "$PROJECT_DIR/features/$1/ROADMAP.md" ]]; }
feature_dir_exists()  { [[ -d "$PROJECT_DIR/features/$1" ]]; }

feature_complete() {
  local feat="$1"
  feature_has_roadmap "$feat" || return 1
  local count; count=$(roadmap_phase_count "$feat")
  [[ $count -gt 0 ]] || return 1
  local p
  for p in $(seq 1 "$count"); do
    phase_verify_pass "$feat" "$p" || return 1
  done
  return 0
}

# ── Next-action logic ─────────────────────────────────────────────────────────
# Returns one token describing the next thing to do, e.g.:
#   create-feature:3:0001
#   plan-feature:0003
#   plan-phase:0002:2
#   execute-phase:0001:1
#   verify-phase:0001:1
#   fix-phase:0001:1
#   done

next_action_for_feature() {
  local feat="$1"

  if ! feature_dir_exists "$feat"; then
    echo "error:feature-dir-missing:$feat"
    return
  fi

  if ! feature_has_roadmap "$feat"; then
    echo "plan-feature:$feat"
    return
  fi

  local count; count=$(roadmap_phase_count "$feat")
  if [[ $count -eq 0 ]]; then
    echo "error:no-phases-in-roadmap:$feat"
    return
  fi

  local p
  for p in $(seq 1 "$count"); do
    phase_verify_pass "$feat" "$p" && continue

    if ! phase_plan_exists "$feat" "$p"; then
      echo "plan-phase:$feat:$p"
      return
    fi

    if phase_verify_fail "$feat" "$p"; then
      echo "fix-phase:$feat:$p"
      return
    fi

    if ! phase_executed "$feat" "$p"; then
      echo "execute-phase:$feat:$p"
      return
    fi

    # Planned + executed, no verification result yet
    echo "verify-phase:$feat:$p"
    return
  done

  echo "done"
}

# ── Milestone / epic parsing ──────────────────────────────────────────────────
# Reused verbatim from original overnight-run.sh — battle-tested.

find_milestones_file() {
  find "$PROJECT_DIR/epics" -maxdepth 2 -name "MILESTONES.md" \
    -path "*${1}*" 2>/dev/null | head -1
}

parse_milestones() {
  local milestones_path="$1"
  declare -A feat_map
  declare -a doc_order
  local current_m="" feat=""
  while IFS= read -r line; do
    if [[ "$line" =~ ^"## Milestone "([0-9]+)":" ]]; then
      if [[ -n "$current_m" ]]; then
        feat_map[$current_m]="${feat}"; doc_order+=("$current_m")
      fi
      current_m="${BASH_REMATCH[1]}"; feat=""
    elif [[ "$line" =~ \*\*"Linked Feature: "([0-9]{4})\*\* ]]; then
      feat="${BASH_REMATCH[1]}"
    fi
  done < "$milestones_path"
  [[ -n "$current_m" ]] && { feat_map[$current_m]="${feat}"; doc_order+=("$current_m"); }

  local -a tier_order
  mapfile -t tier_order < <(
    grep -E '^\*\*Tier [0-9]+ —' "$milestones_path" \
      | grep -oE 'M[0-9]+' | sed 's/^M//'
  )

  declare -A emitted
  local m_num
  for m_num in "${tier_order[@]}" "${doc_order[@]}"; do
    [[ -v emitted[$m_num] ]] && continue
    emitted[$m_num]=1
    printf '%s %s\n' "$m_num" "${feat_map[$m_num]:-}"
  done
}

extract_milestone_block() {
  local milestones_path="$1" m_num="$2" printing=false
  while IFS= read -r line; do
    if [[ "$line" =~ ^"## Milestone ${m_num}:" ]]; then
      printing=true
    elif $printing && [[ "$line" =~ ^"## Milestone "[0-9]+: ]]; then
      break
    elif $printing && [[ "$line" == "---" ]]; then
      break
    fi
    $printing && printf '%s\n' "$line"
  done < "$milestones_path"
}

link_feature_in_milestones() {
  local milestones_path="$1" m_num="$2" feat_id="$3"
  local tmp="${milestones_path}.tmp" in_target=false inserted=false
  while IFS= read -r line; do
    printf '%s\n' "$line"
    if [[ "$line" =~ ^"## Milestone ${m_num}:" ]]; then in_target=true; fi
    if [[ "$line" =~ ^"## Milestone "[0-9]+: ]] && ! [[ "$line" =~ ^"## Milestone ${m_num}:" ]]; then
      in_target=false
    fi
    if $in_target && ! $inserted && [[ "$line" =~ ^\*\*Tier: ]]; then
      printf '**Linked Feature: %s**\n' "$feat_id"
      inserted=true
    fi
  done < "$milestones_path" > "$tmp" && mv "$tmp" "$milestones_path"
}

next_feature_id() {
  local max=0 num
  for d in "$PROJECT_DIR/features/"*/; do
    [[ -d "$d" ]] || continue
    num=$(basename "$d"); num="${num%%[^0-9]*}"
    (( 10#${num:-0} > max )) && max=$(( 10#${num:-0} ))
  done
  printf '%04d' $(( max + 1 ))
}

next_action_for_epic() {
  local epic_id="$1"
  local milestones_path
  milestones_path=$(find_milestones_file "$epic_id")
  if [[ -z "$milestones_path" ]]; then
    echo "error:milestones-not-found:$epic_id"
    return
  fi

  local m_num feat_id
  while IFS=' ' read -r m_num feat_id; do
    if [[ -z "$feat_id" ]]; then
      echo "create-feature:$m_num:$epic_id"
      return
    fi
    if feature_complete "$feat_id"; then
      continue
    fi
    local action
    action=$(next_action_for_feature "$feat_id")
    echo "$action"
    return
  done < <(parse_milestones "$milestones_path")

  echo "done"
}

next_action() {
  local mode="$1" target="$2"
  if [[ "$mode" == "epic" ]]; then
    next_action_for_epic "$target"
  else
    next_action_for_feature "$target"
  fi
}

# ── Rate-limit helpers ────────────────────────────────────────────────────────

record_invocation() {
  mkdir -p "$(dirname "$INVOCATION_LOG")"
  echo "$(date +%s)" >> "$INVOCATION_LOG"
}

is_rate_limited() {
  echo "$1" | grep -qiE \
    'rate_limit_error|overloaded_error|"status":\s*429|rate limited|usage limit exceeded|try again in'
}

calc_rate_limit_sleep() {
  local output="$1"

  # ISO retry-after timestamp — extract any ISO-looking timestamp from the output
  local retry_ts
  retry_ts=$(echo "$output" \
    | grep -oi 'retry.after[^0-9]*[0-9][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9]T[0-9][0-9]:[0-9][0-9]:[0-9][0-9]' \
    | grep -oE '[0-9]{4}-[0-9]{2}-[0-9]{2}T[0-9]{2}:[0-9]{2}:[0-9]{2}' \
    | head -1 || true)
  if [[ -n "$retry_ts" ]]; then
    local target now diff
    target=$(date -d "$retry_ts" +%s 2>/dev/null || echo 0)
    now=$(date +%s)
    diff=$(( target - now + RATE_LIMIT_BUFFER ))
    echo $(( diff > 60 ? diff : 300 ))
    return
  fi

  # "try again in N seconds" or "try again in Ns"
  local secs
  secs=$(echo "$output" | grep -oi 'try again in [0-9][0-9]*' | grep -oE '[0-9]+$' | head -1 || true)
  if [[ -n "$secs" ]]; then
    echo $(( secs + RATE_LIMIT_BUFFER ))
    return
  fi

  # "in N minutes"
  local mins
  mins=$(echo "$output" | grep -oi 'in [0-9][0-9]* minute' | grep -oE '^[0-9]+' | head -1 || true)
  if [[ -n "$mins" ]]; then
    echo $(( mins * 60 + RATE_LIMIT_BUFFER ))
    return
  fi

  # 5-hour rolling window heuristic
  local rl_window=18000
  if [[ -f "$INVOCATION_LOG" ]]; then
    local now cutoff oldest wake_at diff
    now=$(date +%s)
    cutoff=$(( now - rl_window ))
    oldest=$(awk -v c="$cutoff" '$1+0 > c { print $1; exit }' "$INVOCATION_LOG" 2>/dev/null || true)
    if [[ -n "$oldest" ]]; then
      wake_at=$(( oldest + rl_window + RATE_LIMIT_BUFFER ))
      diff=$(( wake_at - now ))
      log_warn "5h-window heuristic → resume at $(date -d "@$wake_at" '+%H:%M:%S') (${diff}s)"
      echo $(( diff > 60 ? diff : 300 ))
      return
    fi
  fi

  echo $(( rl_window + RATE_LIMIT_BUFFER ))
}

# ── Dev server ────────────────────────────────────────────────────────────────

detect_dev_port() {
  local vite_port
  vite_port=$(grep -r 'server.*port\|port.*server' "$REPO_ROOT" \
    --include='vite.config.*' -h 2>/dev/null \
    | grep -oE 'port[: ]+[0-9]{4,5}' | grep -oE '[0-9]{4,5}' | head -1 || true)
  [[ -n "$vite_port" ]] && { echo "$vite_port"; return; }
  for port in 5173 3000 4200 8080 8000; do
    curl -sf -o /dev/null -w '%{http_code}' "http://localhost:$port" 2>/dev/null \
      | grep -qE '^[23]' && { echo "$port"; return; }
  done
  echo "5173"
}

detect_app_dir() {
  local candidates
  mapfile -t candidates < <(
    find "$REPO_ROOT" -maxdepth 3 -name "package.json" \
      -not -path "*/node_modules/*" 2>/dev/null | sort
  )
  for pkg in "${candidates[@]}"; do
    [[ "$pkg" == "$REPO_ROOT/package.json" ]] && continue
    grep -q '"dev"' "$pkg" 2>/dev/null && { dirname "$pkg"; return; }
  done
  [[ -f "$REPO_ROOT/package.json" ]] && grep -q '"dev"' "$REPO_ROOT/package.json" 2>/dev/null \
    && { echo "$REPO_ROOT"; return; }
  echo ""
}

server_ready() {
  curl -sf -o /dev/null -w '%{http_code}' "http://localhost:$DEV_PORT" 2>/dev/null \
    | grep -qE '^[23]'
}

start_dev_server() {
  [[ -z "$APP_DIR" ]] && { log_warn "No app dir — cannot start server"; return 1; }
  log_info "Starting dev server ($DEV_CMD in $APP_DIR)..."
  (cd "$APP_DIR" && $DEV_CMD >> "$LOG_DIR/devserver.log" 2>&1) &
  DEV_SERVER_PID=$!
  local attempts=0
  until server_ready || (( attempts >= 30 )); do sleep 2; (( attempts++ )) || true; done
  server_ready \
    && log_ok "Dev server ready at http://localhost:$DEV_PORT" \
    || log_warn "Dev server didn't respond in 60s — proceeding anyway"
}

stop_dev_server() {
  [[ -n "$DEV_SERVER_PID" ]] || return
  kill "$DEV_SERVER_PID" 2>/dev/null || true
  DEV_SERVER_PID=""
  log_info "Dev server stopped"
}

# ── Claude invocation ─────────────────────────────────────────────────────────
# Runs ONE claude -p call. Streams output to terminal + log.
# On rate limit: sleeps, retries same prompt (does not count as a new action).
# Returns 0 on success, 1 on non-rate-limit failure.
# Stores full output text in LAST_OUTPUT global.

LAST_OUTPUT=""
HEARTBEAT_INTERVAL=30   # seconds between heartbeat checks
STUCK_THRESHOLD=300     # seconds of silence before warning "may be stuck"
AUTO_KILL_THRESHOLD=600 # seconds of silence before killing and letting loop retry

# Background monitor: checks 3 signals every HEARTBEAT_INTERVAL seconds.
# Signal priority: output growth → project file changes → Anthropic connection → warning.
# Uses a ref_file (touched each iteration) so find -newer gives a rolling window, not
# "newer than the output file" (which updates continuously and would always be empty).
_heartbeat_monitor() {
  local label="$1" watch_pid="$2" tmpfile="$3"
  local start elapsed last_size curr_size silence_since silence conn recent_files
  local ref_file; ref_file=$(mktemp /tmp/hb-ref-XXXXXX)
  touch "$ref_file"

  start=$(date +%s)
  last_size=0
  silence_since=$start

  while kill -0 "$watch_pid" 2>/dev/null; do
    sleep "$HEARTBEAT_INTERVAL"
    [[ ! -f "$tmpfile" ]] && break

    elapsed=$(( $(date +%s) - start ))
    curr_size=$(wc -c < "$tmpfile" 2>/dev/null || echo 0)

    if (( curr_size > last_size )); then
      printf '[%s] \e[0;34mHEATBEAT\e[0m  %s — active (+%d bytes, %ds elapsed)\n' \
        "$(date '+%H:%M:%S')" "$label" "$(( curr_size - last_size ))" "$elapsed" | tee -a "$LOG_FILE"
      last_size=$curr_size
      silence_since=$(date +%s)
      touch "$ref_file"
      continue
    fi

    # No new output — check for project files modified since last check
    recent_files=$(find . -newer "$ref_file" -type f \
      -not -path './.git/*' -not -path './logs/*' -not -path './node_modules/*' \
      2>/dev/null | head -3 | tr '\n' ' ')
    touch "$ref_file"   # advance window before next iteration

    if [[ -n "$recent_files" ]]; then
      printf '[%s] \e[0;34mHEATBEAT\e[0m  %s — tool running, files: %s(%ds elapsed)\n' \
        "$(date '+%H:%M:%S')" "$label" "$recent_files" "$elapsed" | tee -a "$LOG_FILE"
      silence_since=$(date +%s)
      continue
    fi

    # No file changes — check silence duration and connection state.
    # Connection does NOT reset the clock: a hung open connection looks identical
    # to an active one. Only output bytes and file writes are real progress.
    conn=$(ss -tp 2>/dev/null | grep -cE 'anthropic|api\.claude|amazonaws' || true)
    silence=$(( $(date +%s) - silence_since ))

    if (( silence >= AUTO_KILL_THRESHOLD )); then
      local conn_note="no API connection"
      (( conn > 0 )) && conn_note="API connection open but unresponsive"
      printf '[%s] \e[0;31mAUTO-KILL\e[0m %s — hung for %ds (%s) — killing, loop will retry\n' \
        "$(date '+%H:%M:%S')" "$label" "$silence" "$conn_note" | tee -a "$LOG_FILE"
      # Kill subshell and its children (timeout wrapper, claude, tees) atomically.
      # Must not sleep — run_claude's `wait` unblocks the moment the subshell dies,
      # which could kill this monitor before a delayed pkill runs.
      # pkill -f is safe here: the loop only ever runs one claude -p at a time.
      kill "$watch_pid" 2>/dev/null || true
      pkill -KILL -P "$watch_pid" 2>/dev/null || true
      pkill -KILL -f "claude -p" 2>/dev/null || true
      break
    elif (( conn > 0 )); then
      printf '[%s] \e[0;34mHEATBEAT\e[0m  %s — waiting on LLM (%ds silent, %ds elapsed)\n' \
        "$(date '+%H:%M:%S')" "$label" "$silence" "$elapsed" | tee -a "$LOG_FILE"
    elif (( silence >= STUCK_THRESHOLD )); then
      printf '[%s] \e[0;33mWARNING\e[0m   %s — no output, no files, no API conn for %ds — may be stuck\n' \
        "$(date '+%H:%M:%S')" "$label" "$silence" | tee -a "$LOG_FILE"
    else
      printf '[%s] \e[0;34mHEATBEAT\e[0m  %s — quiet (%ds silent, %ds elapsed)\n' \
        "$(date '+%H:%M:%S')" "$label" "$silence" "$elapsed" | tee -a "$LOG_FILE"
    fi
  done
  rm -f "$ref_file"
}

run_claude() {
  local label="$1" prompt="$2"
  local attempt=0 sleep_secs wake

  while true; do
    (( attempt++ )) || true
    [[ $attempt -gt 1 ]] && log_info "[$label] Retry $attempt (non-rate-limit)..."

    if [[ "$DRY_RUN" == true ]]; then
      log_info "[DRY RUN] Would run claude -p for: $label"
      LAST_OUTPUT="[dry-run]"
      return 0
    fi

    record_invocation

    local tmpfile; tmpfile=$(mktemp /tmp/claude-out-XXXXXX)
    local exit_code_file; exit_code_file=$(mktemp /tmp/claude-exit-XXXXXX)
    local exit_code=0

    # Run pipeline in a subshell so PIPESTATUS[0] captures claude's exit code cleanly.
    # Subshell PID is what we monitor — it exits only after the full pipeline finishes.
    (
      set +o pipefail
      timeout "$CLAUDE_TIMEOUT" claude -p "$prompt" \
        --dangerously-skip-permissions \
        --max-budget-usd "$MAX_BUDGET_USD" \
        2>&1 | tee -a "$LOG_FILE" | tee "$tmpfile"
      echo "${PIPESTATUS[0]}" > "$exit_code_file"
    ) &
    local subshell_pid=$!

    _heartbeat_monitor "$label" "$subshell_pid" "$tmpfile" &
    local hb_pid=$!

    wait "$subshell_pid" 2>/dev/null || true
    kill "$hb_pid" 2>/dev/null || true
    wait "$hb_pid" 2>/dev/null || true

    exit_code=$(cat "$exit_code_file" 2>/dev/null || echo 1)
    rm -f "$exit_code_file"

    LAST_OUTPUT=$(cat "$tmpfile"); rm -f "$tmpfile"

    if [[ $exit_code -eq 124 ]]; then
      log_err "[$label] Timed out after ${CLAUDE_TIMEOUT}s."
      return 1
    fi

    if is_rate_limited "$LAST_OUTPUT"; then
      sleep_secs=$(calc_rate_limit_sleep "$LAST_OUTPUT")
      wake=$(date -d "+${sleep_secs}seconds" '+%H:%M:%S' 2>/dev/null || date '+%H:%M:%S')
      log_warn "[$label] Rate limited — sleeping ${sleep_secs}s, resuming at $wake"
      sleep "$sleep_secs"
      (( attempt-- )) || true   # rate-limit waits don't consume retry budget
      continue
    fi

    if [[ $exit_code -eq 0 ]]; then
      log_ok "[$label] Done."
      return 0
    fi

    # Non-rate-limit failure — let the outer loop retry (re-analyze state)
    log_warn "[$label] Exit $exit_code."
    return 1
  done
}

# ── Action prompt builder ─────────────────────────────────────────────────────

build_prompt() {
  local action_token="$1"
  local type; type="${action_token%%:*}"
  local rest; rest="${action_token#*:}"
  local feat phase m_num epic_id

  local prompt=""

  case "$type" in
    create-feature)
      IFS=: read -r m_num epic_id <<< "$rest"
      local milestones_path; milestones_path=$(find_milestones_file "$epic_id")
      local block; block=$(extract_milestone_block "$milestones_path" "$m_num")
      local new_id; new_id=$(next_feature_id)
      prompt="/spec:new-feature

Epic: ${epic_id} | New Feature ID: ${new_id} | Milestone: ${m_num}

Use this milestone spec as your complete requirements. Write non-interactively:
1. .project/features/${new_id}/ROADMAP.md — 3-5 phases, each independently verifiable, Success Criteria bullets per phase. Match format of .project/features/0001/ROADMAP.md.
2. .project/features/${new_id}/STATE.md — all phases Pending, match format of .project/features/0001/STATE.md.

Milestone spec:
${block}${AUTONOMOUS_SUFFIX}"
      ;;

    plan-feature)
      feat="$rest"
      prompt="/spec:plan ${feat}${AUTONOMOUS_SUFFIX}"
      ;;

    plan-phase)
      IFS=: read -r feat phase <<< "$rest"
      prompt="/spec:plan ${feat} --phase ${phase}${AUTONOMOUS_SUFFIX}"
      ;;

    execute-phase)
      IFS=: read -r feat phase <<< "$rest"
      prompt="/spec:execute-phase ${feat}:${phase} --commit${AUTONOMOUS_SUFFIX}"
      ;;

    verify-phase)
      IFS=: read -r feat phase <<< "$rest"
      local server_note=""
      $START_SERVER && server_note=" (dev server is running at http://localhost:${DEV_PORT})"
      prompt="/spec:verify-phase ${feat} ${phase}${server_note}${AUTONOMOUS_SUFFIX}"
      ;;

    fix-phase)
      IFS=: read -r feat phase <<< "$rest"
      local vf="$PROJECT_DIR/features/${feat}/phases/phase-${phase}/VERIFICATION.md"
      local gaps=""
      [[ -f "$vf" ]] && gaps=$(grep -A 40 'Overall: FAIL\|VERIFICATION: FAIL' "$vf" | head -40)
      prompt="/spec:execute-phase ${feat}:${phase} --commit

Fix only the failing criteria from the last verification run:
${gaps}${AUTONOMOUS_SUFFIX}"
      ;;

    *)
      log_err "Unknown action type: $type (token: $action_token)"
      return 1
      ;;
  esac

  printf '%s' "$prompt"
}

action_label() {
  local token="$1"
  local type; type="${token%%:*}"
  local rest; rest="${token#*:}"
  case "$type" in
    create-feature) IFS=: read -r m _ <<< "$rest"; echo "Create feature for M${m}" ;;
    plan-feature)   echo "Plan feature ${rest}" ;;
    plan-phase)     IFS=: read -r f p <<< "$rest"; echo "Plan ${f} phase ${p}" ;;
    execute-phase)  IFS=: read -r f p <<< "$rest"; echo "Execute ${f} phase ${p}" ;;
    verify-phase)   IFS=: read -r f p <<< "$rest"; echo "Verify ${f} phase ${p}" ;;
    fix-phase)      IFS=: read -r f p <<< "$rest"; echo "Fix ${f} phase ${p}" ;;
    *)              echo "$token" ;;
  esac
}

pre_action_hook() {
  local token="$1"
  local type; type="${token%%:*}"

  # Start dev server before verify steps
  if [[ "$type" == "verify-phase" ]] && $START_SERVER && ! server_ready; then
    start_dev_server
  fi
}

post_action_hook() {
  local token="$1"
  local type; type="${token%%:*}"
  local rest; rest="${token#*:}"

  # After create-feature: find the newly created feature dir and link it
  if [[ "$type" == "create-feature" ]]; then
    local m_num epic_id milestones_path new_id
    IFS=: read -r m_num epic_id <<< "$rest"
    milestones_path=$(find_milestones_file "$epic_id")
    # Find the highest-numbered feature dir that has a ROADMAP.md (the one just created)
    new_id=$(
      for d in "$PROJECT_DIR/features/"*/; do
        local id; id=$(basename "$d"); id="${id%%[^0-9]*}"
        [[ -f "$PROJECT_DIR/features/$id/ROADMAP.md" ]] && echo "$id"
      done | sort -n | tail -1
    )
    if [[ -n "$new_id" && -f "$PROJECT_DIR/features/$new_id/ROADMAP.md" ]]; then
      link_feature_in_milestones "$milestones_path" "$m_num" "$new_id"
      log_ok "Linked feature $new_id → Milestone $m_num in MILESTONES.md"
    else
      log_warn "create-feature ran but no ROADMAP.md found — check Claude output"
    fi
  fi

  # After execute-phase: write sentinel so phase_executed() returns true next iteration
  if [[ "$type" == "execute-phase" ]]; then
    local feat phase
    IFS=: read -r feat phase <<< "$rest"
    touch "$PROJECT_DIR/features/$feat/phases/phase-$phase/EXECUTED"
    log_info "Marked phase $feat:$phase as executed"
  fi

  # After fix-phase: remove stale VERIFICATION.md so next iter runs verify fresh
  if [[ "$type" == "fix-phase" ]]; then
    local feat phase
    IFS=: read -r feat phase <<< "$rest"
    local vf="$PROJECT_DIR/features/$feat/phases/phase-$phase/VERIFICATION.md"
    [[ -f "$vf" ]] && rm "$vf" && log_info "Cleared stale VERIFICATION.md for $feat phase $phase"
  fi
}

# ── Argument parsing ──────────────────────────────────────────────────────────

usage() {
  sed -n '3,18p' "$0"; exit 1
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    epic|feature)
      MODE="$1"; shift
      [[ $# -gt 0 && "${1-}" != --* ]] && { TARGET_ID="$1"; shift; } \
        || { echo "ERROR: Missing ID after '$MODE'" >&2; usage; }
      ;;
    --dry-run)      DRY_RUN=true; shift ;;
    --start-server) START_SERVER=true; shift ;;
    --port)         DEV_PORT="$2"; shift 2 ;;
    --app-dir)      APP_DIR="$2"; shift 2 ;;
    --dev-cmd)      DEV_CMD="$2"; shift 2 ;;
    --budget)       MAX_BUDGET_USD="$2"; shift 2 ;;
    --timeout)      CLAUDE_TIMEOUT="$2"; shift 2 ;;
    -h|--help)      usage ;;
    -*)             echo "ERROR: Unknown flag: $1" >&2; usage ;;
    *)
      if [[ -z "$TARGET_ID" ]]; then
        TARGET_ID="$1"; MODE="feature"; shift
      else
        echo "ERROR: Unexpected argument: $1" >&2; usage
      fi
      ;;
  esac
done

[[ -z "$TARGET_ID" ]] && { echo "ERROR: target ID required." >&2; usage; }
[[ -z "$MODE" ]]      && MODE="feature"

# ── Init ──────────────────────────────────────────────────────────────────────

mkdir -p "$LOG_DIR"
LOG_FILE="$LOG_DIR/overnight-$(date +%Y-%m-%d_%H-%M).log"
touch "$LOG_FILE"

[[ -z "$APP_DIR" ]] && APP_DIR=$(detect_app_dir)
[[ -z "$DEV_PORT" ]] && DEV_PORT=$(detect_dev_port)

# Load project env vars so claude -p subprocesses inherit DB credentials
for env_file in "$REPO_ROOT/goed/.env.local" "$REPO_ROOT/goed/.env" "$REPO_ROOT/.env.local" "$REPO_ROOT/.env"; do
  if [[ -f "$env_file" ]]; then
    set -a
    # shellcheck disable=SC1090
    source "$env_file"
    set +a
    log_info "Loaded env: $env_file"
  fi
done

# Trim invocation log to last 30 days
if [[ -f "$INVOCATION_LOG" ]]; then
  local_cutoff=$(( $(date +%s) - 2592000 ))
  awk -v c="$local_cutoff" '$1+0 > c' "$INVOCATION_LOG" \
    > "$INVOCATION_LOG.tmp" && mv "$INVOCATION_LOG.tmp" "$INVOCATION_LOG" 2>/dev/null || true
fi

banner "overnight-run — ${MODE^^} ${TARGET_ID}"
log_info "Log:     $LOG_FILE"
log_info "Budget:  \$${MAX_BUDGET_USD}/invocation  |  Timeout: ${CLAUDE_TIMEOUT}s"
$DRY_RUN    && log_info "Mode:    DRY RUN (no Claude calls)"
$START_SERVER && log_info "Server:  auto-start before verify steps (port $DEV_PORT)"
log_raw ""

cd "$REPO_ROOT"

# ── Main loop ─────────────────────────────────────────────────────────────────

consecutive_failures=0
MAX_CONSECUTIVE_FAILURES=5
RUN_START=$(date +%s)

while true; do
  # ── 1. Determine next action from file state ────────────────────────────
  action=$(next_action "$MODE" "$TARGET_ID")

  if [[ "$action" == "done" ]]; then
    duration=$(( ( $(date +%s) - RUN_START ) / 60 ))
    banner "COMPLETE ✓ — ${MODE^^} ${TARGET_ID}"
    log_ok "All done in ${duration}m. Log: $LOG_FILE"
    exit 0
  fi

  if [[ "$action" == error:* ]]; then
    log_err "State error: ${action#error:}"
    log_err "Investigate manually, then re-run this script."
    exit 1
  fi

  if [[ -z "$action" ]]; then
    log_err "next_action returned empty string — likely a bash error in state detection."
    log_err "Check .project/ files manually and re-run."
    exit 1
  fi

  # ── 2. Build prompt and label ───────────────────────────────────────────
  label=$(action_label "$action")
  log_action "$label"

  prompt=$(build_prompt "$action") || { log_err "Failed to build prompt for: $action"; exit 1; }

  # ── 3. Pre-action hook (start dev server before verify, etc.) ─────────
  pre_action_hook "$action"

  # ── 4. Run ONE Claude invocation (dry-run: print and exit) ─────────────
  if [[ "$DRY_RUN" == true ]]; then
    log_info "Next action: $action"
    log_info "Prompt preview:"
    printf '%s\n' "$prompt" | head -10
    log_info "(dry-run: exiting after first action)"
    exit 0
  fi

  if run_claude "$label" "$prompt"; then
    consecutive_failures=0

    # ── 5. Post-action hook (link new features, clear stale verification) ─
    post_action_hook "$action"

    log_info "Pausing ${ACTION_PAUSE}s before next action..."
    sleep "$ACTION_PAUSE"
  else
    (( consecutive_failures++ )) || true
    log_warn "Action failed ($consecutive_failures/$MAX_CONSECUTIVE_FAILURES consecutive)."

    if (( consecutive_failures >= MAX_CONSECUTIVE_FAILURES )); then
      log_err "Too many consecutive failures. Stopping."
      log_err "Fix the issue manually and re-run — the script will resume from where it left off."
      exit 1
    fi

    backoff=$(( 30 * consecutive_failures ))
    log_info "Backing off ${backoff}s before retrying..."
    sleep "$backoff"
  fi

  # Loop — re-analyze state and pick next action
done
