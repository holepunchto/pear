# Pear Runtime Changelog

## v1.13.0

### Features

* CLI – The terminal app entrypoint can now be located inside the desktop app bundle.

### Fixes

* Internal - Fixed multi worker data piping.
* Terminal - Fixed unhandled rejection handler for terminal apps.
* Desktop - Fixed client restart after update nofification.
* Desktop – Fixed missing traffic lights on macOS.

## v1.12.1

### Fixes

* Internal - Updated device-file to 1.2.6

## v1.12.0

### Fixes

* Tray Icon - Corrected tray icon size
* Tray Icon (Mac) - Set tray icon as image template
* Desktop - Fixed application wake-up
* Windows - Platform add-ons now linked with vcruntime
* Desktop - Added `crypto` to Nodejs available builtin modules

### Improvements

* Internal - Migrated platform Corestore to Hypercore 11
* CLI - Improved "Unknown Argument" error message
* Bare - Update Bare runtime to v1.17.3
* Internal - Single storage for platform database and Corestore
* Internal - Fixed internal database keys duplication

### Features

* CLI - Removed `--seeders` flag from `pear seed` command

## v1.11.2

### Fixes

* Windows - Updated native dependencies
* Internal - Updated sloppy-module-parser to version 2.2.3

## v1.11.1

### Fixes

* Windows - Fixed VCRUNTIME error

## v1.11.0

### Features

* Internal - HyperDB integration
* CLI - Added `data` command
* CLI - Added `reset` command
* Desktop - Added Pear.tray

### Improvements

* Desktop - Set Electron application name on boot
* Desktop - Added default Linux icon and badges
* Internal - Faster offline boot
* CLI - Improved `dump` for single file or folder

### Fixes

* Sidecar - Fixed teardown without clients
* Templates - Skipped warmup creation for template stage
* Pear Runtime - Fixed detached run mode for pear://runtime

## v1.10.0

### Improvements

* Desktop - Added "hideable" GUI option
* Desktop - Pear.gui options platform specific
* Internal - Udx-Native version 1.17.3

### Fixes

* Internal - Parsing .resolve calls statically (Sloppy Module Parser 2.2.1 and ScriptLinker 2.5.4) 

## v1.9.0

### Improvements

* Desktop - Electron version 33.2.1
* Internal - RocksDB-Native version 3.1.2
* Internal - Udx-Native version 1.17.2
* Internal - Node-Bare-Bundle version 1.4.2
* Internal - Bare 1.13.1

## v1.8.1

### Fixes

* Desktop - Fixed `userAgent` configuration

## v1.8.0

### Features

* CLI - `stage` warmup map generated from bundle static analysis
* Desktop - Exposed `badge` Electron method
* Desktop - Supported `rocksdb-native` in GUI apps

### Fixes

* Worker - Deduplicated `--trusted` flag
* Worker - Fixed worker arguments when executed with platform arguments
* Desktop - Fixed `hide` Electron IPC call
* CLI - `dump` creates dump directory by default
* Terminal - Fixed exit for terminal apps without teardown

### Improvements

* CLI - Improved crash log
* Internal - Bare version 1.12
* Internal - Introduced unskippable platform versions

## v1.7.0

### Features

* CLI - `pear dump --dry-run` flag

### Fixes

Desktop - Fix Windows client restart
CLI - Fix broken stdin after Ctrl-C
Internal - Fix Pear-IPC unhandled error
Internal - Fix worker close on parent end 

### Improvements

Internal - Removed `getMediaSourceId`
Internal - Removed terminal app reload and restart

## v1.6.0

### Features

* Internal - Added sidecar logs
* Performance - Added DHT persistent cache
* CLI - `pear dump --dry-run` flag

### Fixes

* Desktop - Forced teardown fix for Pear Desktop apps that take longer than 15 seconds to close
* Dependencies - udx-native updated to 1.13.3
* Internal - Block of spindown while platform is updating
* Desktop - Fix teardown of worker on app exit
* Desktop - Decal run from disk bug fix
* Desktop - Decal bar bug fix

### Improvements

* API - Removed deprecated preferences methods from Pear API
* Internal - Added RocksDB native support

## v1.5.0

### Features

* CLI - Support for Encrypted Applications in `pear run`, `pear stage`, `pear dump`, `pear init`, `pear seed` and `pear info` - unlock via password input w/ `--no-ask` opt-out
* Desktop - Password input dialog for Encrypted Applications
* CLI - `pear touch` - Create Pear Link. Advanced. Combine with `pear stage <link>` and `pear release <link>`. Useful for automation since no channel name is required

### Fixes

* CLI - `pear stage --name` and `pear seed --name` flag fix
* API - untrusted worker on first run fix
* Desktop - `ERR_HTTP_NOT_FOUND` 404 response from the sidecar when a requested file is not found
* Mac - traffic lights visibility fix
* Desktop - GUI configiguration can take numeric strings as values

### Improvements

