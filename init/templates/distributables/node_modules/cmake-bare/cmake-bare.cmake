include_guard()

find_package(cmake-npm REQUIRED PATHS node_modules/cmake-npm)

set(bare_module_dir "${CMAKE_CURRENT_LIST_DIR}")

function(download_bare result)
  set(one_value_keywords
    DESTINATION
    VERSION
    IMPORT_FILE
  )

  cmake_parse_arguments(
    PARSE_ARGV 1 ARGV "" "${one_value_keywords}" ""
  )

  if(NOT ARGV_DESTINATION)
    set(ARGV_DESTINATION "${CMAKE_CURRENT_BINARY_DIR}/_bare")
  endif()

  if(NOT ARGV_VERSION)
    set(ARGV_VERSION "latest")
  endif()

  if(NOT EXISTS "${ARGV_DESTINATION}/package.json")
    file(WRITE "${ARGV_DESTINATION}/package.json" "{}")
  endif()

  bare_target(target)

  install_node_module(
    bare-runtime-${target}
    VERSION ${ARGV_VERSION}
    SAVE
    FORCE
    WORKING_DIRECTORY "${ARGV_DESTINATION}"
  )

  resolve_node_module(
    bare-runtime-${target}
    output
    WORKING_DIRECTORY "${ARGV_DESTINATION}"
  )

  set(import_file ${ARGV_IMPORT_FILE})

  if(target MATCHES "win32")
    cmake_path(APPEND output bin bare.exe OUTPUT_VARIABLE ${result})

    if(import_file)
      cmake_path(APPEND output lib bare.lib OUTPUT_VARIABLE ${import_file})
    endif()
  else()
    cmake_path(APPEND output bin bare OUTPUT_VARIABLE ${result})

    if(import_file)
      if(target MATCHES "darwin|ios")
        cmake_path(APPEND output lib libbare.tbd OUTPUT_VARIABLE ${import_file})
      else()
        set(${import_file} ${import_file}-NOTFOUND)
      endif()
    endif()
  endif()

  return(PROPAGATE ${result} ${import_file})
endfunction()

function(download_bare_headers result)
  set(one_value_keywords
    DESTINATION
    VERSION
  )

  cmake_parse_arguments(
    PARSE_ARGV 1 ARGV "" "${one_value_keywords}" ""
  )

  if(NOT ARGV_DESTINATION)
    set(ARGV_DESTINATION "${CMAKE_CURRENT_BINARY_DIR}/_bare")
  endif()

  if(NOT ARGV_VERSION)
    set(ARGV_VERSION "latest")
  endif()

  if(NOT EXISTS "${ARGV_DESTINATION}/package.json")
    file(WRITE "${ARGV_DESTINATION}/package.json" "{}")
  endif()

  install_node_module(
    bare-headers
    VERSION ${ARGV_VERSION}
    SAVE
    FORCE
    WORKING_DIRECTORY "${ARGV_DESTINATION}"
  )

  resolve_node_module(
    bare-headers
    output
    WORKING_DIRECTORY "${ARGV_DESTINATION}"
  )

  cmake_path(APPEND output include OUTPUT_VARIABLE ${result})

  return(PROPAGATE ${result})
endfunction()

function(bare_platform result)
  set(platform ${CMAKE_SYSTEM_NAME})

  if(NOT platform)
    set(platform ${CMAKE_HOST_SYSTEM_NAME})
  endif()

  string(TOLOWER "${platform}" platform)

  if(platform MATCHES "darwin|ios|linux|android")
    set(${result} ${platform})
  elseif(platform MATCHES "windows")
    set(${result} "win32")
  else()
    set(${result} "unknown")
  endif()

  return(PROPAGATE ${result})
endfunction()

function(bare_arch result)
  if(APPLE AND CMAKE_OSX_ARCHITECTURES)
    set(arch ${CMAKE_OSX_ARCHITECTURES})
  elseif(MSVC AND CMAKE_GENERATOR_PLATFORM)
    set(arch ${CMAKE_GENERATOR_PLATFORM})
  elseif(ANDROID AND CMAKE_ANDROID_ARCH_ABI)
    set(arch ${CMAKE_ANDROID_ARCH_ABI})
  else()
    set(arch ${CMAKE_SYSTEM_PROCESSOR})
  endif()

  if(NOT arch)
    set(arch ${CMAKE_HOST_SYSTEM_PROCESSOR})
  endif()

  string(TOLOWER "${arch}" arch)

  if(arch MATCHES "arm64|aarch64")
    set(${result} "arm64")
  elseif(arch MATCHES "armv7-a|armeabi-v7a")
    set(${result} "arm")
  elseif(arch MATCHES "x64|x86_64|amd64")
    set(${result} "x64")
  elseif(arch MATCHES "x86|i386|i486|i586|i686")
    set(${result} "ia32")
  elseif(arch MATCHES "mipsel")
    set(${result} "mipsel")
  elseif(arch MATCHES "mips(eb)?")
    set(${result} "mips")
  else()
    set(${result} "unknown")
  endif()

  return(PROPAGATE ${result})
