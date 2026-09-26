#!/usr/bin/env bash
# HomePiBoard: Wrapper for setting HDMI Audio Output
set -euo pipefail
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
bash "$SCRIPT_DIR/set-audio-output.sh" hdmi "$@"
