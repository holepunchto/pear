# Pear Runtime Changelog

## v2.2.10

### Fixes

* runtime bump

## v2.2.9

### Fixes

* libappling launch lib

## v2.2.8

### Fixes

* libappling bump for win fix

## v2.2.7

### Fixes

* libappling launch lib

## v2.2.6

### Fixes

* Fixes - Fixed hyperswarm connectivity

## v2.2.5

### Improvements

* Internal - added progress to installer in new launch dynamic library

## v2.2.4

### Improvements

* Internal - dependencies bump

## v2.2.3

### Fixes

* Internal - stop bundle memory-leak in run op

## v2.2.2

### Fixes

* CLI - `pear info [link|channel] [dir]` - channel support

### Improvements

* Internal - dependencies bump

## v2.2.1

### Fixes

* CLI - `pear gc cores` ignore platform blobs key, compact corestore on clear (was:`pear gc corestore`)
* CLI - `pear sidecar` MAX_SAFE_INTEGER spindown - manually started sidecar should stay alive

## v2.2.0

### Features

* CLI - `pear gc corestore` - clear platform corestore to reduce disk space usage

### Fixes

* CLI - `pear stage --pre-io` fix to show pre I/O during stage when flag is used

### Improvements

* Internal - ratified stats object for mirror monitoring, includes progress stat

## v2.1.13

### Fixes

* Internal - aliased currents fix

## v2.1.12

### Improvements

* Internal - dependencies bump, includes production keys for pear://runtime, pear://templates & pear://doctor
* Internal - bump bare version in by-arch pear-runtime build

## v2.1.11

### Fixes

* Internal - wakeup inclusion fix

### Improvements

* Internal - move to using new Corestore wait API instead of managing lock file

## v2.1.10

### Fixes

* Internal - include wakeup app (Pear.app, pear.exe, pear) in by-arch

### Improvements

* Internal - update production key
* Run - preflight optimization

## v2.1.9

### Fixes

* Sidecar - Mac update restart fix with `open -n`
* CLI - `pear changelog` max fix latest entries

## v2.1.8

### Fixes

* CLI - `pear stage` - initial output versioned link length fix

## v2.1.7

### Fixes

* CLI - `pear data [cmd] <link>` throws if not link not found
* CLI `pear dump <link>` throws if link not found
* Sidecar - on app first run current only set after asset sync
* Sidecar - updates during first run excluded from setting current
* Sidecar - derisk with dedicated platform lock instead of using rocksdb lock
* Sidecar - update logs fix when using `--updates-diff` when running from key

### Improvements

* Sidecar - `pear stage --compact` operation optimizations

## v2.1.6

### Fixes

* Sidecar - restart improvement for Mac, fix for appling spawning (appling should own cwd)
* CLI - `pear changelog` reverse order fix

## v2.1.5

### Fixes

* CLI - `pear changelog` usage output fix for `--max` flag

## v2.1.4

### Fixes

* IPC - heartbeat timeout should no longer close client in sidecar

## v2.1.3

### Fixes

* CLI - `pear init` default fix
* Internal - teardown flow fix, ensure reverse order by timestamp
* Sidecar - remove unresponsive sigkill, allows blocking processes, sigkilled on death anyway
* Internal - pre fix on Windows, path resolution related

## v2.1.2

### Fixes

* Internal - teardown flow fix, close clients in reverse order
* Internal - pre pipe check only for run ops
* CLI - `pear gc` bug fix for running asset detection

## v2.1.1

### Fixes

* Internal - stray ref removed from compact stage
* IPC/OPS - stage and dump output tags byteDiff -> byte-diff

## v2.1.0

### Features

* CLI - `pear changelog` command
* CLI - `pear versions --modules|-m` flag prints dependency versions (now hidden) and JSON output alignment

### Fixes

* Internal - Changelog fixup
* Internal - Windows restart fix via `bare-daemon` bump

### Improvements

* CLI - iteration of `pear stage` output
* Native - Bare runtime updated from 1.21.7 to 1.23.4
* CLI - `pear info --changelog` -> `pear changelog` and `pear info` defaults to not printing changelog

## v2.0.0

### Features

