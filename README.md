# 🍐 Pear

Pear is Holepunch's peer-to-peer development platform. It gives projects a
`pear://` link, syncs code onto that link, and distributes it over the
network — all without servers.

Everything is built on the Holepunch stack: project files live in a
[Hyperdrive](https://github.com/holepunchto/hyperdrive) backed by
[Hypercore](https://github.com/holepunchto/hypercore) logs, replicated
peer-to-peer over [Hyperswarm](https://github.com/holepunchto/hyperswarm) and
discovered via the [DHT](https://github.com/holepunchto/hyperdht). A project's
`pear://` link *is* its address on that network — sharing the link is the only
distribution step.

This repository is the `pear` CLI and platform runtime: the tool used to
create, stage, seed and manage projects on the network.

## Setup

**curl** (macOS/Linux) — downloads and verifies a standalone binary, no Node.js required:

```sh
curl -fsSL https://install.pears.com/pear.sh | sh
```

**irm** (Windows PowerShell) — same thing, for Windows:

```powershell
irm https://install.pears.com/pear.ps1 | iex
```

**Docker** — run Pear inside a container with nothing installed on the host:

```sh
docker run -it --rm tetherto/pear
```

This drops into a shell with `pear` ready to go.

Be sure to follow the instructions for setting `PATH` as output by the installer.

Via Node.js's npm's `npx`:

```sh
npx pear-install
```

This installs Pear onto the system the same way, but requires Node.js.

### Help

```sh
pear help <cmd>
```

```sh
pear <cmd> --help
```

```sh
pear <cmd> -h
```

## Project Lifecycle

Starting from scratch, Holepunch publishes template projects to clone and build on, each a
minimal boilerplate with peer-to-peer OTA updates wired up:

- [`hello-pear-bare`](https://github.com/holepunchto/hello-pear-bare) — a standalone CLI
- [`hello-pear-electron`](https://github.com/holepunchto/hello-pear-electron) — a desktop app
- [`hello-pear-react-native`](https://github.com/holepunchto/hello-pear-react-native) — a mobile app

A typical project then moves through these commands:

```sh
pear touch                 # generate a new project link
pear stage <link>          # sync local disk changes onto the link
pear seed <link>           # announce the link on the network and serve it to peers
pear install <link>        # install the app from the link onto a peer's system
```

Peers who want to verify what changed, or inspect a project before syncing, use:

```sh
pear info <link>           # project metadata, manifest, keys
pear changelog <link>      # a project's changelog
```

Production releases that require multiple sign-offs use `pear provision` and
`pear multisig` to block-sync a source link to a production link under a
signing quorum.

## Commands

| Command       | Purpose                                                     |
| ------------- | ----------------------------------------------------------- |
| `touch`       | Generate a new project link                                 |
| `stage`       | Sync local disk changes into a project link                 |
| `build`       | Build native app installers                                 |
| `seed`        | Announce a project link on the network and serve its blocks |
| `dump`        | Sync files from a link to a directory (or stdout)           |
| `info`        | View project metadata, manifest, keys                       |
| `changelog`   | View a project's changelog                                  |
| `provision`   | Block-sync a source link to a pre-production target link    |
| `multisig`    | Quorum-based signing coordination for production releases   |
| `install`     | Install a Pear link origin                                  |
| `identity`    | Show this platform's local network public keys              |
| `data`        | Explore the platform database (DHT cache, multisig records) |
| `cores`       | List cores in the platform corestore                        |
| `gc`          | Clear dangling cores and other platform resources           |
| `sidecar`     | Run or shut down the local sidecar process                  |
| `blind-relay` | Run a relay for peers that cannot hole-punch                |
| `blind-peer`  | Run or request a blind peer to seed on your behalf          |
| `make`        | Build a Pear CLI app                                        |
| `versions`    | View Pear's own dependency versions                         |

Run `pear help <command>` for the full set of arguments and flags on any of these.

## Documentation

[Documentation](https://docs.pears.com)

## Platform Development

Platform development is generally referred to as **localdev**.

**Clone:**

```sh
git clone https://github.com/holepunchto/pear && cd pear
```

**Install deps:**

```sh
npm install
```

Build the runtime binaries with:

```sh
npm run make
```

Built artifacts are placed as standalone runtimes in `out/make`.

Use `./pear.dev` (`.\pear.ps1` / `.\pear.cmd` on Windows) to execute this checkout directly in localdev.

## OS Support

- **macOS** — arm64, x64
- **Linux** — arm64, x64
- **Windows** — arm64, x64

## Contributing

See [CONTRIBUTING.md](./CONTRIBUTING.md).

## License

Apache-2.0
