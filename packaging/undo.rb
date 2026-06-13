# Homebrew formula for the `undo` CLI.
#
# Place this in a tap repo (e.g. github.com/tathagat22/homebrew-tap as
# Formula/undo.rb), then:  brew install tathagat22/tap/undo
#
# The sha256 values are filled in after a release is cut — see RELEASING.md.
# `brew bump-formula-pr` can update url + sha256 automatically on new versions.
class Undo < Formula
  desc "Ctrl-Z for AI agents — a universal, reversible side-effect time machine"
  homepage "https://github.com/tathagat22/agent-undo"
  version "0.1.0"
  license "MIT"

  on_macos do
    on_arm do
      url "https://github.com/tathagat22/agent-undo/releases/download/v#{version}/undo-v#{version}-aarch64-apple-darwin.tar.gz"
      sha256 "REPLACE_WITH_RELEASE_SHA256"
    end
    on_intel do
      url "https://github.com/tathagat22/agent-undo/releases/download/v#{version}/undo-v#{version}-x86_64-apple-darwin.tar.gz"
      sha256 "REPLACE_WITH_RELEASE_SHA256"
    end
  end

  on_linux do
    on_arm do
      url "https://github.com/tathagat22/agent-undo/releases/download/v#{version}/undo-v#{version}-aarch64-unknown-linux-gnu.tar.gz"
      sha256 "REPLACE_WITH_RELEASE_SHA256"
    end
    on_intel do
      url "https://github.com/tathagat22/agent-undo/releases/download/v#{version}/undo-v#{version}-x86_64-unknown-linux-gnu.tar.gz"
      sha256 "REPLACE_WITH_RELEASE_SHA256"
    end
  end

  def install
    bin.install "undo"
  end

  test do
    assert_match "undo", shell_output("#{bin}/undo version")
  end
end
