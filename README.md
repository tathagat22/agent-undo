# undo — Ctrl-Z for AI agents

> When you let an AI agent loose on your machine, `undo` records **every change it makes to the real world** and lets you reverse all of it with one command.

The thing stopping people from running agents in full-auto isn't intelligence — it's **fear**. An agent edits 15 files, deletes a folder, runs a migration, fires off an API call. If it screws up, the files are *maybe* recoverable (if you committed to git) — but the deleted folder, the DB row, the sent email, the network call? **No undo exists anywhere.**

`undo` is that undo. Act freely, because everything is reversible.

```
$ undo checkpoint "before the agent runs"
  ✓ checkpoint cp001

  ... agent wipes a secret, deletes auth.ts, dumps junk, POSTs a charge ...

$ undo rollback
  ✓ rewound to cp001
    ⟲ created  experimental.ts
    ⟲ modified auth.ts
    ⟲ modified config.ts
    •  POST https://api.stripe.com/v1/charges (manual — compensating refund recorded)
```

Two seconds later it's like it never happened.

---

## How it works

Every action an agent takes becomes a journal entry that knows **how to reverse itself** — think *git + a flight recorder, but for side effects instead of just files*.

```
checkpoint "before refactor"
  ├─ modified  src/auth.ts        → restore prior contents (byte-perfect)
  ├─ created   src/session.ts     → delete it
  ├─ deleted   legacy/old.ts      → recreate from snapshot
  ├─ ran       npm run migrate    → audited
  └─ POST      api.com/charges    → compensating DELETE recorded
```

Prior file contents are captured into a git-style **content-addressed blob store** (`.undo/objects/`), so even large and binary files restore exactly. Rollback walks the effects since a checkpoint, applies each one's inverse in reverse order, and truncates the journal back to that point.

## Architecture

A polyglot system with a real native boundary:

```
┌─────────────────────────────┐
│  TypeScript  (agent surface) │   MCP server  ·  programmatic API
│     src/mcp.ts  ·  index.ts  │
└──────────────┬──────────────┘
               │  NAPI-RS (in-process, no subprocess)
┌──────────────┴──────────────┐
│  Rust  (the engine)          │   Effect · Journal · blob store · rollback
│   crates/undo-core           │   + standalone `undo` CLI
│   crates/undo-napi           │
└─────────────────────────────┘
```

- **Rust** owns the part that touches your filesystem and has to be fast and trustworthy.
- **TypeScript** owns the agent-facing MCP server and ergonomics.
- **NAPI-RS** bridges them in-process — TS calls Rust directly, no IPC.

## Install

**The CLI** (Rust):

```bash
cargo install --path crates/undo-core
undo --help
```

**The MCP server** (for agents like Claude Code):

```bash
npm install            # installs deps
npm run build:engine   # builds the native Rust engine
npm run build          # compiles the TypeScript
```

## Use it with Claude Code

Add to your `.mcp.json`:

```json
{
  "mcpServers": {
    "undo": {
      "command": "node",
      "args": ["/absolute/path/to/agent-undo/dist/mcp.js"]
    }
  }
}
```

Then tell your agent: *"Before you start, checkpoint with undo and track every file you touch."* The agent calls `undo_checkpoint` and `undo_track` as it works; you call `undo_rollback` (or ask it to) if anything goes sideways.

### MCP tools

| Tool | What it does |
|---|---|
| `undo_init` | Set up the time machine in a project |
| `undo_checkpoint` | Mark a point you can rewind to |
| `undo_track` | Capture files before the agent changes them |
| `undo_record_http` | Log a network mutation + its compensating request |
| `undo_status` | What's changed since the checkpoint |
| `undo_log` | The full history |
| `undo_rollback` | Rewind everything since a checkpoint |

## CLI

```
undo init                      set up undo in this directory
undo checkpoint [label]        mark a point you can rewind to
undo track <path>...           capture a file before the agent changes it
undo status                    what's changed since the last checkpoint
undo log                       the full history
undo rollback [checkpoint]     rewind everything since a checkpoint
```

## Try the demo

```bash
npm run demo        # in-process Rust engine: agent trashes a project, one button restores it
npm run mcp -- ...  # or run the MCP server on stdio
npx tsx demo/mcp-smoke.ts   # drives the real MCP server through a full scenario
```

## What's reversible today, and what's next

**Today (v0):** filesystem create / modify / delete, fully reversed. Shell commands and HTTP mutations are recorded (with compensating requests) and surfaced for manual handling.

**Roadmap — the part nobody has built:**

- **HTTP mutation reversal** — auto-run the compensating request to undo a network call
- **Email undo** — recall/delete within the provider's window
- **Database journaling** — capture inverse SQL, roll back a migration
- **Cloud-resource reversal** — tear down infra the agent spun up
- **Selective undo** — reverse just the email, keep the file edits
- **`undo diff`** — "show me everything the AI changed," reviewable like a PR
- **Redo** — roll forward again after rolling back

The novel core is the `Effect` abstraction: anything that can describe its own inverse plugs into the *same* journal and the *same* one-button rollback. Filesystem-only undo exists; **heterogeneous, cross-system undo does not.** That uniform reversibility layer is the point.

## License

MIT
