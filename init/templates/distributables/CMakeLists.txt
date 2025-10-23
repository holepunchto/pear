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
  SPLASH "icons/splash.png"

  MACOS_IDENTIFIER "__darwin.identifier__"
  MACOS_CATEGORY "__darwin.category__"
  MACOS_SIGNING_IDENTITY "__darwin.signingidentity__"
  MACOS_ENTITLEMENTS "__darwin.entitlements__"
  MACOS_ICON "icons/darwin/icon.png"

  WINDOWS_SIGNING_SUBJECT "__win.signingsubject__"
  WINDOWS_SIGNING_THUMBPRINT "__win.signingthumbprint__"
  WINDOWS_ICON "icons/win32/icon.png"

  LINUX_CATEGORY "__linux.category__"
  LINUX_ICON "icons/linux/icon.png"
)
