#!/bin/bash

set -e  # Exit on error
set -o pipefail  # Catch errors in pipes

# Check if a URL and hash are provided
if [ -z "$1" ] || [ -z "$2" ]; then
    echo "❌ Error: Missing arguments."
    echo "Usage: $0 <URL> <EXPECTED_HASH>"
    exit 1
fi

REMOTE_URL="$1"
EXPECTED_HASH="$2"

# Temporary directory for verification
VERIFY_DIR="squads-public-verify"
rm -rf "$VERIFY_DIR"
mkdir -p "$VERIFY_DIR"

validate_manifest_path() {
  local file="$1"

  # Allow public asset paths like "/assets/app.js" by making them relative.
  while [[ "$file" == /* ]]; do
    file="${file#/}"
  done

  while [[ "$file" == ./* ]]; do
    file="${file#./}"
  done

  if [[ -z "$file" || "$file" == "." ]]; then
    echo "❌ Error: Empty or invalid manifest path." >&2
    exit 1
  fi

  if [[ "$file" == ".." || "$file" == "../"* || "$file" == *"/../"* || "$file" == *"/.." ]]; then
    echo "❌ Error: Unsafe manifest path: $1" >&2
    exit 1
  fi

  printf '%s\n' "$file"
}

# Function to prompt user for installation
install_package() {
    PACKAGE=$1
    if [[ "$OSTYPE" == "linux-gnu"* ]]; then
        echo "💡 Would you like to install '$PACKAGE' now? (y/n)"
        read -r INSTALL_CONFIRM
        if [[ "$INSTALL_CONFIRM" == "y" || "$INSTALL_CONFIRM" == "Y" ]]; then
            if command -v apt &> /dev/null; then
                sudo apt update && sudo apt install -y "$PACKAGE"
            elif command -v yum &> /dev/null; then
                sudo yum install -y "$PACKAGE"
            elif command -v pacman &> /dev/null; then
                sudo pacman -S "$PACKAGE" --noconfirm
            else
                echo "❌ Error: Package manager not detected. Please install $PACKAGE manually."
                exit 1
            fi
        else
            echo "❌ $PACKAGE is required. Please install it manually."
            exit 1
        fi
    elif [[ "$OSTYPE" == "darwin"* ]]; then
        echo "💡 Would you like to install '$PACKAGE' using Homebrew? (y/n)"
        read -r INSTALL_CONFIRM
        if [[ "$INSTALL_CONFIRM" == "y" || "$INSTALL_CONFIRM" == "Y" ]]; then
            if command -v brew &> /dev/null; then
                brew install "$PACKAGE"
            else
                echo "❌ Error: Homebrew is not installed. Install it from https://brew.sh/"
                exit 1
            fi
        else
            echo "❌ $PACKAGE is required. Please install it manually."
            exit 1
        fi
    else
        echo "❌ Unsupported OS. Please install $PACKAGE manually."
        exit 1
    fi
}

# Ensure wget is installed
if ! command -v wget &> /dev/null; then
    echo "❌ Error: 'wget' is required but not installed."
    install_package "wget"
fi

# Ensure jq is installed
if ! command -v jq &> /dev/null; then
    echo "❌ Error: 'jq' (JSON processor) is required but not installed."
    install_package "jq"
fi

echo "🌍 Fetching manifest from: $REMOTE_URL/manifest.json..."

# Download the manifest first
wget -q -O "$VERIFY_DIR/manifest.json" "$REMOTE_URL/manifest.json"

if [ ! -f "$VERIFY_DIR/manifest.json" ]; then
    echo "❌ Error: Manifest file not found at $REMOTE_URL/manifest.json"
    exit 1
fi

# Parse manifest to get file list
echo "📜 Fetching files listed in manifest.json..."
jq -r '.[]' "$VERIFY_DIR/manifest.json" | while IFS= read -r FILE; do
  SAFE_FILE="$(validate_manifest_path "$FILE")"

  FILE_URL="$REMOTE_URL/$SAFE_FILE"
  FILE_PATH="$VERIFY_DIR/$SAFE_FILE"

  # Ensure target directory exists
  mkdir -p "$(dirname "$FILE_PATH")"

  # Download the file
  echo "⬇️ Downloading $SAFE_FILE..."
  wget -q --no-clobber -O "$FILE_PATH" "$FILE_URL"
done

# Compute hash for verification
echo "🔍 Computing hash..."
COMPUTED_HASH=$(cd "$VERIFY_DIR" && find . -type f -print0 | sort -z | xargs -0 cat | sha256sum | awk '{ print $1 }')

echo "✅ Expected Hash: $EXPECTED_HASH"
echo "🔍 Computed Hash: $COMPUTED_HASH"

# Compare hashes
if [ "$EXPECTED_HASH" == "$COMPUTED_HASH" ]; then
    echo "🎉 Build verification SUCCESSFUL! The downloaded site is authentic."
    exit 0
else
    echo "❌ Build verification FAILED! The downloaded site does not match the expected hash."
    exit 1
fi
