# Pear Runtime Changelog

## v1.1.0

### Features

- `pear init -t terminal --with node` to create a Node.js-like Pear Terminal App
- `pear run <key>` now only runs explicitly trusted keys, also `--no-ask-trust` flag to auto-decline unknown keys
- `pear run --detached` attempts to wake running app instance else runs app detached, prefers appling if available
- `pear info <key>` to `pear info [key]`. When no key is provided `pear info` now outputs Pear info
- `pear info [key]` now also outputs latest changelog
- `Pear.teardown` now supported in Pear Terminal Apps
- `pear run --devtools` - open devtools on start, defaults to enabled in with `--dev` flag, otherwise disabled
- `pear run --updates-diff` - include diff arrays in state passed to `Pear.updates` API, defaults to enabled in with `--dev` flag, otherwise disabled
- `pear run --no-updates` - do not trigger Pear.updates API. When running from a directory, filesystem updates will be ignored, when running from a key any stage/release updates will be ignored.

### Fixes

- Windows - `pear init` input validation fix
- Windows - terminal output fixes
- Mac - deep link click handling when application instance is already opening
- Application `pear release` marking, running, watching fix
- Decal Reporter fix

### Improvements

- `<pear-ctrl>` added to Desktop example
- `<pear-ctrl>` added to pear init Desktop template
- usage: pear run / pear dev clarifications
- more update flow tests

## v1.0.0

First public release 🍐
