# 🍐 Pear

## Getting Started

### Install:

```sh
npm install -g pear
```

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

Bootstrap the runtime binaries with

```sh
npm run bootstrap <KEY>
```

First run will install runtimes in `by-arch`, create platform directory called `pear` and add a `pear.dev` symlink (Linux, Mac)or `pear.ps1` and `pear.cmd` files (Windows). These are system-specific and .gitignore'd.

Use `./pear.dev` (`\\pear.ps1` / `\\pear.cmd`) to execute the Pear Runtime directly in localdev.


## License

Apache-2.0
