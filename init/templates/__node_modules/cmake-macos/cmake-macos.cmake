include_guard()

set(macos_module_dir "${CMAKE_CURRENT_LIST_DIR}")

function(find_codesign result)
  find_program(
    codesign
    NAMES codesign
    REQUIRED
  )

  set(${result} "${codesign}")

  return(PROPAGATE ${result})
endfunction()

function(find_iconutil result)
  find_program(
    iconutil
    NAMES iconutil
    REQUIRED
  )

  set(${result} "${iconutil}")

  return(PROPAGATE ${result})
endfunction()

function(add_macos_entitlements target)
  set(one_value_keywords
    DESTINATION
  )

  set(multi_value_keywords
    ENTITLEMENTS
  )

  cmake_parse_arguments(
    PARSE_ARGV 1 ARGV "" "${one_value_keywords}" "${multi_value_keywords}"
  )

  if(NOT ARGV_DESTINATION)
    set(ARGV_DESTINATION Entitlements.plist)
  endif()

  cmake_path(ABSOLUTE_PATH ARGV_DESTINATION BASE_DIRECTORY "${CMAKE_CURRENT_BINARY_DIR}" NORMALIZE)

  list(TRANSFORM ARGV_ENTITLEMENTS PREPEND "<key>")

  list(TRANSFORM ARGV_ENTITLEMENTS APPEND "</key>\n<true/>")

  list(JOIN ARGV_ENTITLEMENTS "\n" ARGV_ENTITLEMENTS)

  file(READ "${macos_module_dir}/Entitlements.plist" template)

  string(CONFIGURE "${template}" template)

  file(GENERATE OUTPUT "${ARGV_DESTINATION}" CONTENT "${template}" NEWLINE_STYLE UNIX)
endfunction()

function(add_macos_iconset target)
  set(one_value_keywords
    DESTINATION
  )

  set(multi_value_keywords
    ICONS
    DEPENDS
  )

  cmake_parse_arguments(
    PARSE_ARGV 1 ARGV "" "${one_value_keywords}" "${multi_value_keywords}"
  )

  if(NOT ARGV_DESTINATION)
    set(ARGV_DESTINATION icon.icns)
  endif()

  cmake_path(ABSOLUTE_PATH ARGV_DESTINATION BASE_DIRECTORY "${CMAKE_CURRENT_BINARY_DIR}" NORMALIZE)

  cmake_path(GET ARGV_DESTINATION STEM stem)

  set(commands)

  while(TRUE)
    list(LENGTH ARGV_ICONS len)

    if(len LESS 3)
      break()
    endif()

    list(POP_FRONT ARGV_ICONS path size scale)

    cmake_path(ABSOLUTE_PATH path NORMALIZE)

    if(NOT size MATCHES "^(16|32|64|128|256|512)$")
      continue()
    endif()

    if(NOT scale MATCHES "^(1|2)x$")
      continue()
    endif()

    if(scale EQUAL "1x")
      set(scale "")
    else()
      set(scale "@${scale}")
    endif()

    list(APPEND commands
      COMMAND ${CMAKE_COMMAND} -E copy_if_different "${path}" "${stem}.iconset/icon_${size}x${size}${scale}.png"
    )
  endwhile()

  find_iconutil(iconutil)

  list(APPEND commands
    COMMAND ${iconutil} --convert icns --output "${ARGV_DESTINATION}" "${stem}.iconset"
  )

  add_custom_target(
    ${target}
    ALL
    ${commands}
    DEPENDS ${ARGV_DEPENDS}
  )
endfunction()

function(add_macos_bundle_info target)
  set(one_value_keywords
    DESTINATION
    NAME
    VERSION
    DISPLAY_NAME
    PUBLISHER_DISPLAY_NAME
    IDENTIFIER
    CATEGORY
    TARGET
    EXECUTABLE
  )

  cmake_parse_arguments(
    PARSE_ARGV 1 ARGV "" "${one_value_keywords}" ""
  )

  if(NOT ARGV_DESTINATION)
    set(ARGV_DESTINATION Info.plist)
  endif()

  cmake_path(ABSOLUTE_PATH ARGV_DESTINATION BASE_DIRECTORY "${CMAKE_CURRENT_BINARY_DIR}" NORMALIZE)

  if(ARGV_TARGET)
    set(ARGV_EXECUTABLE $<TARGET_FILE:${ARGV_TARGET}>)

    set(ARGV_EXECUTABLE_NAME $<TARGET_FILE_NAME:${ARGV_TARGET}>)
  else()
    cmake_path(ABSOLUTE_PATH ARGV_EXECUTABLE NORMALIZE)

    cmake_path(GET ARGV_EXECUTABLE FILENAME ARGV_EXECUTABLE_NAME)
  endif()

  if(NOT DEFINED ARGV_DISPLAY_NAME)
    set(ARGV_DISPLAY_NAME "${ARGV_NAME}")
  endif()

  file(READ "${macos_module_dir}/Info.plist" template)

  string(CONFIGURE "${template}" template)

  file(GENERATE OUTPUT "${ARGV_DESTINATION}" CONTENT "${template}" NEWLINE_STYLE UNIX)
