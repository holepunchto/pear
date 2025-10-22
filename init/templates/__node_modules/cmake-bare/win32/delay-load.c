// Delay loader implementation for Windows. This is used to support loading
// native addons from binaries that don't declare themselves as "bare.exe" as
// well as loading dynamically linked native addons.
//
// See https://learn.microsoft.com/en-us/cpp/build/reference/understanding-the-helper-function

#ifndef WIN32_LEAN_AND_MEAN
#define WIN32_LEAN_AND_MEAN
#endif

#include <windows.h> // Must come first

#include <delayimp.h>
#include <string.h>
#include <uv.h>

typedef uv_lib_t *(*bare__module_find_fn)(const char *name);

static inline HMODULE
bare__module_main(void) {
  static HMODULE main = NULL;

  if (main == NULL) main = GetModuleHandle(NULL);

  return main;
}

static inline HMODULE
bare__module_find(const char *name) {
  static bare__module_find_fn find = NULL;

  if (find == NULL) {
    find = (bare__module_find_fn) GetProcAddress(bare__module_main(), "bare_module_find");

    if (find == NULL) return NULL;
  }

  uv_lib_t *lib = find(name);

  if (lib == NULL) return NULL;

  return (HMODULE) lib->handle;
}

static inline int
bare__string_equals(LPCSTR a, LPCSTR b) {
  return _stricmp(a, b) == 0;
}

static inline int
bare__string_ends_with(LPCSTR a, LPCSTR b) {
  size_t a_len = strlen(a);
  size_t b_len = strlen(b);

  if (b_len > a_len) return 0;

  return bare__string_equals(a + a_len - b_len, b);
}

static FARPROC WINAPI
bare__delay_load(unsigned event, PDelayLoadInfo info) {
  switch (event) {
  case dliNotePreLoadLibrary:
    LPCSTR dll = info->szDll;

    if (bare__string_equals(dll, "bare.exe") || bare__string_equals(dll, "bare.dll")) {
      return (FARPROC) bare__module_main();
    }

    if (bare__string_ends_with(dll, ".bare")) {
      return (FARPROC) bare__module_find(dll);
    }

    return NULL;

  default:
    return NULL;
  }
}

const PfnDliHook __pfnDliNotifyHook2 = bare__delay_load;

const PfnDliHook __pfnDliFailureHook2 = bare__delay_load;
