'use strict'
const { Readable } = require('streamx')
const Module = require('bare-module')
const plink = require('pear-link')
const fs = require('bare-fs')
const { isWindows } = require('which-runtime')
const { RUNTIME } = require('pear-constants')
const { spawn } = require('bare-subprocess')
const { pathToFileURL } = require('url-file-url')
const { ERR_INVALID_CONFIG } = require('pear-errors')
const State = require('pear-state')
const path = require('bare-path')
const cenc = require('compact-encoding')

module.exports = class Pre extends Readable {
  pkg = null
  options = null
  pre = null
  #finalled = false
  constructor(op, { dir, cwd, entrypoint = '/' }, pkg) {
    super()
    this.op = op
    this.dir = dir
    this.applink = pathToFileURL(dir).href
    this.cwd = cwd
    this.link = plink.normalize(pathToFileURL(path.join(dir, entrypoint)).href)
    this.pkg = pkg
    this.index = 0
    this.#pre().catch((err) => this.destroy(err))
  }

  #final() {
    if (this.#finalled) return
    this.#finalled = true
    this.push({ tag: 'final', data: this.pkg })
    this.push(null)
  }

  async #pre() {
    if (this.pkg === null) {
      this.#final()
      return
    }
    this.options = this.pkg?.pear ?? {}

    const topPre = this.options.pre
      ? Array.isArray(this.options.pre)
        ? this.options.pre
        : [this.options.pre]
      : []
    const opOpts = this.options[this.op]
    const opPre = opOpts?.pre ? (Array.isArray(opOpts.pre) ? opOpts.pre : [opOpts.pre]) : []
    const pre = [...topPre, ...opPre]
    this.pre = pre.length > 0 ? pre : null

    const state = new State()
    await State.build(state, this.pkg)

    if (this.pre === null) {
      this.#final()
      return
    }

    if (this.op === 'run') {
      let hasPipe
      try {
        hasPipe = isWindows ? fs.fstatSync(3).isFIFO() : fs.fstatSync(3).isSocket()
      } catch {
        hasPipe = false
      }
      if (hasPipe) {
        this.#final()
        return
      }
    }

    for (let specifier of this.pre) {
      if (this.link.endsWith(specifier)) continue
      specifier = specifier[0] === '/' ? '.' + specifier : specifier
      const base = this.applink.endsWith('/') ? this.applink : this.applink + '/'
      const url =
        specifier[0] === '.' ? new URL(specifier, base) : Module.resolve(specifier, new URL(base))
      const link = url.href
      if (this.link === link) continue
      this.options = await this.#run(this.options, link, this.index++, specifier)
    }
    this.pkg.pear = this.options
    this.#final()
  }

  #run(options, link, index, from) {
    const { cwd } = this
    const sp = spawn(RUNTIME, ['run', '--base', this.dir, '--prerunning', '--trusted', link], {
      stdio: ['ignore', 'pipe', 'pipe', 'overlapped'],
      windowsHide: true,
      cwd
    })
    const IDLE_TIMEOUT = 5000
    const SELF_CLOSE_WAIT = 2500
    sp.stdio[1].on('data', (output) =>
      this.push({ tag: 'preio', data: { from, output, index, fd: 1 } })
    )
    sp.stdio[2].on('data', (output) =>
      this.push({ tag: 'preio', data: { from, output, index, fd: 2 } })
    )
    const pipe = sp.stdio[3]
    this.once('end', () => {
      pipe.end()
      pipe.destroy()
      try {
        sp.kill()
      } catch {
        /* ignore if already closed */
      }
    })
    const promise = new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        pipe.end()
        pipe.destroy()
        setTimeout(() => {
          try {
            sp.kill()
          } catch {
            /* ignore if already closed */
          }
        }, SELF_CLOSE_WAIT).unref()
        reject(
          new ERR_INVALID_CONFIG(
            'pear.pre "' + link + '" did not respond with configuration data in time'
          )
        )
      }, IDLE_TIMEOUT).unref()
      const ondata = (data) => {
        let output = null
        try {
          output = cenc.decode(cenc.any, data)
          const success = output?.tag !== 'error'
          this.push({ tag: 'pre', data: { from, output, index, success } })
        } catch (err) {
          reject(err)
          pipe.end()
        }
        if (output.tag === 'configure') {
          clearTimeout(timeout)
          pipe.removeListener('data', ondata)
          pipe.on('data', () => {
            try {
              output = cenc.decode(cenc.any, data)
              const success = output?.tag !== 'error'
              this.push({ tag: 'pre', data: { from, output, index, success } })
            } catch (err) {
              this.push({
                tag: 'pre',
                data: { from, output: err, index, success: false }
              })
            }
          })
          resolve(output.data)
        }
      }
      pipe.on('data', ondata)
    })

    pipe.write(cenc.encode(cenc.any, options))

    return promise
  }
}