endfunction()

function(bare_simulator result)
  set(sysroot ${CMAKE_OSX_SYSROOT})

  if(sysroot MATCHES "iPhoneSimulator")
    set(${result} YES)
  else()
    set(${result} NO)
  endif()

  return(PROPAGATE ${result})
endfunction()

function(bare_environment result)
  set(environment "")

  if(APPLE AND CMAKE_OSX_SYSROOT MATCHES "iPhoneSimulator")
    set(environment "simulator")
  elseif(LINUX AND CMAKE_C_COMPILER_TARGET MATCHES "-(musl(sf))?")
    set(environment "${CMAKE_MATCH_1}")
  endif()

  set(${result} ${environment})

  return(PROPAGATE ${result})
endfunction()

function(bare_target result)
  bare_platform(platform)
  bare_arch(arch)
  bare_environment(environment)

  set(target ${platform}-${arch})

  if(environment)
    set(target ${target}-${environment})
  endif()

  set(${result} ${target})

  return(PROPAGATE ${result})
endfunction()

function(bare_module_target directory result)
  set(one_value_keywords
    NAME
    VERSION
    HASH
  )

  cmake_parse_arguments(
    PARSE_ARGV 2 ARGV "" "${one_value_keywords}" ""
  )

  set(package_path package.json)

  cmake_path(ABSOLUTE_PATH directory NORMALIZE)

  cmake_path(ABSOLUTE_PATH package_path BASE_DIRECTORY "${directory}" NORMALIZE)

  file(READ "${package_path}" package)

  string(JSON name GET "${package}" "name")

  if(name MATCHES "__")
    message(FATAL_ERROR "Package name '${name}' is invalid")
  endif()

  string(REGEX REPLACE "/" "__" name ${name})
  string(REGEX REPLACE "^@" "" name ${name})

  string(JSON version GET "${package}" "version")

  string(SHA256 hash "bare ${package_path}")

  string(SUBSTRING "${hash}" 0 8 hash)

  set(${result} "${name}-${version}-${hash}")

  if(ARGV_NAME)
    set(${ARGV_NAME} ${name} PARENT_SCOPE)
  endif()

  if(ARGV_VERSION)
    set(${ARGV_VERSION} ${version} PARENT_SCOPE)
  endif()

  if(ARGV_HASH)
    set(${ARGV_HASH} ${hash} PARENT_SCOPE)
  endif()

  return(PROPAGATE ${result})
endfunction()

