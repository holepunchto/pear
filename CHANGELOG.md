# Pear Runtime Changelog

## v1.0.0

First public release 🍐

## v1.1.0

### Features

- `pear init -t terminal --with node` to create a Node.js-like Pear Terminal App
- `pear run <key>` now only runs explicitly trusted keys
- `pear info <key>` to `pear info [key]`. When no key is provided `pear info` now outputs Pear info
- `pear info [key]` now also outputs changelog. 
- TODO `Pear.teardown` now supported in Pear Terminal Apps

### Fixes

- Windows - pear init input validation fix
- Windows - terminal output fixes
- TODO Mac - deep link click handling when application instance is already opening
- Application `pear release` marking and running fix
- Decal Reporter fix


### Improvements

- `<pear-ctrl>` added to Desktop example
- `<pear-ctrl>` added to pear init Desktop template
