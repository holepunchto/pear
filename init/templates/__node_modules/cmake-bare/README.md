# cmake-bare

Bare utilities for CMake.

```
npm i cmake-bare
```

```cmake
find_package(cmake-bare REQUIRED PATHS node_modules/cmake-bare)
```

## API

#### `bare_platform(<result>)`

Write the current compilation target platform to the `<result>` variable.

#### `bare_arch(<result>)`

Write the current compilation target architecture to the `<result>` variable.

#### `bare_simulator(<result>)`

Write whether or not the current compilation target is a simulator to the `<result>` variable.

#### `bare_environment(<result>)`

Write the current compilation target environment to the `<result>` variable.

#### `bare_target(<result>)`

Write the current compilation target to the `<result>` variable.

#### `bare_module_target(<directory> <result> [NAME <var>] [VERSION <var>] [HASH <var>])`

Determine the CMake library target name of the module in `<directory>` and write the result to the `<result>` variable. The `NAME`, `VERSION`, and `HASH` arguments can be passed to access specific portions of the target name which will be of the format `${name}-${version}-${hash}`.

#### `add_bare_module(<result> [EXPORTS])`

Add a Bare native addon target and write the target name to the `<result>` variable.

#### `include_bare_module(<specifier> <result> [PREBUILD] [SOURCE_DIR <var>] [BINARY_DIR <var>] [WORKING_DIRECTORY <path>])`

Include the Bare native addon identified by `<specifier>` and write its library target name to the `<result>` variable. If `PREBUILD` is passed then the native addon prebuild will be included as an imported target. The `SOURCE_DIR` and `BINARY_DIR` arguments can be passed to access the source and binary directories of the included addon.

To change the working directory from which `<specifier>` is resolved, pass the `WORKING_DIRECTORY` argument.

#### `link_bare_module(<receiver> <specifier> [SHARED] [WORKING_DIRECTORY <path>])`

Link the Bare native addon identified by `<specifier>` to the library target identified by `<receiver>`. By default, the objects of the native addon will be linked, effectively embedding the addon in `<receiver>`. To instead link the shared library target of the native addon, such as when `<receiver>` is itself another native addon, pass the `SHARED` option.

To change the working directory from which `<specifier>` is resolved, pass the `WORKING_DIRECTORY` argument.

#### `link_bare_modules(<receiver> [SHARED] [EXCLUDE <name...>] [WORKING_DIRECTORY <path>])`

Link all Bare native addons declared as dependencies in the `package.json` manifest of the current source directory to the library target identified by `<receiver>`. Arguments are the same of for `link_bare_module()`.

## License

Apache-2.0