* CLI - `pear dev` deprecated. Use `pear run --dev` instead
* Desktop - add support for `https://*` and `http://*` in the package.json config `pear.links`
* Desktop - update Windows `pear-ctrl` icons
* Desktop - added `--trusted` hidden flag to `run` command
* Desktop - Add `no-cache` to sidecar request headers
* Desktop - zombie processes reduction measures: IPC lifecycle improvements + heartbeat
* Windows/Linux - Avoid OS/Electron issues by disabling the sandbox (already unused), the `--sandbox` flag can be used to re-enable
* Performance - 3x speedup with concurrent Hyperbee gets in application loading flow
* Performance - application boot speed regression fix, package lookup for worker trusted links
* Performance - `pear info` concurrent Hyperbee gets

## v1.4.0

### Features

* API - `Pear.worker(link, args)` - pass app args to worker with second `args` parameter, sets `Pear.config.args`
* API - `Pear.wakeups()` includes `fragment` of `pear://link#fragment` (location hash without the `#` prefix)
* API - `Pear.wakeups()` includes `entrypoint` of `pear://link/some/entry/point` (URL pathname)
* API - `Pear.reload()` soft-restart terminal apps (keeps I/O), refresh app in desktop apps
* API - `Pear.versions() -> { platform, app, runtimes }` `runtimes.bare`, `runtimes.pear` and `runtimes.electron` SemVers
* CLI - `pear init [flags] <link|type=desktop> [dir]` initialize from templates at pear:// links
* CLI - `pear dump` dump to stdout
* CLI - `pear dump` dump from entrypoint
* CLI - `pear run --links <kvs>` - key-value overrides of `package.json` `pear.links`
* IDE / Types - `pear-interface` dev-dep autosyncing to current platform Pear API for synchronized IDE autocomplete support
* Diagnostics - pear://doctor alias

### Fixes

* CLI - `pear seed <link>`, reseeding fix 
* CLI - `pear run --unsafe-clear-app-storage` fix
* CLI - `pear run  --unsafe-clear-preferences` fix
* CLI - `pear run` - only set NODE_ENV production when not dev mode
* Desktop - setPosition edge-case guard
* Desktop - re-enable decal loader titlebar and window controls
* Reporting - client-side reporting-to-sidecar state-fix
* CLI - `pear run [flags] <link|dir> [...app-args]` - fix for `link [...app-args]` on Windows

### Improvements

* Electron - upgrade to 31.2.0
* Performance - memory usage optimization with global corestore cache
* API - `Pear.worker` - Worker now inherits flags passed to `pear` which creates equivalent `Pear.config` state in Worker
* CLI - `pear -v` improved output
* CLI - electron and pear SemVers added to `pear versions`
* Desktop - Not Found default screen

## v1.3.4

### Fixes

* Desktop - teardown fix
* Wakeup & Config - linkData fix

## v1.3.3

### Fixes

* Restart - --storage flag in restart flow bug fix

## v1.3.2

### Fixes

* Trust - fix to pear:// links

## v1.3.1

### Fixes

* CLI - fix --storage flag

## v1.3.0

### Features

* CLI - `pear run` `-d` alias for `--dev` flag
* CLI / Deep-Links -  support for `pear run pear://<key>/entrypoint/subpath`, `pear run file:///path/to/project/entrypoint/subpath`, `pear run ./relative/path/to/entrypoint`. Allows for deep-link paths in Pear Applications, eg a user link click of pear://<key>/some/entrypoint opens the application from that entrypoint.
* CLI - `pear shift` - move application storage between apps
* CLI - `pear gc releases` - clear inactive releases
* CLI - `pear gc sidecars` - clear any inactive running sidecars
* API - `Pear.worker.run(link)` - spawns a worker process from a pear link
* API - `Pear.worker.pipe()` - opens a pipe when the process is a worker
* CLI - `pear info <channel> [dir=cwd]` - if an app has been staged, its info can be retrieved by
* Config - `pear.links` - pear:// & http(s):// links application allowlist
* CLI - `pear info` `--key` flag, display key only
* CLI - `pear info` `--full-changelog` show full changelog in info output
* CLI - `pear info` `--changelog` show changelog only
* CLI - `pear info` `--metadata` show metadata only
* CLI - `pear info` `--json` flag for info in JSON format
* CLI / Config - `pear.previewFor` `package.json` config field cannot be released with `pear release` (staging only feature)
* API - `Pear.key` & `Pear.config.key` as buffers

### Improvements

* Desktop Apps - Consistent localstorage by binding to known port (9342)
* CLI - pear-cli bootstrap command (`npx pear`) moved out to own repo
* Sidecar Refactor - into subsystem folder
* IPC Refactor - async generators handlers in sidecar to streamx streams
* CLI Refactor - onto `paparam`, simplified CLI output, flag and argument validation
* Windows - Localdev (development on pear) - ps1/cmd pear files for pear.dev equivalents on Windows
* Linux - irrelevant log filtering
* Errors Refactor - move from hard coded error codes to Errors class 
* Desktop Apps - right click support for copy/paste, right click Inspect Element when in dev mode

### Fixes

* Windows - pear://runtime link --detached fix
* Windows - cross-drive run/stage/dump fixes
* Terminal Apps - hanging close when no ipc-calls bug fix
* OS - link clicking when app is active, detached wake-up fix
* Sidecar & Run - update bails treated as trust bails fix

## v1.2.4

### Fixes

* Hypercore - bump for roundtrip request ids fix

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
* Hypercore - dependency update for updater fixes
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
