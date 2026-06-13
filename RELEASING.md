# Releasing

How to cut a release of `undo`. Everything irreversible (publishing) is a
deliberate, manual step gated on a secret you control.

## One-time setup

1. **crates.io token** — create a token at <https://crates.io/settings/tokens>,
   then add it as the repo secret `CARGO_REGISTRY_TOKEN`
   (Settings → Secrets and variables → Actions). The CLI crate is `undo-core`.
2. **npm scope** — create the free org `@agent-undo` at
   <https://www.npmjs.com/org/create> (public packages are free). Then create an
   npm automation token and add it as the repo secret `NPM_TOKEN`.
3. **Homebrew tap** (optional) — create a repo `homebrew-tap` under your account.

## Cutting a release

1. Bump the version in the workspace `Cargo.toml` (`[workspace.package].version`)
   and the npm `package.json` files, keeping them in sync.
2. Commit, then tag and push:
   ```bash
   git tag v0.1.0
   git push origin v0.1.0
   ```
3. The **Release** workflow (`.github/workflows/release.yml`) then:
   - builds the prebuilt `undo` CLI for macOS (arm64/x64), Linux (arm64/x64),
     and Windows (x64), and attaches them to the GitHub Release for the tag;
   - publishes `undo-core` to **crates.io** (if `CARGO_REGISTRY_TOKEN` is set).

That alone makes the CLI installable everywhere:

```bash
cargo install undo-core                                   # via crates.io
curl -fsSL https://raw.githubusercontent.com/tathagat22/agent-undo/main/packaging/install.sh | sh   # prebuilt binary
```

## npm (MCP server + native engine)

The npm packages ship prebuilt NAPI binaries so users need no Rust toolchain.
The `release-npm.yml` workflow builds the `.node` for each platform and publishes
`@agent-undo/engine-<platform>` packages plus the main `@agent-undo/core`.
Requires `NPM_TOKEN` and the `@agent-undo` org (see setup). Until then, the MCP
server still works from source: `npm install && npm run build:engine && npm run build`.

## Homebrew

After the GitHub Release exists, fill the `sha256` values in `packaging/undo.rb`
(download each `.tar.gz` and run `shasum -a 256`), copy it into your tap as
`Formula/undo.rb`, and commit. Then:

```bash
brew install tathagat22/tap/undo
```

On future releases, `brew bump-formula-pr --url=… undo` updates url + sha256 for you.
