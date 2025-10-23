# cmake-pear

CMake functions to streamline the build process and packaging of Pear applications.

## API

#### `add_pear_appling`

Defines and configures a new Pear appling. Takes care of linking the code to the core Pear libraries, managing appling metadata (key, name, version, etc.), and calling the appropriate platform-specific packaging functions.

```cmake
add_pear_appling(
  <target>
  ID <string>
  NAME <string>
  VERSION <string>
  DESCRIPTION <string>
  AUTHOR <string>
  [SPLASH <path>]
  [MACOS_ICON <path>]
  MACOS_CATEGORY <string>
  MACOS_IDENTIFIER <string>
  MACOS_SIGNING_IDENTITY <string>
  [MACOS_SIGNING_KEYCHAIN <string>]
  [MACOS_ENTITLEMENTS <entitlement...>]
  [WINDOWS_ICON <path>]
  WINDOWS_SIGNING_SUBJECT <string>
  WINDOWS_SIGNING_THUMBPRINT <string>
  [LINUX_ICON <path>]
  LINUX_CATEGORY <string>
)
```

##### `<target>`

The name of the CMake target to create for the Pear appling.

##### `ID <string>`

The ID of the Pear appling.

##### `NAME <string>`

The name of the appling as presented to users.

##### `VERSION <string>`

The semantic version of the Pear appling, e.g. "1.0.0".

##### `DESCRIPTION <string>`

A short description of the app's functionality.

##### `AUTHOR <string>`

Author's name or the name of the organization creating the appling.

##### `SPLASH <path>`

The path to a splash screen image displayed during appling launch. Defaults to `"assets/splash.png"`.

##### `MACOS_ICON <path>`

The path to the icon for the macOS app bundle. Defaults to `"assets/darwin/icon.png"`.

##### `MACOS_CATEGORY <string>`

The category for the app in the macOS App Store or Finder.

##### `MACOS_IDENTIFIER <string>`

A unique bundle identifier for the macOS app.

##### `MACOS_SIGNING_IDENTITY <string>`

A macOS code signing identity string. Defaults to `"Apple Development"`.

##### `MACOS_SIGNING_KEYCHAIN <string>`

The path to the keychain containing the signing identity.

##### `MACOS_ENTITLEMENTS <entitlement...>`

A list of macOS entitlements for special permissions.

##### `WINDOWS_ICON <path>`

The path to the icon for the Windows MSIX package. Defaults to `"assets/win32/icon.png"`.

##### `WINDOWS_SIGNING_SUBJECT <string>`

Subject name for Windows code signing.

##### `WINDOWS_SIGNING_THUMBPRINT <string>`

Thumbprint of the Windows code signing certificate.

##### `LINUX_ICON <path>`

Path to the icon for the Linux AppImage. Defaults to `"assets/linux/icon.png"`.

##### `LINUX_CATEGORY <string>`

The category for the app in Linux application menus.

## License

Apache-2.0
