#!/usr/bin/env bash
# Builds the plugin DLL. Output: dist/EmbyCleanupCandidates.dll
set -euo pipefail
cd "$(dirname "$0")"
export PATH="$HOME/.dotnet:$PATH"
dotnet test tests/Tests.csproj
dotnet build src/EmbyCleanupCandidates.csproj -c Release -o dist
ls -l dist/EmbyCleanupCandidates.dll