endfunction()

function(add_macos_bundle target)
  set(one_value_keywords
    DESTINATION
    INFO
    ICON
    TARGET
    EXECUTABLE
  )

  set(multi_value_keywords
    RESOURCES
    DEPENDS
  )

  cmake_parse_arguments(
    PARSE_ARGV 1 ARGV "" "${one_value_keywords}" "${multi_value_keywords}"
  )

  cmake_path(ABSOLUTE_PATH ARGV_DESTINATION BASE_DIRECTORY "${CMAKE_CURRENT_BINARY_DIR}" NORMALIZE)

  cmake_path(GET ARGV_DESTINATION PARENT_PATH base)

  if(ARGV_TARGET)
    set(ARGV_EXECUTABLE $<TARGET_FILE:${ARGV_TARGET}>)

    set(ARGV_EXECUTABLE_NAME $<TARGET_FILE_NAME:${ARGV_TARGET}>)
  else()
    cmake_path(ABSOLUTE_PATH ARGV_EXECUTABLE NORMALIZE)

    cmake_path(GET ARGV_EXECUTABLE FILENAME ARGV_EXECUTABLE_NAME)
  endif()

  if(ARGV_INFO)
    cmake_path(ABSOLUTE_PATH ARGV_INFO NORMALIZE)
  else()
    cmake_path(APPEND base "Info.plist" OUTPUT_VARIABLE ARGV_INFO)
  endif()

  if(ARGV_ICON)
    cmake_path(ABSOLUTE_PATH ARGV_ICON NORMALIZE)
  else()
    cmake_path(APPEND base "icon.icns" OUTPUT_VARIABLE ARGV_ICON)
  endif()

  set(commands
    COMMAND ${CMAKE_COMMAND} -E copy_if_different "${ARGV_INFO}" "${ARGV_DESTINATION}/Contents/Info.plist"
  )

  list(APPEND ARGV_RESOURCES FILE "${ARGV_ICON}" "icon.icns")

  while(TRUE)
    list(LENGTH ARGV_RESOURCES len)

    if(len LESS 3)
      break()
    endif()

    list(POP_FRONT ARGV_RESOURCES type from to)

    cmake_path(ABSOLUTE_PATH from NORMALIZE)

    if(type MATCHES "FILE")
      set(command copy_if_different)
    elseif(type MATCHES "DIR")
      set(command copy_directory_if_different)
    else()
      continue()
    endif()

    list(APPEND commands
      COMMAND ${CMAKE_COMMAND} -E ${command} "${from}" "${ARGV_DESTINATION}/Contents/Resources/${to}"
    )
  endwhile()

  list(APPEND commands
    COMMAND ${CMAKE_COMMAND} -E copy_if_different "${ARGV_EXECUTABLE}" "${ARGV_DESTINATION}/Contents/MacOS/${ARGV_EXECUTABLE_NAME}"

    COMMAND ${CMAKE_COMMAND} -E copy_if_different "${macos_module_dir}/PkgInfo" "${ARGV_DESTINATION}/Contents/PkgInfo"
  )

  add_custom_target(
    ${target}
    ALL
    ${commands}
    DEPENDS ${ARGV_DEPENDS}
  )
endfunction()

function(code_sign_macos target)
  set(one_value_keywords
    PATH
    TARGET
    ENTITLEMENTS
    IDENTITY
    KEYCHAIN
  )

  set(multi_value_keywords
    DEPENDS
  )

  cmake_parse_arguments(
    PARSE_ARGV 1 ARGV "" "${one_value_keywords}" "${multi_value_keywords}"
  )

  if(ARGV_TARGET)
    set(ARGV_PATH $<TARGET_FILE:${ARGV_TARGET}>)

    set(base $<TARGET_FILE_DIR:${ARGV_TARGET}>)
  else()
    cmake_path(ABSOLUTE_PATH ARGV_PATH NORMALIZE)

    cmake_path(GET ARGV_PATH PARENT_PATH base)
  endif()

  if(NOT ARGV_IDENTITY)
    set(ARGV_IDENTITY "Apple Development")
  endif()

  if(ARGV_ENTITLEMENTS)
    cmake_path(ABSOLUTE_PATH ARGV_ENTITLEMENTS NORMALIZE)
  else()
    cmake_path(APPEND base "Entitlements.plist" OUTPUT_VARIABLE ARGV_ENTITLEMENTS)
  endif()

  set(args
    --timestamp
    --force
    --options runtime
    --entitlements "${ARGV_ENTITLEMENTS}"
    --sign "${ARGV_IDENTITY}"
  )

  if(ARGS_KEYCHAIN)
    list(APPEND args --keychain "${ARGV_KEYCHAIN}")
  endif()

  find_codesign(codesign)

  add_custom_target(
    ${target}
    ALL
    COMMAND ${codesign} ${args} "${ARGV_PATH}"
    DEPENDS ${ARGV_DEPENDS}
  )
endfunction()
