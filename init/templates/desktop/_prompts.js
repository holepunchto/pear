module.exports = ({ name, height, width, license }) => [
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
    default: 'index.html',
    prompt: 'main',
    type: 'desktop',
    validation: (value) => extname(value) === '.js' || extname(value) === '.html',
    msg: 'must have an .html or .js file extension'
  },
  {
    name: 'height',
    default: height,
    validation: (value) => Number.isInteger(+value),
    prompt: 'height',
    msg: 'must be an integer',
    type: 'desktop'
  },
  {
    name: 'width',
    default: width,
    validation: (value) => Number.isInteger(+value),
    prompt: 'width',
    msg: 'must be an integer',
    type: 'desktop'
  },
  {
    name: 'license',
    default: license || 'Apache-2.0',
    prompt: 'license'
  }
]