function(add_bare_module result)
  set(option_keywords
    EXPORTS
  )

  cmake_parse_arguments(
    PARSE_ARGV 1 ARGV "${option_keywords}" "" ""
  )

  download_bare_headers(bare_headers)

  bare_module_target("." target NAME name VERSION version)

  string(REGEX MATCH "^[0-9]+" major "${version}")

  add_library(${target} OBJECT)

  set_target_properties(
    ${target}
    PROPERTIES
    C_STANDARD 11
    CXX_STANDARD 20
    POSITION_INDEPENDENT_CODE ON
  )

  target_compile_definitions(
    ${target}
    PRIVATE
      BARE_MODULE_NAME="${name}@${version}"
  )

  target_include_directories(
    ${target}
    PRIVATE
      ${bare_headers}
  )

  set(${result} ${target})

  if(ARGV_EXPORTS)
    set(exports ON)
  else()
    set(exports OFF)
  endif()

  add_library(${target}_module SHARED)

  set_target_properties(
    ${target}_module
    PROPERTIES

    ENABLE_EXPORTS ${exports}

    # Set the logical name of the addon which is tied to its major version. This
    # is NOT the name of the addon as it will be installed, but is the name that
    # the linker will use to refer to the corresponding binary.
    OUTPUT_NAME ${name}@${major}
    PREFIX ""
    SUFFIX ".bare"
    IMPORT_PREFIX ""
    IMPORT_SUFFIX ".bare.exports"

    # Remove the runtime search path for ELF binaries and directory portion of
    # the install name for Mach-O binaries. This ensures that the addon is
    # identified by the linker only by its logical name.
    INSTALL_RPATH ""
    INSTALL_NAME_DIR ""
    BUILD_WITH_INSTALL_RPATH ON
    BUILD_WITH_INSTALL_NAME_DIR ON

    # Set the Mach-O compatibility versions for macOS and iOS. This is mostly
    # for debugging purposes as the addon version is already encoded in its
    # logical name.
    MACHO_CURRENT_VERSION ${version}
    MACHO_COMPATIBILITY_VERSION ${major}

    # Automatically export all available symbols on Windows. Without this,
    # module authors would have to explicitly export public symbols.
    WINDOWS_EXPORT_ALL_SYMBOLS ON
  )

  target_link_libraries(
    ${target}_module
    PRIVATE
      ${target}
  )

  bare_target(host)

  if(host MATCHES "win32")
    download_bare(bare_bin IMPORT_FILE bare_lib)

    add_library(${target}_import_library SHARED IMPORTED)

    set_target_properties(
      ${target}_import_library
      PROPERTIES
      ENABLE_EXPORTS ON
      IMPORTED_LOCATION "${bare_bin}"
      IMPORTED_IMPLIB "${bare_lib}"
    )

    if(NOT TARGET bare_delay_load)
      add_library(bare_delay_load STATIC)

      target_sources(
        bare_delay_load
        PRIVATE
          "${bare_module_dir}/win32/delay-load.c"
      )

      target_include_directories(
        bare_delay_load
        PRIVATE
          ${bare_headers}
      )

      target_link_libraries(
        bare_delay_load
        INTERFACE
          delayimp
      )

      target_link_options(
        bare_delay_load
        INTERFACE
          /DELAYLOAD:bare.exe
          /DELAYLOAD:bare.dll
      )
    endif()

    target_link_libraries(
      ${target}_module
      PRIVATE
        ${target}_import_library
      PUBLIC
        bare_delay_load
    )

    target_link_options(
      ${target}_module
      INTERFACE
        /DELAYLOAD:${name}@${major}.bare
    )
  else()
    target_link_options(
      ${target}_module
      PRIVATE
        -Wl,-undefined,dynamic_lookup
    )
  endif()

  install(
    FILES $<TARGET_FILE:${target}_module>
    DESTINATION ${host}
    RENAME ${name}.bare
  )

  if(ARGV_EXPORTS)
    install(
      FILES $<TARGET_IMPORT_FILE:${target}_module>
      DESTINATION ${host}
      RENAME ${name}.bare.exports
    )
  endif()

  return(PROPAGATE ${result})
endfunction()

function(include_bare_module specifier result)
  set(option_keywords
    PREBUILD
  )

  set(one_value_keywords
    SOURCE_DIR
    BINARY_DIR
    WORKING_DIRECTORY
  )

  cmake_parse_arguments(
    PARSE_ARGV 2 ARGV "${option_keywords}" "${one_value_keywords}" ""
  )

  if(ARGV_WORKING_DIRECTORY)
    cmake_path(ABSOLUTE_PATH ARGV_WORKING_DIRECTORY BASE_DIRECTORY "${CMAKE_CURRENT_LIST_DIR}" NORMALIZE)
  else()
    set(ARGV_WORKING_DIRECTORY "${CMAKE_CURRENT_LIST_DIR}")
  endif()

  resolve_node_module(
    ${specifier}
    source_dir
    WORKING_DIRECTORY "${ARGV_WORKING_DIRECTORY}"
  )

  bare_module_target("${source_dir}" target NAME name VERSION version)

  string(REGEX MATCH "^[0-9]+" major "${version}")

  set(${result} ${target})

  cmake_path(RELATIVE_PATH source_dir BASE_DIRECTORY "${ARGV_WORKING_DIRECTORY}" OUTPUT_VARIABLE binary_dir)

  if(ARGV_SOURCE_DIR)
    set(${ARGV_SOURCE_DIR} "${source_dir}" PARENT_SCOPE)
  endif()

  if(ARGV_BINARY_DIR)
    set(${ARGV_BINARY_DIR} "${binary_dir}" PARENT_SCOPE)
  endif()

  if(ARGV_PREBUILD)
    bare_target(host)

    cmake_path(APPEND source_dir "prebuilds" "${host}" "${name}.bare" OUTPUT_VARIABLE prebuild)

    add_library(${target}_module SHARED IMPORTED)

    set_target_properties(
      ${target}_module
      PROPERTIES
      IMPORTED_LOCATION "${prebuild}"
      IMPORTED_IMPLIB "${prebuild}.exports"
    )

    if(host MATCHES "win32")
      target_link_options(
        ${target}_module
        INTERFACE
          /DELAYLOAD:${name}@${major}.bare
      )
    endif()
  elseif(NOT TARGET ${target})
    add_subdirectory("${source_dir}" "${binary_dir}" EXCLUDE_FROM_ALL)
  endif()

  return(PROPAGATE ${result})
