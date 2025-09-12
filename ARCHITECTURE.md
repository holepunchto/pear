# The Pear Runtime

```
platform-dir: 
  - MacOS - `~/Library/Application Support/pear`
  - Linux - `~/.config/pear`
  - Windows - `~\\AppData\\Roaming\\pear`

platform-dkey: discovery key for platform core

..appdata: application data files

swap: incremental integer dirname (default: 0) - incremented with `swap + 1 & 3`

[platform-dir]
  - /app-storage/by-dkey/[app-dkey]/[...appdata]
  - /app-storage/by-name/[app-name]/[...appdata]
  - /corestores/platform <-- corestore for platform code base + cores per app + interface cores
  - /by-dkey <-- store for platform releases, by discovery key
  - /by-dkey/[platform-dkey]/[swap] <-- consistent snapshot, sparse representation of the drive with self-generated bootstrap
    - /by-arch/[os]-[arch]
      - /bin
        - /pear-runtime (mac|linux) | pear-runtime.exe (win)
      - /lib
        - launch.dylib (shared lib entry point)
        - ...
    - /boot.bundle <-- the bare bundle to spawn with the bare bin that can boot the rest (localdev: boot.js)
    - /prebuilds <-- native bundled prebuilds
  - /current -> symlink -> /by-dkey/[platform-dkey]/[swap]
  - /next -> symlink -> /by-dkey/[platform-dkey]/[swap] <-- Windows only, atomic swap
  - /bin - prefixed to PATH to enable pear executable and pear run [key] --save-command flow
    - /pear -> symlink -> ../current/by-arch/[os]-[arch]/bin/pear-runtime <-- linux/mac
    - /pear.cmd | pear.ps1 -> win cmd/powershell script wrapper for ../current/by-arch/[os]-[arch]/bin/pear-runtime.exe
    - /[name] | ([name].cmd | [name].ps1) -> reserved
```

`boot.bundle` has just enough code to run itself with the bare js runtime and open the hyperdrive that contains the rest of the code.

When the platform updates, `boot.bundle` updates the drive in the background and makes a new version of `boot.bundle` that it atomically swaps in.

If the `by-arch` folder updates, a new swap is needed for a full atomic update. When a new swap has been extracted on disk, the `[platform-dir]/current` symlink is updated.

## Pear on Bare

Pear Runtime runs on [bare](https://github.com/holepunchto/bare), which is a cross-platform (including mobile) minimal JS runtime.
