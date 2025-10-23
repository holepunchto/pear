# cmake-macos

Functions for streamlining the creation of macOS application bundles (`.app` files), including icon management, code signing, and more.

## API

#### `find_codesign`

Locates the `codesign` command-line utility required for code signing macOS applications.

```cmake
find_codesign(<result>)
```

##### `<result>`
An output variable where the path to the codesign tool will be stored.

#### `find_iconutil`

Locates the `iconutil` command-line utility used for manipulating macOS icon sets (`.icns` 
files).

```cmake
find_iconutil(<result>)
```

##### `<result>`
An output variable where the path to the iconutil tool will be stored.

#### `add_macos_entitlements`

Generates a macOS `Entitlements.plist` file for specifying special permissions required by the application.

```cmake
add_macos_entitlements(
  <target>
  [DESTINATION <path>]
  ENTITLEMENTS <entitlement...>
)
```

##### `<target>` 
The name of the CMake target to create.

##### `DESTINATION <path>`
The location to save the generated `Entitlements.plist`. Defaults to `"Entitlements.plist"` in the build directory.

##### `ENTITLEMENTS <entitlement...>`
A list of entitlement keys to be included.

#### `add_macos_iconset`

Creates a macOS icon set (`.icns` file) from a collection of image files.

```cmake
add_macos_iconset(
  [DESTINATION <path>]
  ICONS [<path> 16|32|64|128|256|512 1x|2x]...
  [DEPENDS <target...>]
)
```

##### `<target>`
The name of the CMake target to create.

##### `DESTINATION <path>`
The output location for the `.icns` file. Defaults to `"icon.icns"` in the build directory.

##### `ICONS <path> <size> <scale>`
A sequence of arguments specifying:
- `<path>`: Path to the image file.
- `<size>`: Size of the icon variant (e.g., 16, 32, 128)
- `<scale>`: Scale factor (e.g., 1x, 2x)

#### `add_macos_bundle_info`

Generates the `Info.plist` file with macOS application metadata.

```cmake
add_macos_bundle_info(
  <target>
  [DESTINATION <path>]
  NAME <string>
  VERSION <string>
  DISPLAY_NAME <string>
  PUBLISHER_DISPLAY_NAME <string>
  IDENTIFIER <identifier>
  CATEGORY <string>
  [TARGET <target>]
  [EXECUTABLE <path>]
)
```

##### `<target>`
The name of the CMake target to create.

##### `DESTINATION <path>`
Specifies the location to save the `Info.plist` file. Defaults to `"Info.plist"` in the build directory.

##### `NAME <string>`
The name of the application.

##### `VERSION <string>`
The semantic version of the application.

##### `DISPLAY_NAME <string>`
The name displayed to users. Defaults to `"${NAME}"`.

##### `PUBLISHER_DISPLAY_NAME <string>`
The name of the publisher.

##### `IDENTIFIER <string>`
A unique bundle identifier for the application.

##### `CATEGORY <string>` 
Category for the app in the macOS App Store or Finder.

##### `TARGET <target>`
An existing CMake target representing the main application executable.

##### `EXECUTABLE <path>`
Path to the application executable. Use if not providing the `TARGET` option.

#### `add_macos_bundle`

The core function to create a complete macOS application bundle (`.app` file).

```cmake
add_macos_bundle(
  <target> 
  DESTINATION <path>
  [INFO <path>]
  [ICON <path>]
  [TARGET <target>]
  [EXECUTABLE <path>]
  [RESOURCES [FILE|DIR <from> <to>]...]
  [DEPENDS <target...>]
)
```

##### `<target>`
The name of the CMake target to create for the macOS application.

##### `DESTINATION <path>`
The desired output path for the generated application bundle.

##### `INFO <path>`
Path to an `Info.plist` file. Defaults to `"Info.plist"` in the build directory.

##### `ICON <path>`
Path to a `.icns` file containing the application icon. Defaults to `"icon.icns"` in the build directory.

##### `TARGET <target>`
Name of a CMake target representing the core executable of the application.

##### `EXECUTABLE <path>`
Direct path to the application executable. Use if not providing `TARGET`.

##### `RESOURCES [FILE|DIR <from> <to>] ...`
A list of additional resources to include in the app bundle.

###### `FILE <from> <to>`
Copies a single file from `<from>` to `<to>` location within the `Resources` directory of the bundle.

###### `DIR <from> <to>`
Copies an entire directory from `<from>` to `<to>` within the `Resources` directory of the bundle.

##### `DEPENDS <target...>` 
A list of CMake targets on which the bundle creation process depends.

#### `code_sign_macos`

Code signs a macOS application or bundle, enhancing security.

```cmake
code_sign_macos(
  <target>
  [PATH <path>]
  [TARGET <target>]
  [ENTITLEMENTS <path>]
  IDENTITY <string>
  [KEYCHAIN <string>]
  [DEPENDS <target...>]
)
```

##### `<target>`
The name of the CMake target to create.

##### `PATH <path>`
The path to the macOS application bundle or executable to be signed.

##### `TARGET <target>`
A CMake target representing the application to be signed. Alternative to providing `PATH`.

##### `ENTITLEMENTS <path>`
The path to an `Entitlements.plist` file specifying permissions for the application. Defaults to `"Entitlements.plist"` in the build directory.

##### `IDENTITY <string>`
The code signing identity to use.

##### `KEYCHAIN <string>`
The path to the keychain containing the code signing certificate and private key.

## License

Apache-2.0
