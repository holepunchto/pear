# cmake-npm

```
npm i cmake-npm
```

```cmake
find_package(cmake-npm REQUIRED PATHS node_modules/cmake-npm)
```

## API

#### `find_npm(<result>)`

#### `node_module_prefix(<result> [WORKING_DIRECTORY <path>])`

#### `install_node_module(specifier [SAVE] [FORCE] [VERSION <range>] [WORKING_DIRECTORY <path>])`

#### `install_node_modules([LOCKFILE] [FORCE] [WORKING_DIRECTORY <path>])`

#### `resolve_node_module(<specifier> <result> [WORKING_DIRECTORY <path>])`

#### `list_node_modules(<result> [DEVELOPMENT] [WORKING_DIRECTORY <path>])`

## License

Apache-2.0
