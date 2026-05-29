@echo off
setlocal

if /I "%PROCESSOR_ARCHITECTURE%"=="AMD64" set "bare=%~dp0node_modules\bare-runtime-win32-x64\bin\bare.exe"
if /I "%PROCESSOR_ARCHITECTURE%"=="ARM64" set "bare=%~dp0node_modules\bare-runtime-win32-arm64\bin\bare.exe"

if not defined bare (
  echo Unsupported Windows architecture: %PROCESSOR_ARCHITECTURE% 1>&2
  exit /b 1
)

if not exist "%bare%" (
  echo Missing Bare runtime: %bare% 1>&2
  exit /b 1
)

"%bare%" "%~dp0boot.js" %*
exit /b %ERRORLEVEL%
