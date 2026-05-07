const pkg = require('./package.json')

module.exports = {
  name: pkg.name,
  description: pkg.description || 'Pear runtime command line interface',
  standalone: true
}
