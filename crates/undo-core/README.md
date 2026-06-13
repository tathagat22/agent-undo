# undo-core

**Ctrl-Z for AI agents.** The reversible side-effect engine behind [`undo`](https://github.com/tathagat22/agent-undo), plus the `undo` command-line tool.

When you let an AI agent (Cursor, Claude, Copilot, Aider, or your own) loose on your machine, `undo` records every change it makes and reverses all of it with one command — files, directories, permissions, and symlinks restored exactly, crash-safely, under a lock, with redo.

## Install the CLI

```bash
cargo install undo-core      # installs the `undo` binary
```

## Use it

```bash
undo watch                   # snapshot + watch the project — reversible for ANY agent
undo run -- <agent-command>  # snapshot, then run any command reversibly
undo rollback                # rewind everything since the snapshot
undo redo                    # ...changed your mind
```

## Use it as a library

```rust
use undo_core::Undo;

let u = Undo::init(std::path::Path::new("."))?;
u.checkpoint("before agent")?;
u.track(std::path::Path::new("src"))?;   // capture before the agent acts
// ... agent runs ...
u.rollback(None)?;                        // exact restore
```

Filesystem effects are fully reversible today; the same `Effect` journal is built to carry network, email, and database effects without changing the rollback path.

See the [main project](https://github.com/tathagat22/agent-undo) for the MCP server, the auto-capture hooks, and the full story.

## License

MIT
