# Homebrew formula for the optimize-pilot CLI (the standalone token optimizer).
#
# This installs the `optimize-pilot` command (claude/cli.js) — the same engine
# as the VS Code extension and Claude Code plugin, usable in any shell pipe:
#
#   noisy-command 2>&1 | optimize-pilot          # compress command output
#   optimize-pilot --prompt  < prompt.txt        # compress a prose prompt
#   optimize-pilot --discover < prompt.txt       # dry-run savings report
#
# Distribute via a tap repo named `thavionai/homebrew-tap`, then users run:
#
#   brew install thavionai/tap/optimize-pilot
#
# To cut a release: tag v0.1.0 on GitHub, then update `sha256` below with:
#   curl -sL https://github.com/thavionai/optimize-pilot/archive/refs/tags/v0.1.0.tar.gz | shasum -a 256
class OptimizePilot < Formula
  desc "Deterministic two-way token optimizer — compress prompts and command output"
  homepage "https://github.com/thavionai/optimize-pilot"
  url "https://github.com/thavionai/optimize-pilot/archive/refs/tags/v0.1.0.tar.gz"
  sha256 "f717620528c76b661da031766332a9a2d793190848e46f9106d13e54eda758bd"
  license "MIT"
  head "https://github.com/thavionai/optimize-pilot.git", branch: "main"

  depends_on "node"

  def install
    # The CLI is dependency-free; ship the engine + entrypoint as-is.
    libexec.install "claude"
    node = Formula["node"].opt_bin/"node"
    (bin/"optimize-pilot").write <<~SH
      #!/bin/bash
      exec "#{node}" "#{libexec}/claude/cli.js" "$@"
    SH
  end

  test do
    # Politeness is stripped: "please do it" -> "do it".
    assert_match "do it", pipe_output("#{bin}/optimize-pilot --prompt", "please do it", 0)
  end
end
