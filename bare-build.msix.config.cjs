const base = require('./bare-build.config.cjs')

module.exports = {
  ...base,
  subject: process.env.MSIX_CERT_SUBJECT,
  standalone: false
}
