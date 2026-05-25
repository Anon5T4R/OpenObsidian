#!/usr/bin/env bash
# install-linux.sh — Install OpenObsidian AppImage + .desktop entry
#
# Usage:
#   chmod +x install-linux.sh
#   ./install-linux.sh [path/to/OpenObsidian-*.AppImage]
#
# If no path is given the script looks for an AppImage in the same directory.

set -euo pipefail

APP_NAME="openobsidian"
DISPLAY_NAME="OpenObsidian"
COMMENT="Open source markdown knowledge base"
CATEGORIES="Utility;Office;TextEditor;"
KEYWORDS="markdown;notes;wiki;knowledge;"

ICON_DIR="$HOME/.local/share/icons/hicolor"
DESKTOP_DIR="$HOME/.local/share/applications"
BIN_DIR="$HOME/.local/bin"

# ── Find AppImage ─────────────────────────────────────────────────────────

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
DIST_DIR="$(cd "$SCRIPT_DIR/.." && pwd)/dist"

if [[ $# -ge 1 ]]; then
  APPIMAGE="$(realpath "$1")"
else
  APPIMAGE="$(ls "$DIST_DIR"/OpenObsidian-*.AppImage 2>/dev/null | head -1 || true)"
fi

if [[ -z "$APPIMAGE" || ! -f "$APPIMAGE" ]]; then
  echo "Error: AppImage not found."
  echo "  Run  npm run dist:linux  first, or pass the path as an argument:"
  echo "  $0 path/to/OpenObsidian-x.y.z.AppImage"
  exit 1
fi

echo "Installing $DISPLAY_NAME from: $APPIMAGE"

# ── Make AppImage executable ──────────────────────────────────────────────

chmod +x "$APPIMAGE"

# ── Copy AppImage to ~/Applications ──────────────────────────────────────

APPS_DIR="$HOME/Applications"
mkdir -p "$APPS_DIR"
DEST="$APPS_DIR/$(basename "$APPIMAGE")"
if [[ "$APPIMAGE" != "$DEST" ]]; then
  cp -f "$APPIMAGE" "$DEST"
  chmod +x "$DEST"
  echo "  Copied to $DEST"
fi

# ── Install icons ─────────────────────────────────────────────────────────

ICON_SOURCE_DIR="$(cd "$SCRIPT_DIR/.." && pwd)/resources/icons"

for SIZE in 16 24 32 48 64 96 128 256 512; do
  SRC="$ICON_SOURCE_DIR/${SIZE}x${SIZE}.png"
  if [[ -f "$SRC" ]]; then
    DEST_DIR="$ICON_DIR/${SIZE}x${SIZE}/apps"
    mkdir -p "$DEST_DIR"
    cp -f "$SRC" "$DEST_DIR/${APP_NAME}.png"
  fi
done

echo "  Icons installed to $ICON_DIR"

# ── Create .desktop entry ─────────────────────────────────────────────────

mkdir -p "$DESKTOP_DIR"

cat > "$DESKTOP_DIR/${APP_NAME}.desktop" <<EOF
[Desktop Entry]
Type=Application
Name=$DISPLAY_NAME
Comment=$COMMENT
Exec=$DEST %u
Icon=$APP_NAME
Terminal=false
Categories=$CATEGORIES
Keywords=$KEYWORDS
StartupWMClass=OpenObsidian
EOF

echo "  .desktop entry created at $DESKTOP_DIR/${APP_NAME}.desktop"

# ── Update icon cache / desktop database ──────────────────────────────────

if command -v gtk-update-icon-cache &>/dev/null; then
  gtk-update-icon-cache -qtf "$ICON_DIR" 2>/dev/null || true
fi

if command -v update-desktop-database &>/dev/null; then
  update-desktop-database -q "$DESKTOP_DIR" 2>/dev/null || true
fi

# ── Optional symlink in ~/bin ─────────────────────────────────────────────

if [[ -d "$BIN_DIR" ]] || mkdir -p "$BIN_DIR" 2>/dev/null; then
  ln -sf "$DEST" "$BIN_DIR/${APP_NAME}"
  echo "  Symlink created at $BIN_DIR/${APP_NAME}"
fi

echo ""
echo "Done. $DISPLAY_NAME is now available in your application launcher."
echo "You can also launch it from the terminal with:  ${APP_NAME}"
