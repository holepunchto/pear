# 🍐 Pear

## Getting Started

### Install:

```sh
npm install -g pear
```

### Help

**General**

```sh
pear help <cmd>
```

```sh
pear <cmd> --help
```

```
pear <cmd> -h
```
**Specific**


```sh
pear help <cmd>
```

```sh
pear <cmd> --help
```

```
pear <cmd> -h
```

## Documentation

[Documentation](./doc/readme.md)

## Platform Development

Platform development is generally referred to as **localdev**.

**Clone:**

```
git clone https://github.com/holepunchto/pear && cd pear
```

**Install deps:**

```
npm install
```

The `pear.js` file in the project root provides localdev setup:

```
node pear
```

First run will install runtimes in `by-arch`, create platform directory called `pear` and add a `pear.dev` symlink (Linux, Mac)or `pear.ps1` and `pear.cmd` files (Windows). These are system-specific and .gitignore'd.

Use `./pear.dev` (`\\pear.ps1` / `\\pear.cmd`) to execute the Pear Runtime directly in localdev.


## License

Apache-2.0
