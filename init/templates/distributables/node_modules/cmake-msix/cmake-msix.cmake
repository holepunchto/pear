include_guard()

find_package(cmake-windows REQUIRED PATHS node_modules/cmake-windows)

set(msix_module_dir "${CMAKE_CURRENT_LIST_DIR}")

function(find_make_appx result)
  find_windows_sdk(BIN sdk_bin_dir)

  find_program(
    make_appx
    NAMES MakeAppx
    PATHS "${sdk_bin_dir}"
    REQUIRED
  )

  set(${result} "${make_appx}")

  return(PROPAGATE ${result})
endfunction()

function(add_appx_manifest target)
  set(one_value_keywords
    DESTINATION
    NAME
    VERSION
    PUBLISHER
    DISPLAY_NAME
    PUBLISHER_DISPLAY_NAME
    DESCRIPTION
    ARCH
  )

  set(multi_value_keywords
    UNVIRTUALIZED_PATHS
  )

  cmake_parse_arguments(
    PARSE_ARGV 1 ARGV "" "${one_value_keywords}" "${multi_value_keywords}"
  )

  if(NOT ARGV_DESTINATION)
    set(ARGV_DESTINATION AppxManifest.xml)
  endif()

  if(NOT DEFINED ARGV_DISPLAY_NAME)
    set(ARGV_DISPLAY_NAME "${ARGV_NAME}")
  endif()

  if(NOT ARGV_ARCH)
    if(MSVC AND CMAKE_GENERATOR_PLATFORM)
      set(arch ${CMAKE_GENERATOR_PLATFORM})
    elseif(CMAKE_SYSTEM_PROCESSOR)
      set(arch ${CMAKE_SYSTEM_PROCESSOR})
    else()
      set(arch ${CMAKE_HOST_SYSTEM_PROCESSOR})
    endif()

    string(TOLOWER "${arch}" arch)

    if(arch MATCHES "arm64|aarch64")
      set(ARGV_ARCH "arm64")
    elseif(arch MATCHES "armv7-a|armeabi-v7a")
      set(ARGV_ARCH "arm")
    elseif(arch MATCHES "x64|x86_64|amd64")
      set(ARGV_ARCH "x64")
    elseif(arch MATCHES "x86|i386|i486|i586|i686")
      set(ARGV_ARCH "x86")
    else()
      message(FATAL_ERROR "Unable to detect target architecture")
    endif()
  endif()

  list(TRANSFORM ARGV_UNVIRTUALIZED_PATHS PREPEND "<virtualization:ExcludedDirectory>")

  list(TRANSFORM ARGV_UNVIRTUALIZED_PATHS APPEND "</virtualization:ExcludedDirectory>")

  list(JOIN ARGV_UNVIRTUALIZED_PATHS "" ARGV_UNVIRTUALIZED_PATHS)

  file(READ "${msix_module_dir}/AppxManifest.xml" template)

  string(CONFIGURE "${template}" template)

  file(GENERATE OUTPUT "${ARGV_DESTINATION}" CONTENT "${template}" NEWLINE_STYLE WIN32)
endfunction()

function(add_appx_mapping target)
  set(one_value_keywords
    DESTINATION
    ICON
    TARGET
    EXECUTABLE
  )

  set(multi_value_keywords
    RESOURCES
  )

  cmake_parse_arguments(
    PARSE_ARGV 1 ARGV "" "${one_value_keywords}" "${multi_value_keywords}"
  )

  if(NOT ARGV_DESTINATION)
    set(ARGV_DESTINATION Mapping.txt)
  endif()

  string(APPEND template "[Files]\n")

  if(ARGV_TARGET)
    set(ARGV_EXECUTABLE $<TARGET_FILE:${ARGV_TARGET}>)

    set(ARGV_EXECUTABLE_NAME $<TARGET_FILE_NAME:${ARGV_TARGET}>)
  else()
    cmake_path(ABSOLUTE_PATH ARGV_EXECUTABLE NORMALIZE)

    cmake_path(GET ARGV_EXECUTABLE FILENAME ARGV_EXECUTABLE_NAME)
  endif()

  string(APPEND template "\"${ARGV_EXECUTABLE}\" \"${ARGV_EXECUTABLE_NAME}\"\n")

  if(ARGV_ICON)
    list(APPEND ARGV_RESOURCES FILE "${ARGV_ICON}" "icon.png" )
  endif()

  while(TRUE)
    list(LENGTH ARGV_RESOURCES len)

    if(len LESS 3)
      break()
    endif()

    list(POP_FRONT ARGV_RESOURCES type from to)

    cmake_path(ABSOLUTE_PATH from NORMALIZE)

    if(NOT type MATCHES "FILE" AND NOT type MATCHES "DIR")
      continue()
    endif()

    string(APPEND template "\"${from}\" \"${to}\"\n")
  endwhile()

  file(GENERATE OUTPUT "${ARGV_DESTINATION}" CONTENT "${template}" NEWLINE_STYLE WIN32)
endfunction()

function(add_msix_package target)
  set(one_value_keywords
    DESTINATION
    MANIFEST
    MAPPING
  )

  set(multi_value_keywords
    DEPENDS
  )

  cmake_parse_arguments(
    PARSE_ARGV 1 ARGV "" "${one_value_keywords}" "${multi_value_keywords}"
  )

  cmake_path(ABSOLUTE_PATH ARGV_DESTINATION BASE_DIRECTORY "${CMAKE_CURRENT_BINARY_DIR}" NORMALIZE)

  cmake_path(GET ARGV_DESTINATION PARENT_PATH base)

  if(ARGV_MANIFEST)
    cmake_path(ABSOLUTE_PATH ARGV_MANIFEST NORMALIZE)
  else()
    cmake_path(APPEND base "AppxManifest.xml" OUTPUT_VARIABLE ARGV_MANIFEST)
  endif()

  if(ARGV_MAPPING)
    cmake_path(ABSOLUTE_PATH ARGV_MAPPING NORMALIZE)
  else()
    cmake_path(APPEND base "Mapping.txt" OUTPUT_VARIABLE ARGV_MAPPING)
  endif()

  list(APPEND ARGV_DEPENDS  "${ARGV_MANIFEST}" "${ARGV_MAPPING}")

  find_make_appx(make_appx)

  set(commands
    COMMAND "${make_appx}" pack /o /m "${ARGV_MANIFEST}" /f "${ARGV_MAPPING}" /p "${ARGV_DESTINATION}"
  )

  add_custom_target(
    ${target}
    ALL
    ${commands}
    DEPENDS ${ARGV_DEPENDS}
  )
endfunction()
