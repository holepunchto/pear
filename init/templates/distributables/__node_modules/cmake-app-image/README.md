# cmake-app-image

CMake functions for packaging Pear applications into AppImages for Linux.

## API

#### `download_app_image_run`

Downloads the AppRun runtime component, required for executing AppImages.

```cmake
download_app_image_run(DESTINATION <path>)
```

##### `DESTINATION <path>`
The desired location to save the downloaded AppRun file.

#### `download_app_image_tool`

Fetches the AppImageTool utility, used to create and package AppImages.

```cmake
download_app_image_tool(DESTINATION <path>)
```

##### `DESTINATION <path>`
The directory where the AppImageTool file will be saved.

#### `add_app_image`

The core function to define and generate an AppImage for the application.

```cmake
add_app_image(
  <target>
  [DESTINATION <path>]
  NAME <string>
  DESCRIPTION <string>
  [ICON <path>]
  [CATEGORY <string>]
  [TARGET <target>]
  [EXECUTABLE <path>]
  [APP_DIR <path>]
  [RESOURCES [FILE|DIR <from> <to>]... ]
  [DEPENDS <target...>]
)
```

##### `<target>` 
The name of the CMake target to create.

##### `DESTINATION <path>`
The output path for the generated AppImage file. Defaults to `"${NAME}.AppImage"`.

##### `NAME <string>`
The name of the application.

##### `DESCRIPTION <string>`
A short description of the application.

##### `ICON <path>`
Path to the application icon file.

##### `CATEGORY <string>`
The category for the app in Linux application menus.

##### `TARGET <target>`
An existing CMake target to execute as the main application entry point.

##### `EXECUTABLE <path>`
The direct path to the executable file. Use if not using the `TARGET` option.

##### `APP_DIR <path>`
The base directory to use for the AppImage contents. Defaults to `"${NAME}.AppDir"`.

##### `RESOURCES [FILE|DIR <from> <to>]...`
Additional files or directories to include in the AppImage.

###### `FILE <from> <to>`
Copies a single file from `<from>` to `<to>` inside the AppImage.

###### `DIR <from> <to>`
Copies an entire directory from `<from>` to `<to>` inside the AppImage.

##### `DEPENDS <target...>`
CMake targets the AppImage build depends on.

## License

Apache-2.0
