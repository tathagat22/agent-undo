# Homebrew formula for the `walkback` CLI.
#
# Place this in a tap repo (e.g. github.com/tathagat22/homebrew-tap as
# Formula/walkback.rb), then:  brew install tathagat22/tap/walkback
#
# The sha256 values are filled in after a release is cut — see RELEASING.md.
# `brew bump-formula-pr` can update url + sha256 automatically on new versions.
class Walkback < Formula
  desc "Undo anything your AI agent does — a universal, reversible side-effect time machine"
  homepage "https://github.com/tathagat22/walkback"
  version "0.1.0"
  license "MIT"

  on_macos do
    on_arm do
      url "https://github.com/tathagat22/walkback/releases/download/v#{version}/walkback-v#{version}-aarch64-apple-darwin.tar.gz"
      sha256 "REPLACE_WITH_RELEASE_SHA256"
    end
    on_intel do
      url "https://github.com/tathagat22/walkback/releases/download/v#{version}/walkback-v#{version}-x86_64-apple-darwin.tar.gz"
      sha256 "REPLACE_WITH_RELEASE_SHA256"
    end
  end

  on_linux do
    on_arm do
      url "https://github.com/tathagat22/walkback/releases/download/v#{version}/walkback-v#{version}-aarch64-unknown-linux-gnu.tar.gz"
      sha256 "REPLACE_WITH_RELEASE_SHA256"
    end
    on_intel do
      url "https://github.com/tathagat22/walkback/releases/download/v#{version}/walkback-v#{version}-x86_64-unknown-linux-gnu.tar.gz"
      sha256 "REPLACE_WITH_RELEASE_SHA256"
    end
  end

  def install
    bin.install "walkback"
  end

  test do
    assert_match "walkback", shell_output("#{bin}/walkback version")
  end
end
