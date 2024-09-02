function transform (buffer) {
  const inputCode = buffer.toString()

  const transformed = inputCode.replace(/<(\w+)>(.*?)<\/\1>/g, (match, p1, p2) => {
    return `React.createElement('${p1}', null, '${p2}')`
  })

  return Buffer.from(transformed)
}

module.exports = transform
