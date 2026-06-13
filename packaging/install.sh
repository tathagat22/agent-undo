#!/bin/sh
# Install the `undo` CLI — Ctrl-Z for AI agents.
#
#   curl -fsSL https://raw.githubusercontent.com/tathagat22/agent-undo/main/packaging/install.sh | sh
#
# Downloads the prebuilt binary for your platform from the latest GitHub
# Release. No Rust toolchain required. Override with: VERSION=v0.1.0 sh install.sh
set -eu

REPO="tathagat22/agent-undo"
BIN="undo"
INSTALL_DIR="${UNDO_INSTALL_DIR:-$HOME/.local/bin}"

say() { printf '%s\n' "$*"; }
die() { printf 'error: %s\n' "$*" >&2; exit 1; }

# --- detect platform --------------------------------------------------------
os="$(uname -s)"
arch="$(uname -m)"
case "$os" in
  Darwin)
    case "$arch" in
      arm64|aarch64) target="aarch64-apple-darwin" ;;
      x86_64)        target="x86_64-apple-darwin" ;;
      *) die "unsupported macOS arch: $arch" ;;
    esac ;;
  Linux)
    case "$arch" in
      x86_64)         target="x86_64-unknown-linux-gnu" ;;
      aarch64|arm64)  target="aarch64-unknown-linux-gnu" ;;
      *) die "unsupported Linux arch: $arch" ;;
    esac ;;
  *) die "unsupported OS: $os (Windows users: grab the .zip from the Releases page)" ;;
esac

# --- resolve version --------------------------------------------------------
version="${VERSION:-}"
if [ -z "$version" ]; then
  version="$(curl -fsSL "https://api.github.com/repos/$REPO/releases/latest" \
    | grep '"tag_name"' | head -1 | cut -d'"' -f4)"
  [ -n "$version" ] || die "could not determine latest version (set VERSION=v… to override)"
fi

archive="${BIN}-${version}-${target}.tar.gz"
url="https://github.com/$REPO/releases/download/$version/$archive"

say "Installing $BIN $version ($target)…"

# --- download + extract -----------------------------------------------------
tmp="$(mktemp -d)"
trap 'rm -rf "$tmp"' EXIT
curl -fsSL "$url" -o "$tmp/$archive" || die "download failed: $url"
tar -xzf "$tmp/$archive" -C "$tmp" || die "extract failed"
[ -f "$tmp/$BIN" ] || die "binary '$BIN' not found in archive"

# --- install ----------------------------------------------------------------
mkdir -p "$INSTALL_DIR"
install -m 0755 "$tmp/$BIN" "$INSTALL_DIR/$BIN" 2>/dev/null \
  || { cp "$tmp/$BIN" "$INSTALL_DIR/$BIN" && chmod 0755 "$INSTALL_DIR/$BIN"; }

say "✓ installed to $INSTALL_DIR/$BIN"
case ":$PATH:" in
  *":$INSTALL_DIR:"*) ;;
  *) say "  note: add $INSTALL_DIR to your PATH, e.g.:"
     say "        echo 'export PATH=\"$INSTALL_DIR:\$PATH\"' >> ~/.profile" ;;
esac
say "  try it:  $BIN watch"
