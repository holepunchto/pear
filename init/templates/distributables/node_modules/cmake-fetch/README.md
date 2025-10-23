# cmake-fetch

Minimal package manager for CMake based on [`FetchContent`](https://cmake.org/cmake/help/latest/module/FetchContent.html).

```
npm i cmake-fetch
```

```cmake
find_package(cmake-fetch REQUIRED PATHS node_modules/cmake-fetch)
```

## API

#### `parse_fetch_specifier(<specifier> <target> <args>)`

#### `fetch_package(<specifier> [SOURCE_SUBDIR <path>] [SOURCE_DIR <var>] [BINARY_DIR <var>] [PATCHES <path...>])`

## License

Apache-2.0
