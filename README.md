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

Bootstrap the runtime binaries with

```sh
npm run bootstrap [KEY]
```

Key defaults to production key `npm run bootstrap` bootstraps from production runtimes.

Builds place standalone runtimes in `out/by-arch`.

Use `./pear.dev` (`.\pear.ps1` / `.\pear.cmd` on Windows) to execute this checkout directly in localdev.


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

## License

Apache-2.0
