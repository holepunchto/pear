include_guard()

find_package(cmake-bare REQUIRED PATHS node_modules/cmake-bare)
find_package(cmake-fetch REQUIRED PATHS node_modules/cmake-fetch)
find_package(cmake-macos REQUIRED PATHS node_modules/cmake-macos)
find_package(cmake-app-image REQUIRED PATHS node_modules/cmake-app-image)
find_package(cmake-windows REQUIRED PATHS node_modules/cmake-windows)
find_package(cmake-msix REQUIRED PATHS node_modules/cmake-msix)

set(pear_module_dir "${CMAKE_CURRENT_LIST_DIR}")

function(configure_pear_appling_macos target)
  set(one_value_keywords
    NAME
    VERSION
    AUTHOR
    SPLASH
    IDENTIFIER
    ICON
    CATEGORY
    SIGNING_IDENTITY
    SIGNING_KEYCHAIN
  )

  set(multi_value_keywords
    ENTITLEMENTS
  )

  cmake_parse_arguments(
    PARSE_ARGV 1 ARGV "" "${one_value_keywords}" "${multi_value_keywords}"
  )

  if(NOT ARGV_ICON)
    set(ARGV_ICON "assets/darwin/icon.png")
  endif()

  list(PREPEND ARGV_ENTITLEMENTS
    com.apple.security.cs.allow-jit
    com.apple.security.cs.allow-unsigned-executable-memory
    com.apple.security.cs.allow-dyld-environment-variables
    com.apple.security.cs.disable-library-validation
  )

  set_target_properties(
    ${target}
    PROPERTIES
    OUTPUT_NAME "${ARGV_NAME}"
  )

  add_macos_iconset(
    ${target}_icon
    ICONS
      "${ARGV_ICON}" 512 2x
  )

  add_macos_entitlements(
    ${target}_entitlements
    ENTITLEMENTS ${ARGV_ENTITLEMENTS}
  )

  add_macos_bundle_info(
    ${target}_bundle_info
    NAME "${ARGV_NAME}"
    VERSION "${ARGV_VERSION}"
    PUBLISHER_DISPLAY_NAME "${ARGV_AUTHOR}"
    IDENTIFIER "${ARGV_IDENTIFIER}"
    CATEGORY "${ARGV_CATEGORY}"
    TARGET ${target}
  )

  add_macos_bundle(
    ${target}_bundle
    DESTINATION "${ARGV_NAME}.app"
    TARGET ${target}
    RESOURCES
      FILE "${ARGV_SPLASH}" "splash.png"
    DEPENDS ${target}_icon
  )

  code_sign_macos(
    ${target}_sign
    PATH "${CMAKE_CURRENT_BINARY_DIR}/${ARGV_NAME}.app"
    IDENTITY "${ARGV_SIGNING_IDENTITY}"
    KEYCHAIN "${ARGV_SIGNING_KEYCHAIN}"
    DEPENDS ${target}_bundle
  )
endfunction()

function(configure_pear_appling_windows target)
  set(one_value_keywords
    NAME
    VERSION
    AUTHOR
    DESCRIPTION
    SPLASH
    ICON
    SIGNING_SUBJECT
    SIGNING_THUMBPRINT
  )

  cmake_parse_arguments(
    PARSE_ARGV 1 ARGV "" "${one_value_keywords}" ""
  )

  if(NOT ARGV_ICON)
    set(ARGV_ICON "assets/win32/icon.png")
  endif()

  set_target_properties(
    ${target}
    PROPERTIES
    OUTPUT_NAME "${ARGV_NAME}"
  )

  target_compile_options(
    ${target}
    PRIVATE
      /MT$<$<CONFIG:Debug>:d>
  )

  target_link_options(
    ${target}
    PRIVATE
      $<$<CONFIG:Release>:/subsystem:windows /entry:mainCRTStartup>
  )

  file(READ "${pear_module_dir}/app.manifest" manifest)

  string(CONFIGURE "${manifest}" manifest)

  file(GENERATE OUTPUT "${ARGV_NAME}.manifest" CONTENT "${manifest}" NEWLINE_STYLE WIN32)

  target_sources(
    ${target}
    PRIVATE
      "${CMAKE_CURRENT_BINARY_DIR}/${ARGV_NAME}.manifest"
  )

  code_sign_windows(
    ${target}_signature
    TARGET ${target}
    THUMBPRINT "${ARGV_SIGNING_THUMBPRINT}"
  )

  add_appx_manifest(
    ${target}_manifest
    NAME "${ARGV_NAME}"
    VERSION "${ARGV_VERSION}"
    DESCRIPTION "${ARGV_DESCRIPTION}"
    PUBLISHER "${ARGV_SIGNING_SUBJECT}"
    PUBLISHER_DISPLAY_NAME "${ARGV_AUTHOR}"
    UNVIRTUALIZED_PATHS "$(KnownFolder:RoamingAppData)\\pear"
  )

  add_appx_mapping(
    ${target}_mapping
    ICON "${ARGV_ICON}"
    TARGET ${target}
    RESOURCES
      FILE "${ARGV_SPLASH}" "splash.png"
  )

  add_msix_package(
    ${target}_package
    DESTINATION "${ARGV_NAME}.msix"
    DEPENDS ${target} ${target}_signature
  )

  code_sign_windows(
    ${target}_package_signature
    PATH "${CMAKE_CURRENT_BINARY_DIR}/${ARGV_NAME}.msix"
    THUMBPRINT "${ARGV_SIGNING_THUMBPRINT}"
    DEPENDS ${target}_package
  )
