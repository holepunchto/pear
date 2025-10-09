cmake_minimum_required(VERSION 3.31)

find_package(cmake-pear REQUIRED PATHS node_modules/cmake-pear)

project(pear_appling C CXX ASM)

add_pear_appling(
  pear_appling
  ID "__id__"
  NAME "__name__"
  LINK "__link__"
  VERSION "__version__"
  AUTHOR "__author__"
  DESCRIPTION "__description__"

  MACOS_IDENTIFIER "__darwin_identifier__"
  MACOS_CATEGORY "__darwin_category__"
  MACOS_SIGNING_IDENTITY "__darwin_signing_identity__"
  MACOS_ENTITLEMENTS "__darwin_entitlements__"
  MACOS_ICON "icons/darwin/icon.png"

  WINDOWS_SIGNING_SUBJECT "__win32_signing_subject__"
  WINDOWS_SIGNING_THUMBPRINT "__win32_signing_thumbprint__"
  WINDOWS_ICON "icons/win32/icon.png"

  LINUX_CATEGORY "__linux_category__"
  LINUX_ICON "icons/linux/icon.png"
)
