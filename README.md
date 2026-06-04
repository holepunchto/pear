# 🍐 Pear

## Setup
 
Via Node.js's npm's `npx`:

```sh
npx pear
```

This installs Pear onto the system. 

To complete the setup, be sure to follow instructions for setting `PATH` as output by the `npx pear` command.

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

Built artifacts are placed as standalone runtimes in `by-arch/`.

Use `./pear.dev` (`.\pear.ps1` / `.\pear.cmd` on Windows) to execute this checkout directly in localdev.

## OS Support

- **macOS** — arm64, x64
- **Linux** — arm64, x64
- **Windows** — arm64, x64

## License

Apache-2.0
