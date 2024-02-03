import path from 'bare-path'

const mount = new URL('..', import.meta.url)
const root = mount.pathname.endsWith('.bundle/') ? new URL('..', mount) : mount
const rootPath = root.pathname.slice(0, -1) // strip /

export const ROOT = rootPath
export const MOUNT = mount.href.slice(0, -1)
export const PREBUILDS = path.join(rootPath, 'prebuilds')
export const PRELOADS = path.join(rootPath, 'preloads')
