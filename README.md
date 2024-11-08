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
npm run bootstrap [KEY]
```

Key defaults to production key `npm run bootstrap` bootstraps from production runtimes.

First run will install runtimes in `by-arch`, create platform directory called `pear` and add a `pear.dev` symlink (Linux, Mac)or `pear.ps1` and `pear.cmd` files (Windows). These are system-specific and .gitignore'd.

Use `./pear.dev` (`\\pear.ps1` / `\\pear.cmd`) to execute the Pear Runtime directly in localdev.


## Drives

The following are public drives for the Production Pear.

### Runtimes Bootstrap

```
pear://gd4n8itmfs6x7tzioj6jtxexiu4x4ijiu3grxdjwkbtkczw5dwho
```

### Production Build

```
pear://pqbzjhqyonxprx8hghxexnmctw75mr91ewqw5dxe1zmntfyaddqy
```

### Stage Build

```
pear://17g37zzfo3dnmchf57ixw93gpxcncjmfyzybf4tjo99xi55ewf7o
```

Note: Always use the production build unless you are sure of what you are doing. The stage build may introduce untested breaking changes that could affect other Pear apps.

## License

Apache-2.0
