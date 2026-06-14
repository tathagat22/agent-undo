<p align="center">
  <img src="docs/banner.svg" alt="walkback — Undo anything your AI agent does" width="620">
</p>

<p align="center">
  <a href="https://github.com/tathagat22/walkback/actions/workflows/ci.yml"><img src="https://github.com/tathagat22/walkback/actions/workflows/ci.yml/badge.svg" alt="CI"></a>
  <a href="https://www.npmjs.com/package/walkback"><img src="https://img.shields.io/npm/v/walkback?label=npm&color=cb3837" alt="npm"></a>
  <a href="https://crates.io/crates/walkback-core"><img src="https://img.shields.io/crates/v/walkback-core?label=crates.io&color=e6a141" alt="crates.io"></a>
  <a href="LICENSE"><img src="https://img.shields.io/badge/license-MIT-6366f1" alt="MIT"></a>
  <a href="https://tathagat22.github.io/walkback/"><img src="https://img.shields.io/badge/docs-site-22d3ee" alt="docs"></a>
</p>

<p align="center"><b>When you let an AI agent loose on your machine, <code>walkback</code> records every change it makes to the real world and lets you reverse all of it with one command.</b></p>

---

The thing stopping people from running agents in full-auto isn't intelligence — it's **fear**. An agent edits 15 files, deletes a folder, runs a migration, sends an email, fires off an API call. If it screws up, the files are *maybe* recoverable. The deleted folder, the DB row, the sent email, the network call? **No undo exists anywhere.**

`undo` is that undo. Act freely, because everything is reversible.

```console
$ walkback watch                       # arm it — now any agent's changes are reversible

  ... agent wipes a secret, deletes auth.ts, dumps junk, POSTs a charge ...

$ walkback diff                        # see exactly what it did
$ walkback rollback                    # rewind all of it
  ✓ rewound to cp001
```

## Works with any AI agent

`undo` is **not tied to any model, vendor, or IDE.** Every agent does one thing in common — it changes files on disk — so undo meets it at whichever layer is convenient:

