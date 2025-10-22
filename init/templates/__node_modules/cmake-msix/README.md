# cmake-msix

Functions to simplify the creation of MSIX packages for distributing Windows applications.

## API

#### `find_make_appx`

Locates the `MakeAppx.exe` tool from the Windows SDK, required for building MSIX packages.

```cmake
find_make_appx(<result>)
```

##### `<result>`
An output variable where the path to the `MakeAppx.exe` executable will be stored.

#### `add_app_manifest`

Generates the core `AppxManifest.xml` file, which defines essential metadata for the MSIX package.

```cmake
add_appx_manifest(
  <target>
  [DESTINATION <path>]
  NAME <string>
  VERSION <string>
  PUBLISHER <string>
  [DISPLAY_NAME <string>]
  PUBLISHER_DISPLAY_NAME <string>
  DESCRIPTION <string>
  [UNVIRTUALIZED_PATHS <path...>]
)
```

##### `<target>`
The name of the CMake target to create.

##### `DESTINATION <path>`
The output file path for the `AppxManifest.xml`. Defaults to `"AppxManifest.xml"` in the build directory.

##### `NAME <string>`
The name of the application.

##### `VERSION <string>`
The semantic version of the application.

##### `PUBLISHER <string>`
The publisher of the application.

##### `DISPLAY_NAME <string>`
The name displayed to users. Defaults to `"${NAME}"`.

##### `PUBLISHER_DISPLAY_NAME <string>`
The publisher's display name.

##### `DESCRIPTION <string>`
A description of the application.

##### `UNVIRTUALIZED_PATHS <path...>`
A list of paths that should remain unvirtualized within the MSIX package.

#### `add_appx_mapping`

Creates a `Mapping.txt` file that specifies the file structure within the MSIX package.

```cmake
add_appx_mapping(
  <target>
  [DESTINATION <path>]
  [ICON <path>]
  [TARGET <target>]
  [EXECUTABLE <path>]
  [RESOURCES [FILE|DIR <from> <to>]...]
)
```

##### `<target>`
The name of the CMake target to create.

##### `DESTINATION <path>`
The output file path for the `Mapping.txt`. Defaults to `"Mapping.txt"` in the build directory.

##### `ICON <path>`
Path to the application icon.

##### `TARGET <target>`
An existing CMake target representing the core executable of your application.

##### `EXECUTABLE <path>`
Direct path to the application executable. Use if not providing `TARGET`.

##### `RESOURCES [FILE|DIR <from> <to>]...`
A list of additional files or directories to include.

###### `FILE <from> <to>`
Copies a file from `<from>` to `<to>` within the MSIX package.

###### `DIR <from> <to>`
Copies an entire directory from `<from>` to `<to>` within the MSIX package.

#### `add_msix_package`

The central function to generate the final MSIX package.

```cmake
add_msix_package(
  <target>
  DESTINATION <path>
  [MANIFEST <path>]
  [MAPPING <path>]
  [DEPENDS <target...>]
)
```

##### `<target>`
The name of the CMake target to create.

##### `DESTINATION <path>`
The output path and filename for the MSIX package.

##### `MANIFEST <path>`
Path to the `AppxManifest.xml` file. Defaults to `"AppxManifest.xml"` in the build directory.

##### `MAPPING <path>`
Path to the Mapping.txt file. Defaults to `"Mapping.txt"` in the build directory.

##### `DEPENDS <target...>`
A list of CMake targets on which the package build depends.

## License

Apache-2.0
