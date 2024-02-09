#!/usr/bin/env bare
'use strict'
const IS_BARE = !!global.Bare
const fs = IS_BARE ? require('bare-fs') : require('fs')
const path = IS_BARE ? require('bare-path') : require('path')

try {
  fs.rmSync(path.join('test', 'node_modules'), { recursive: true })
} catch (e) { console.log(e) }

fs.symlinkSync(path.join('node_modules'), path.join('test', 'node_modules'), 'junction')
