//! End-to-end tests for the Phase 2 auto-capture commands, driving the real
//! compiled `undo` binary exactly as Claude Code and a shell would.

use std::fs;
use std::io::Write;
use std::path::PathBuf;
use std::process::{Command, Stdio};

fn bin() -> &'static str {
    env!("CARGO_BIN_EXE_walkback")
}

fn tmp() -> PathBuf {
    use std::sync::atomic::{AtomicU64, Ordering};
    static COUNTER: AtomicU64 = AtomicU64::new(0);
    let n = COUNTER.fetch_add(1, Ordering::Relaxed);
    let base = std::env::temp_dir().join(format!("undo-cli-{}-{}", std::process::id(), n));
    fs::create_dir_all(&base).unwrap();
    base
}

fn run(dir: &PathBuf, args: &[&str]) {
    let status = Command::new(bin())
        .current_dir(dir)
        .args(args)
        .status()
        .unwrap();
    assert!(status.success(), "`undo {}` failed", args.join(" "));
}

#[test]
fn undo_run_snapshots_then_reverses() {
    let dir = tmp();
    fs::write(dir.join("data.txt"), b"v1").unwrap();

    // `undo run -- <cmd>` snapshots up front, then runs the command. We wrap a
    // trivial cross-platform command (undo itself) so this runs on every OS; the
    // guarantee under test is that changes made *after* the snapshot reverse.
    let status = Command::new(bin())
        .current_dir(&dir)
        .args(["run", "--", bin(), "version"])
        .status()
        .unwrap();
    assert!(
        status.success(),
        "undo run should exit with the command's code"
    );

    fs::write(dir.join("data.txt"), b"WRECKED").unwrap();
    fs::write(dir.join("extra.txt"), b"added after snapshot").unwrap();

    run(&dir, &["rollback"]);
    assert_eq!(fs::read(dir.join("data.txt")).unwrap(), b"v1");
    assert!(!dir.join("extra.txt").exists());
    fs::remove_dir_all(&dir).ok();
}

#[test]
fn hook_auto_checkpoints_so_edits_are_reversible() {
    let dir = tmp();
    fs::write(dir.join("app.js"), b"GOOD").unwrap();

    // Escape backslashes so Windows paths (C:\...) form valid JSON.
    let d = dir.display().to_string().replace('\\', "\\\\");
    let json = format!(
        r#"{{"session_id":"s1","cwd":"{d}","tool_name":"Edit","tool_input":{{"file_path":"{d}/app.js"}}}}"#
    );

    // Feed the PreToolUse JSON to `undo hook` on stdin, as Claude Code does.
    let mut child = Command::new(bin())
        .current_dir(&dir)
        .arg("hook")
        .stdin(Stdio::piped())
        .spawn()
        .unwrap();
    child
        .stdin
        .take()
        .unwrap()
        .write_all(json.as_bytes())
        .unwrap();
    assert!(
        child.wait().unwrap().success(),
        "the hook must always exit 0 (never block the agent)"
    );

    // The agent (no cooperation) wrecks the file.
    fs::write(dir.join("app.js"), b"BROKEN").unwrap();

    run(&dir, &["rollback"]);
    assert_eq!(
        fs::read(dir.join("app.js")).unwrap(),
        b"GOOD",
        "the hook made the edit reversible with zero agent involvement"
    );
    fs::remove_dir_all(&dir).ok();
}

#[test]
fn watch_baseline_makes_any_change_reversible() {
    let dir = tmp();
    fs::write(dir.join("f.txt"), b"BASE").unwrap();

    // `--once` takes the baseline snapshot and returns (no daemon loop), which
    // is the agent-agnostic guarantee: anything that changes afterwards reverses.
    run(&dir, &["watch", "--once"]);

    fs::write(dir.join("f.txt"), b"SOME AGENT EDITED THIS").unwrap();
    fs::write(dir.join("extra.txt"), b"and added this").unwrap();

    run(&dir, &["rollback"]);
    assert_eq!(fs::read(dir.join("f.txt")).unwrap(), b"BASE");
    assert!(!dir.join("extra.txt").exists(), "agent-added file pruned");
    fs::remove_dir_all(&dir).ok();
}

#[test]
fn protect_installs_then_unprotect_removes_the_hook() {
    let dir = tmp();
    run(&dir, &["protect"]);

    let matchers = |dir: &PathBuf| {
        fs::read_to_string(dir.join(".claude/settings.local.json"))
            .unwrap()
            .matches("\"matcher\"")
            .count()
    };

    let settings = fs::read_to_string(dir.join(".claude/settings.local.json")).unwrap();
    assert!(settings.contains("PreToolUse"));
    assert!(settings.contains("Edit|Write|MultiEdit|NotebookEdit|Bash"));
    assert_eq!(matchers(&dir), 1, "one hook entry after protect");

    // Running protect twice must not duplicate the hook (one matcher per entry).
    run(&dir, &["protect"]);
    assert_eq!(matchers(&dir), 1, "protect must be idempotent");

    run(&dir, &["unprotect"]);
    assert_eq!(matchers(&dir), 0, "unprotect should remove our hook");
    fs::remove_dir_all(&dir).ok();
}