endfunction()

function(configure_pear_appling_linux target)
  set(one_value_keywords
    NAME
    DESCRIPTION
    ICON
    CATEGORY
    SPLASH
  )

  cmake_parse_arguments(
    PARSE_ARGV 1 ARGV "" "${one_value_keywords}" ""
  )

  if(NOT ARGV_ICON)
    set(ARGV_ICON "assets/linux/icon.png")
  endif()

  string(TOLOWER "${ARGV_NAME}" ARGV_OUTPUT_NAME)

  set_target_properties(
    ${target}
    PROPERTIES
    OUTPUT_NAME "${ARGV_OUTPUT_NAME}"
  )

  add_app_image(
    ${target}_app_image
    NAME "${ARGV_NAME}"
    DESCRIPTION "${ARGV_DESCRIPTION}"
    ICON "${ARGV_ICON}"
    CATEGORY "${ARGV_CATEGORY}"
    TARGET ${target}
    RESOURCES
      FILE "${ARGV_SPLASH}" "splash.png"
  )
endfunction()

function(add_pear_appling target)
  set(one_value_keywords
    ID
    NAME
    VERSION
    DESCRIPTION
    AUTHOR
    SPLASH

    MACOS_ICON
    MACOS_CATEGORY
    MACOS_IDENTIFIER
    MACOS_SIGNING_IDENTITY
    MACOS_SIGNING_KEYCHAIN

    WINDOWS_ICON
    WINDOWS_SIGNING_SUBJECT
    WINDOWS_SIGNING_THUMBPRINT

    LINUX_ICON
    LINUX_CATEGORY
  )

  set(multi_value_keywords
    MACOS_ENTITLEMENTS
  )

  cmake_parse_arguments(
    PARSE_ARGV 1 ARGV "" "${one_value_keywords}" "${multi_value_keywords}"
  )

  if(NOT ARGV_SPLASH)
    set(ARGV_SPLASH "assets/splash.png")
  endif()

  bare_target(host)

  fetch_package("github:holepunchto/bare#5d71064")
  fetch_package("github:holepunchto/libappling#d431edc")
  fetch_package("github:holepunchto/libfx#33678eb")
  fetch_package("github:holepunchto/libpear#ceb60d9")

  add_executable(${target})

  set_target_properties(
    ${target}
    PROPERTIES
    POSITION_INDEPENDENT_CODE ON
    LINKER_LANGUAGE CXX
  )

  target_sources(
    ${target}
    PRIVATE
      "${pear_module_dir}/app.c"
  )

  target_compile_definitions(
    ${target}
    PRIVATE
      ID="${ARGV_ID}"
      NAME="${ARGV_NAME}"
  )

  target_link_libraries(
    ${target}
    PRIVATE
      pear_static
  )

  if(host MATCHES "darwin")
    configure_pear_appling_macos(
      ${target}
      NAME "${ARGV_NAME}"
      VERSION "${ARGV_VERSION}"
      AUTHOR "${ARGV_AUTHOR}"
      SPLASH "${ARGV_SPLASH}"
      ICON "${ARGV_MACOS_ICON}"
      CATEGORY "${ARGV_MACOS_CATEGORY}"
      IDENTIFIER "${ARGV_MACOS_IDENTIFIER}"
      ENTITLEMENTS ${ARGV_MACOS_ENTITLEMENTS}
      SIGNING_IDENTITY "${ARGV_MACOS_SIGNING_IDENTITY}"
      SIGNING_KEYCHAIN "${ARGV_MACOS_SIGNING_KEYCHAIN}"
    )
  elseif(host MATCHES "win32")
    configure_pear_appling_windows(
      ${target}
      NAME "${ARGV_NAME}"
      VERSION "${ARGV_VERSION}"
      AUTHOR "${ARGV_AUTHOR}"
      DESCRIPTION "${ARGV_DESCRIPTION}"
      SPLASH "${ARGV_SPLASH}"
      ICON "${ARGV_WINDOWS_ICON}"
      SIGNING_SUBJECT "${ARGV_WINDOWS_SIGNING_SUBJECT}"
      SIGNING_THUMBPRINT "${ARGV_WINDOWS_SIGNING_THUMBPRINT}"
    )
  elseif(host MATCHES "linux")
    configure_pear_appling_linux(
      ${target}
      NAME "${ARGV_NAME}"
      DESCRIPTION "${ARGV_DESCRIPTION}"
      SPLASH "${ARGV_SPLASH}"
      ICON "${ARGV_LINUX_ICON}"
      CATEGORY "${ARGV_LINUX_CATEGORY}"
    )
  endif()
endfunction()