* Internal - sidecar garbage collection of dangling filesystem resources
* CLI - `pear gc assets` force clean-up of locally synced assets
* CLI - `pear data` explore platform database collections `apps`, `dht`, `gc`, `manifest`, `assets`, `currents`
* Integration - `pear-api` `Pear.constructor.RTI`, `Pear.constructor.IPC`, `Pear.constructor.RUNTIME`
* CLI - `pear dump --only` - filter by paths
* CLI - `pear dump --no-prune` - disallow removals
* CLI - `pear dump` downloads & peers stats output status
* CLI - `pear stage --compact` - tree-shaking static-analysis based stage
* CLI - `pear stage --purge` - remove ignored files from app hypercore
* CLI - `pear stage --only` - filter by paths
* Config - `pear.stage.compact` - enable minimal static-analysis based stage
* Config - `pear.stage.include` - to include any files missed from static-analysis of compact stage
* Config - `pear.stage.only` - filter by paths on stage
* Config - `pear.pre` - set to a project path or npm installed bin to run a pear app prior to staging or running an app from dir. The pre run app uses `pear-pipe` which receives initial config (per `package.json pear` field) as `compact-encoding` `any`, and can write back to the `pipe` in the form `{ tag, data }`. Repsonding with `{ tag: 'configure', data: mutatedConfig }` will update the application config. All tags will be displayed prior to run & stage output to indicate actions taken by the pre app. Enabling > log level `INF` will (`-L INF`) also output `data` with the `tag`
* Config - `pear.stage.pre` - as `pear.pre` but for pre stage only
* Config - `pear.run.pre` - as `pear.pre` but for pre run from dir only
* CLI - `pear run --no-pre` - disallow any `pear.pre` apps to run prior to run from dir
* CLI - `pear run --pre-io` - for debugging pre apps. Show any writes to stdout/stderr from the pre app
* CLI - `pear run --pre-q` - hide any pre tags from displaying
* CLI - `pear run --preflight` - advanced, synchronize assets, exit without app execution
* CLI - `pear stage --no-pre` - disallow any `pear.pre` apps to run prior to stage
* CLI - `pear stage --pre-io` - for debugging pre apps. Show any writes to stdout/stderr from the pre app
* CLI - `pear stage --pre-q` - hide any pre tags from displaying
* CLI - `pear stage` `verlink` (versioned link) on `'staging'` and `'addendum` output tags
set to module bin (e.g. `pear-electron`), which must use `#!/usr/bin/env pear`, take config in from `pear-pipe` `data` and `pipe.write` the mutated config back
* Config - pear.routes - route redirection to support pear://<key>/some/route -> path, `{"routes": {"/route": "/path"}`, `{"routes": "."}` catch-all
* Config - pear.unrouted - rerouting opt-out array, `node_modules/.bin` is always unrouted
* IPC/API - assets op, dump link to pear-dir/assets, record link<->path in db, w/ dl/peers stats output
* CLI - `pear stage --ignore` notting & globbing (*, */**, !not/this/one)
* CLI - `pear --log-labels|-l <list> <cmd>` new `-l` alias for `--log-labels` + setting `-l` flag now implies logging on
* CLI - `pear --log-level|-L <level> <cmd>` new `-L` alias for `--log-level`
* CLI - `pear --log-fields|-F <list> <cmd>`  new `-F` alias for `--log-fields`
* CLI - `pear --log-stacks|-S <cmd>` new `-S` alias for `--log-stacks`
* CLI - `pear --log-verbose|-V <cmd>` new flag, enables all `--log-fields` `date,time,level,label,delta`
* CLI - `pear --log-max|-M <cmd>` new flag, log all levels and labels + implies `--log-verbose`

### Fixes

* Permissions - UID of Pear process must match Pear platform directory UID
* `pear sidecar` - cursor reset on teardown
* `pear sidecar` - corrected restart commands output
* `pear run` - remove cwd reliance from project resolution algorithm
* Internal - queue for bus subscribers that feed to new subsribers in from new clients in new processes that are part of the same app with a cutover phase. Ultimately ensures applications do not miss updates (or any bus messages) when listening in subprocesses.

### Improvements

* CLI - `pear run` - **MAJOR** only runs terminal (Bare) apps from JS entrypoints, will throw ERR_LEGACY for .html entrypoints
* CLI - **MAJOR** `pear reset` **DEPRECATED & REMOVED** now `pear drop`
* CLI - **MAJOR** `pear init`, `-t|--type` flag removed, replaced with `name` (default, node-compat, ui), in `[link|name]`
* CLI - **MAJOR** `pear init` default generates a non-ui Pear app previously generated desktop app, also `--type|-t` flag removed, now use `pear init [link|name]` where `name` may be `default`, `ui`, or `node-compat`
* CLI - `pear run` - introduced new application architecture: entrypoint is always a headless process, it may spawn a UI per `pear-electron` and communicate over a pipe such that the entry point process is the Pearend (backend equivalent) that the frontend UI process can interact with
* CLI - **MAJOR** `pear dev` **DEPRECATED & REMOVED**  use `pear run --dev`
* API - **MAJOR** `Pear.messages` **DEPRECATED** use `pear-messages`
* API - **MAJOR** `Pear.message` **DEPRECATED** use `pear-message`
* API - **MAJOR** `Pear.updated` **DEPRECATED** (redundant). Use `pear-updates`
* API - **MAJOR** `Pear.updates` **DEPRECATED** use `pear-updates`
* API - **MAJOR** `Pear.wakeups` **DEPRECATED** use `pear-wakeups`
* API - **MAJOR** `Pear.restart` **DEPRECATED** use `pear-restart`
* API - **MAJOR** `Pear.worker.run` **DEPRECATED** use `pear-run`
* API - **MAJOR** `Pear.worker.pipe` **DEPRECATED** use `pear-pipe`
* API - **MAJOR** `Pear.reload` **DEPRECATED** use `location.reload()` in UI (already unsupported in terminal)
* API - **MAJOR** `Pear.config` **DEPRECATED** use `Pear.app`
* Config - `pear.userAgent` **DEPRECATED** use `pear.gui.userAgent`
* Externalization - `Pear` global now defined in `pear-api` allowing for API extension in other environments, such a Pear UI Libraries
* Externalization - `pear-api` integration libraries for externalized integration
* Externalization - GUI internals externalized to `pear-electron` Pear UI Library
* Internal - boot flow stripped decoupled from electron boot flow
* Internal - internal dependencies switched to `pear-api`
* Internal - gc op refactor
* CLI - help output tweaks/clarifications
* CLI - error output improvements (classifications for stacks/non-stacks)
* Internal - versions cmd refactor
* Internal - seed op tweak (seeds are not apps)
* Examples - various tweaks, including desktop updated to use `pear-electron`


## v1.18.0

### Improvements

* Internal - premigrate UI runtime assets ahead of v2
* Worker - output err logs to both terminal and console 

## v1.17.0

### Features

* API - added `pear sidecar inspect`

### Fixes

* Internal - Apply platform update event if deathclock triggered on sidecar close

## v1.16.0

### Fixes

* API - Fixed `pear run ${link}` when link contains fork, length and app key
* Internal - Only join swarm topic on server mode when seeding

### Improvements

* API - Pear.exit calls teardown before exit
* Worker - Worker pipe calls Pear.exit on close/end
* Worker - Standard err stream printed in GUI devtools
* Desktop - Sidecar sends pear/subprocess-killed message

## v1.15.0

### Improvements

* Internal - Bare 1.20.2

### Fixes

* Internal - Limited amount of connections per internal swarm topic
* Mac - Disable resize window animation
* Internal - Swarm connections limit fix
* Internal - Terminate non-responsive workers after 5 seconds
* Internal - Terminate workers when parent app is not running
* Sidecar - Start worker with parent's checkout by default

## v1.14.0

### Fixes

* Internal - Emit error, end and close events in correct worker pipes
* Restart - Fix client restart by ignoring stdio

## v1.13.2

### Fixes

* API - Added Pear.updated to check missed update notifications
* Internal - Pass correct worker flags

## v1.13.1

### Fixes

* Internal - Restart does not restart worker processes
* Desktop - Fixed main entrypoint
* Windows - Fixed long path in drive bundler

## v1.13.0

### Features

* CLI – The terminal app entrypoint can now be located inside the desktop app bundle

### Fixes

* Internal - Fixed multi worker data piping
* Terminal - Fixed unhandled rejection handler for terminal apps
* Desktop - Fixed client restart after update nofification
* Desktop – Fixed missing traffic lights on macOS

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
