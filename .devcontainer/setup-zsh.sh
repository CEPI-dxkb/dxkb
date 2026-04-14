#!/bin/bash
set -e

echo "==> Installing oh-my-zsh..."
if [ ! -d "$HOME/.oh-my-zsh" ]; then
  git clone --depth=1 https://github.com/ohmyzsh/ohmyzsh.git "$HOME/.oh-my-zsh"
fi

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
OMZ_CUSTOM="${ZSH_CUSTOM:-$HOME/.oh-my-zsh/custom}"

echo "==> Cloning custom plugins..."

# fzf-tab
if [ ! -d "$OMZ_CUSTOM/plugins/fzf-tab" ]; then
  git clone --depth=1 https://github.com/Aloxaf/fzf-tab.git "$OMZ_CUSTOM/plugins/fzf-tab"
fi

# zsh-shift-select
if [ ! -d "$OMZ_CUSTOM/plugins/zsh-shift-select" ]; then
  git clone --depth=1 https://github.com/jirutka/zsh-shift-select.git "$OMZ_CUSTOM/plugins/zsh-shift-select"
fi

# zsh-autocomplete
if [ ! -d "$OMZ_CUSTOM/plugins/zsh-autocomplete" ]; then
  git clone --depth=1 https://github.com/marlonrichert/zsh-autocomplete.git "$OMZ_CUSTOM/plugins/zsh-autocomplete"
fi

# zsh-autosuggestions
if [ ! -d "$OMZ_CUSTOM/plugins/zsh-autosuggestions" ]; then
  git clone --depth=1 https://github.com/zsh-users/zsh-autosuggestions.git "$OMZ_CUSTOM/plugins/zsh-autosuggestions"
fi

# fast-syntax-highlighting
if [ ! -d "$OMZ_CUSTOM/plugins/fast-syntax-highlighting" ]; then
  git clone --depth=1 https://github.com/zdharma-continuum/fast-syntax-highlighting.git "$OMZ_CUSTOM/plugins/fast-syntax-highlighting"
fi

echo "==> Installing eza..."
if ! command -v eza &>/dev/null; then
  sudo apt-get update && sudo apt-get install -y eza
fi

echo "==> Installing fzf (required by fzf-tab)..."
if ! command -v fzf &>/dev/null; then
  sudo apt-get update && sudo apt-get install -y fzf
fi

echo "==> Setting up gh aliases..."
gh alias set --shell grsync 'repo_path=$(git config --get remote.origin.url | sed -E "s/.*[/:](.*\/.*)(\.git)?$/\1/" | sed "s/\.git$//"); current_branch=$(git rev-parse --abbrev-ref HEAD); if [ -z "$repo_path" ]; then echo "Error: Not in a git repository"; exit 1; fi; echo "Syncing $repo_path to GitHub w/ branch $current_branch"; gh repo sync "$repo_path" -b "$current_branch"'
gh alias set gsf grsync

echo "==> Copying .zshrc..."
cp "$SCRIPT_DIR/zshrc" "$HOME/.zshrc"

echo "==> zsh setup complete!"