| Your setup | Turn it on | Covers |
|---|---|---|
| **Anything** — Cursor, Copilot, Windsurf, Aider, custom scripts, even you | `walkback watch` | Snapshots, then watches the filesystem. Reversible no matter what made the change. |
| **Any CLI agent** | `walkback run -- <agent-cmd>` | Wraps the command; snapshots first, reversible after. |
| **Any MCP client** | add the [MCP server](#mcp-server) | The agent calls `undo_checkpoint` / `undo_track` / `undo_rollback` itself. |
| **Claude Code** | `walkback protect` | Native PreToolUse hook — auto-checkpoints every session, zero effort. |

## Install

The **CLI** works on macOS, Linux, and Windows — no Node required:

```bash
cargo install walkback-core            # via crates.io (installs the `undo` binary)
brew install tathagat22/tap/walkback   # via Homebrew
curl -fsSL https://raw.githubusercontent.com/tathagat22/walkback/main/packaging/install.sh | sh
```

The **MCP server** (for MCP clients like Cursor / Claude):

```bash
npx -y walkback
```

## What it reverses

One consistent model — record a change with its inverse, replay the inverse on rollback — across every domain. Anything that touches the outside world is **dry-run gated**: undo shows you what it *would* do and never fires blindly.

### 📁 Files — byte-perfect, crash-safe
Create / modify / delete / directories / symlinks / permissions, all restored exactly. A content-addressed blob store means even large and binary files come back byte-for-byte. Plus **redo**, and **selective** per-file revert.

```bash
walkback rollback              # rewind everything since the checkpoint
walkback revert src/auth.ts    # ...or just one file
walkback redo                  # ...changed your mind
```

### 🔍 `walkback diff` — review before you trust
A PR-style view of exactly what the agent changed, built from undo's own before-snapshots:

```diff
 src/auth.ts  modified  +2 -2
  -const KEY = "prod-secret"
  +const KEY = ""
 src/new.ts   new  +1 -0
  +export const added = true
 2 file(s) changed, +3 -2
```

### 🌐 Network calls — actually reversed
When the agent records a mutation with a **compensator** (the request that reverses it), undo runs it:

```
agent: POST /v1/charges          → records a refund as the compensator
undo_compensate                  → preview: "WOULD send the refund"
undo_compensate execute=true     → fires it, most-recent-first
```

### ✉️ Email — honest hold-and-release
No tool can recall a *delivered* email — the recipient has a copy nothing can touch. So undo does the one honest thing that works: it **holds the email as a draft** that has gone nowhere.

```
undo_email_stage    to=… subject=… body=…   # held, NOT sent
undo_email_cancel                            # delete the draft → it never existed
undo_email_release                           # ...or actually deliver it
```

**Before release:** cancel is a true unsend. **After delivery:** it's gone, and undo says so plainly — the most it can do then is trash *your* copy. We don't pretend to reach into other people's inboxes. Works with **Gmail** (`GMAIL_ACCESS_TOKEN`) and **Outlook / Microsoft 365** (`OUTLOOK_ACCESS_TOKEN`); undo holds no credentials of its own.

### ☁️ Cloud & databases — any tool
undo doesn't hardcode AWS or Postgres. The agent records the **command that reverses** what it did, and undo runs it (dry-run gated):

```
undo_record_reversal  description="created S3 bucket assets-prod"  command="aws s3 rb s3://assets-prod --force"
undo_record_reversal  description="ran migration 042"             command="psql $DB -f rollback_042.sql"
undo_compensate execute=true
```

Works with **any** cloud, database, or CLI. (For DB `UPDATE`/`DELETE`, you record the inverse — undo runs what you give it.)

## CLI

```
walkback init                      set up undo in this directory
walkback checkpoint [label]        mark a point you can rewind to
walkback track <path>...           capture a path before the agent changes it
walkback status                    what's changed since the last checkpoint
walkback diff                      a PR-style diff of everything the agent changed
walkback rollback [checkpoint]     rewind everything since a checkpoint
walkback revert <path>             selectively undo just one file
walkback redo                      undo the last rollback
walkback watch                     snapshot + watch the filesystem (any agent)
walkback run -- <command>          snapshot, then run any command reversibly
walkback protect / unprotect       install / remove the Claude Code auto-capture hook
```

## MCP server

Add to your MCP client's config (e.g. `.mcp.json`):

```json
{ "mcpServers": { "undo": { "command": "npx", "args": ["-y", "walkback"] } } }
```

**16 tools:** `undo_init` · `undo_checkpoint` · `undo_track` · `undo_status` · `undo_diff` · `undo_log` · `undo_rollback` · `undo_revert` · `undo_redo` · `undo_record_http` · `undo_record_reversal` · `undo_compensate` · `undo_email_stage` · `undo_email_release` · `undo_email_cancel` · `undo_email_pending`

The server ships **instructions** (auto-injected into the agent's context) telling the agent to checkpoint first and **record the inverse** of any network / cloud / DB / email action — because undo can reverse files automatically, but it can't *guess* the inverse of a network call. Not using MCP? Paste the same policy into your agent's system prompt: see [docs/agent-instructions.md](docs/agent-instructions.md).

## Architecture

A polyglot system with a real native boundary:

```
┌─────────────────────────────┐
│  TypeScript  (agent surface) │   MCP server · compensation · email · reversals
├─────────────────────────────┤   ↕ NAPI-RS (in-process, no subprocess)
│  Rust  (the engine)          │   Effect · Journal · blob store · rollback · diff
│   crates/walkback-core           │   + the standalone `undo` CLI
└─────────────────────────────┘
```

Rust owns the part that touches your filesystem and has to be fast and trustworthy; TypeScript owns the agent-facing surface; NAPI-RS bridges them in-process.

## Why you can trust it

A universal undo is only worth anything if it's correct under pressure:

- **Crash-safe** — journal/state written write-temp-then-rename (atomic on POSIX).
- **Rollback integrity** — if any step fails, the journal is left intact and it's safe to retry; never reports success while leaving files unrestored.
- **Concurrency-safe** — an exclusive lock, so an agent and a human can't corrupt the journal.
- **Sandboxed** — refuses paths outside the project, never captures `.undo`, auto-gitignores snapshots so secrets aren't committed.

This is tested, not asserted: unit tests per property, a **property test** that runs dozens of randomized mutation sequences and asserts byte-for-byte round-trips, a **concurrency test** that hammers one journal from many threads, and Node suites that drive real HTTP/Gmail/command reversals against mock servers. The engine suite runs in CI on **Linux, macOS, and Windows**.

> **Platform note:** the engine is verified on all three OSes. On Windows, content + structure + mtime restore exactly; unix permission bits and symlink fidelity are POSIX-only (they no-op rather than fail).

## License

MIT © Tathagat Maitray
