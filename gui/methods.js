'use strict'
const methods = [
  { id: 256, name: 'ctrl' },
  { id: 257, name: 'parent' },
  { id: 258, name: 'dimensions' },
  { id: 259, name: 'focus' },
  { id: 260, name: 'blur' },
  { id: 261, name: 'hide' },
  { id: 262, name: 'isClosed' },
  { id: 263, name: 'isMinimized' },
  { id: 264, name: 'isMaximized' },
  { id: 265, name: 'isFullscreen' },
  { id: 266, name: 'isVisible' },
  { id: 267, name: 'minimize' },
  { id: 268, name: 'maximize' },
  { id: 269, name: 'fullscreen' },
  { id: 270, name: 'restore' },
  { id: 271, name: 'getMediaSourceId' },
  { id: 272, name: 'close' },
  { id: 273, name: 'chrome' },
  { id: 274, name: 'getMediaAccessStatus' },
  { id: 275, name: 'askForMediaAccess' },
  { id: 276, name: 'desktopSources' },
  { id: 277, name: 'unloading' },
  { id: 278, name: 'completeUnload' },
  { id: 279, name: 'attachMainView' },
  { id: 280, name: 'detachMainView' },
  { id: 281, name: 'afterViewLoaded' },
  { id: 282, name: 'setWindowButtonPosition' },
  { id: 283, name: 'setWindowButtonVisibility' },
  // forwarding methods
  { id: 384, name: 'messages', stream: true },
  { id: 385, name: 'message' },
  { id: 386, name: 'checkpoint' },
  { id: 387, name: 'versions' },
  { id: 388, name: 'restart' }

]

module.exports = methods
