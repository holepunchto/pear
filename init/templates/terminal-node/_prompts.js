'use strict'
module.exports = ({ name, license }) => [
  {
    name: 'type',
    default: 'desktop',
    validation: (value) => value === 'desktop' || value === 'terminal',
    prompt: 'type',
    msg: 'type must be "desktop" or "terminal"'

  },
  {
    name: 'name',
    default: name,
    prompt: 'name'
  },
  {
    name: 'main',
    default: 'index.js',
    prompt: 'main',
    type: 'terminal',
    validation: (value) => extname(value) === '.js',
    msg: 'must have an .js file extension'
  },
  {
    name: 'license',
    default: license || 'Apache-2.0',
    prompt: 'license'
  }
]