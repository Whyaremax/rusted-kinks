#!/usr/bin/env bash
set -euo pipefail

if [[ $# -ne 3 ]]; then
  echo "usage: package-native-manager-linux.sh <build-dir> <output-dir> <arch>" >&2
  exit 2
fi

build_dir="$(realpath "$1")"
output_dir="$(realpath -m "$2")"
arch="$3"
repo_root="$(realpath "$(dirname "$0")/..")"
appdir="$output_dir/KDHybridManager.AppDir"

case "$arch" in
  x86_64|aarch64) ;;
  *) echo "unsupported AppImage architecture: $arch" >&2; exit 2 ;;
esac

case "$appdir" in
  "$output_dir"/*) ;;
  *) echo "refusing unsafe AppDir path: $appdir" >&2; exit 1 ;;
esac

rm -rf -- "$appdir"
mkdir -p "$appdir/usr/bin" "$appdir/usr/share/applications" \
  "$appdir/usr/share/icons/hicolor/scalable/apps" "$appdir/usr/share/licenses" \
  "$appdir/usr/share/kd-hybrid/source"
cp "$build_dir/KDHybridManager" "$appdir/usr/bin/"
cp "$repo_root/native/manager/assets/kd-hybrid-manager.svg" \
  "$appdir/usr/share/icons/hicolor/scalable/apps/kd-hybrid-manager.svg"
cp "$repo_root/LICENSE" "$appdir/usr/share/licenses/KD-Hybrid-MIT.txt"
cp "$repo_root/LICENSES/ACORN-MIT.txt" \
  "$appdir/usr/share/licenses/ACORN-MIT.txt"
cp "$repo_root/LICENSES/MPL-2.0.txt" \
  "$appdir/usr/share/licenses/MPL-2.0.txt"
cp "$repo_root/LICENSES/LGPL-3.0.txt" \
  "$appdir/usr/share/licenses/Qt-LGPL-3.txt"
cp "$repo_root/NOTICE.md" "$appdir/usr/share/licenses/KD-Hybrid-NOTICE.txt"
cp "$repo_root/native/manager/THIRD_PARTY.md" \
  "$appdir/usr/share/licenses/THIRD-PARTY.txt"
printf '%s\n' \
  "Qt source code and licensing information: https://www.qt.io/download-open-source" \
  > "$appdir/usr/share/licenses/Qt-Source-Offer.txt"
cp -R "$repo_root/dist/bootstrap/source/MPL-2.0" \
  "$appdir/usr/share/kd-hybrid/source/"

cat > "$appdir/usr/share/applications/kd-hybrid-manager.desktop" <<'EOF'
[Desktop Entry]
Type=Application
Name=KD Hybrid Manager
Comment=Verified reversible KD Hybrid bootstrap manager
Exec=KDHybridManager
Icon=kd-hybrid-manager
Categories=Utility;Game;
Terminal=false
EOF

linuxdeploy="$(realpath "./linuxdeploy-${arch}.AppImage")"
plugin="$(realpath "./linuxdeploy-plugin-qt-${arch}.AppImage")"
if [[ ! -x "$linuxdeploy" || ! -x "$plugin" ]]; then
  echo "linuxdeploy and linuxdeploy-plugin-qt for $arch must be executable in the current directory" >&2
  exit 1
fi

export QMAKE="${QMAKE:-$(command -v qmake6)}"
export OUTPUT="KD-Hybrid-Manager-Linux-${arch}.AppImage"
export LINUXDEPLOY_PLUGIN_QT="$plugin"
mkdir -p "$output_dir"
(
  cd "$output_dir"
  "$linuxdeploy" --appdir "$appdir" \
    --executable "$appdir/usr/bin/KDHybridManager" \
    --desktop-file "$appdir/usr/share/applications/kd-hybrid-manager.desktop" \
    --icon-file "$appdir/usr/share/icons/hicolor/scalable/apps/kd-hybrid-manager.svg" \
    --plugin qt \
    --output appimage
)
(
  cd "$output_dir"
  sha256sum "$OUTPUT" > "$OUTPUT.sha256"
)