endfunction()

function(link_bare_module receiver specifier)
  set(option_keywords
    SHARED
  )

  set(one_value_keywords
    WORKING_DIRECTORY
  )

  cmake_parse_arguments(
    PARSE_ARGV 2 ARGV "${option_keywords}" "${one_value_keywords}" ""
  )

  if(ARGV_WORKING_DIRECTORY)
    cmake_path(ABSOLUTE_PATH ARGV_WORKING_DIRECTORY BASE_DIRECTORY "${CMAKE_CURRENT_LIST_DIR}" NORMALIZE)
  else()
    set(ARGV_WORKING_DIRECTORY "${CMAKE_CURRENT_LIST_DIR}")
  endif()

  if(ARGV_SHARED)
    set(PREBUILD PREBUILD)
  else()
    set(PREBUILD)
  endif()

  include_bare_module(
    ${specifier}
    target
    ${PREBUILD}
    SOURCE_DIR source_dir
    WORKING_DIRECTORY "${ARGV_WORKING_DIRECTORY}"
  )

  if(ARGV_SHARED)
    target_link_libraries(
      ${receiver}
      PRIVATE
        ${target}_module
    )
  else()
    bare_module_target("${source_dir}" target NAME name VERSION version HASH hash)

    string(MAKE_C_IDENTIFIER ${target} id)

    target_compile_definitions(
      ${target}
      PRIVATE
        BARE_MODULE_NAME="${name}@${version}"
        BARE_MODULE_REGISTER_CONSTRUCTOR
        BARE_MODULE_CONSTRUCTOR_VERSION=${hash}

        NAPI_MODULE_FILENAME="${name}@${version}"
        NAPI_MODULE_REGISTER_CONSTRUCTOR
        NAPI_MODULE_CONSTRUCTOR_VERSION=${hash}

        NODE_GYP_MODULE_NAME=${id}
    )

    target_link_libraries(
      ${receiver}
      PRIVATE
        $<TARGET_OBJECTS:${target}>
      PRIVATE
        ${target}
    )
  endif()
endfunction()

function(link_bare_modules receiver)
  set(option_keywords
    SHARED
  )

  set(one_value_keywords
    WORKING_DIRECTORY
  )

  set(multi_value_keywords
    EXCLUDE
  )

  cmake_parse_arguments(
    PARSE_ARGV 1 ARGV "${option_keywords}" "${one_value_keywords}" "${multi_value_keywords}"
  )

  if(ARGV_WORKING_DIRECTORY)
    cmake_path(ABSOLUTE_PATH ARGV_WORKING_DIRECTORY BASE_DIRECTORY "${CMAKE_CURRENT_LIST_DIR}" NORMALIZE)
  else()
    set(ARGV_WORKING_DIRECTORY "${CMAKE_CURRENT_LIST_DIR}")
  endif()

  if(ARGV_SHARED)
    set(SHARED SHARED)
  else()
    set(SHARED)
  endif()

  list_node_modules(
    packages
    WORKING_DIRECTORY "${ARGV_WORKING_DIRECTORY}"
  )

  foreach(base ${packages})
    cmake_path(APPEND base package.json OUTPUT_VARIABLE package_path)

    file(READ "${package_path}" package)

    string(JSON name ERROR_VARIABLE error GET "${package}" "name")

    if("${name}" IN_LIST ARGV_EXCLUDE)
      continue()
    endif()

    string(JSON addon ERROR_VARIABLE error GET "${package}" "addon")

    if(addon)
      link_bare_module(
        ${receiver}
        ${base}
        ${SHARED}
        WORKING_DIRECTORY "${ARGV_WORKING_DIRECTORY}"
      )
    endif()
  endforeach()
endfunction()
