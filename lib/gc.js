'use strict'
const { isBare, isWindows } = require('which-runtime')
const os = isBare ? require('bare-os') : require('os')
const { spawn } = isBare ? require('bare-subprocess') : require('child_process')
const { Readable } = require('streamx')
const safetyCatch = require('safety-catch')

module.exports = function () {
  return new GarbageCollector()
}

class GarbageCollector extends Readable {
  constructor (client, engine) {
    console.log('GarbageCollector constructor')
    super()
    this.client = client
    this.engine = engine
  }

  _destroy (cb) {
    cb(null)
  }

  async sidecar ({ pid }) {
    try {
      const name = 'pear-runtime'
      const flag = '--sidecar'

      const [sh, args] = isWindows
        ? ['cmd.exe', ['/c', `wmic process where (name like '%${name}%') get name,executablepath,processid,commandline /format:csv`]]
        : ['/bin/sh', ['-c', `ps ax | grep -i -- '${name}' | grep -i -- '${flag}'`]]

      const sp = spawn(sh, args)
      let output = ''
      let pidIndex = isWindows ? -1 : 0
      let isHeader = !!isWindows
      const killed = []

      sp.stdout.on('data', (data) => {
        output += data.toString()
        const lines = output.split(isWindows ? '\r\r\n' : '\n')
        output = lines.pop()
        for (const line of lines) {
          if (!line.trim()) continue
          const columns = line.split(isWindows ? ',' : ' ').filter(col => col)
          if (isHeader && isWindows) {
            const index = columns.findIndex(col => /processid/i.test(col.trim()))
            pidIndex = index !== -1 ? index : 4
            isHeader = false
          } else {
            const id = parseInt(columns[pidIndex])
            if (!isNaN(id) && ![Bare.pid, sp.pid, pid].includes(id)) {
              os.kill(id)
              this.push({ tag: 'kill', data: { pid: id } })
              killed.push(id)
            }
          }
        }
      })

      sp.on('exit', (code, signal) => {
        if (code !== 0 || signal) {
          this.error(new Error(`Process exited with code: ${code}, signal: ${signal}`))
        }

        this.push({ tag: 'complete', data: { killed } })
        this.close()
      })
    } catch (err) {
      console.log('err:')
      console.log(err)
      this.error(err)
      safetyCatch(err)
    }
  }

  close () {
    this.push({ tag: 'final', data: { success: true } })
    this.push(null)
  }

  error (err) {
    const { stack, code, message } = err
    this.push({ tag: 'error', data: { stack, code, message, success: false } })
  }
}
