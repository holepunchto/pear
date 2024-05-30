# Pear Runtime Changelog

## v1.2.3

### Fixes

* API - Pear.teardown and internal unloading IPC fix

## v1.2.2

### Fixes

* API - `Pear.media.access.screen()` fix

## v1.2.1 

### Fixes

* API - `Pear.media.access` and `Pear.media.status` API fixes
* Hypercore - race condition upon block cancellation during validation fix 

## v1.2.0

### Features

* package.json config `pear.previewFor` support

### Fixes

* Windows - multiple platform instances fix, unique pipes
* Hypercore dependency update for updater fixes
* libudx - app start-up hanging bug-fix
* CLI - `pear versions` hanging fix
* teardown - sigterm exit code fix

### Improvements

* IPC Refactor from `jsonrpc-mux` to `pear-ipc` 
* deprecated dead-code removal (import 'pear' -> global.Pear)

## v1.1.2

### Fixes

* Windows & Linux - deep link click handling
* Windows - icon fix, shows appling icon
* Decal - constants in decal error fix 
* Bare - always link vcruntime statically
* Bare - custom inspect
* Bare - fixes issues relating to early exiting
* Updates - phantom update fix

## v1.1.1

### Fixes

- `pear release` updates release watching pre-init fix to post-init
- `pear info` changelog ordering
- in-app link clicking of pear:// links
- wakeup fixes

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
