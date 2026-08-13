#!/bin/sh
set -eu

if [ "${1:-}" = "version" ]; then
  echo "pmtiles 1.30.0 (module github.com/protomaps/go-pmtiles@v1.30.0)"
  exit 0
fi

exec /usr/local/libexec/pmtiles "$@"
