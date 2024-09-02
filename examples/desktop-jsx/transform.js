function transform (buffer) {
  const inputCode = buffer.toString()

  const tagNamePattern = '\\w+'
  const attributesPattern = '[^>]*'
  const contentPattern = '.*?'

  const tag = new RegExp(`<(${tagNamePattern})(${attributesPattern})>(${contentPattern})<\/\\1>`, 'gs')
  const selfClosingTag = new RegExp(`<(${tagNamePattern})(${attributesPattern})\/>`, 'gs')
  const attribute = /([a-zA-Z]+)=["'](.*?)["']/g

  const transformAttributes = (attributes) => {
    if (!attributes.trim()) return 'null'
    return `{${attributes.trim().replace(attribute, '\'$1\': \'$2\'')}}`
  }

  const transformTag = (match, tagName, attributes, content) => {
    const element = isComponent(tagName) ? tagName : `'${tagName}'`
    const props = transformAttributes(attributes)
    const children = content.trim() ? transformChildren(content.trim()) : 'null'
    return `React.createElement(${element}, ${props}, ${children})`
  }

  const transformSelfClosingTag = (match, tagName, attributes) => {
    const element = isComponent(tagName) ? tagName : `'${tagName}'`
    const props = transformAttributes(attributes)
    return `React.createElement(${element}, ${props})`
  }

  const isComponent = (tagName) => /^[A-Z]/.test(tagName)

  const transformChildren = (children) => {
    const childElements = []
    let lastIndex = 0
    const regex = new RegExp(`<(${tagNamePattern})(${attributesPattern})>(${contentPattern})<\/\\1>|<(${tagNamePattern})(${attributesPattern})\/>`, 'gs')

    let match
    while ((match = regex.exec(children)) !== null) {
      if (lastIndex < match.index) {
        const text = children.slice(lastIndex, match.index).trim()
        if (text) {
          childElements.push(`'${escapeText(text)}'`)
        }
      }

      const transformedElement = match[4]
        ? transformSelfClosingTag(match[0], match[4], match[5])
        : transformTag(match[0], match[1], match[2], match[3])
      childElements.push(transformedElement)

      lastIndex = regex.lastIndex
    }

    if (lastIndex < children.length) {
      const text = children.slice(lastIndex).trim()
      if (text) {
        childElements.push(`'${escapeText(text)}'`)
      }
    }

    return childElements.join(', ')
  }

  const escapeText = (text) => {
    return text.replace(/'/g, "\\'")
  }

  const transformed = inputCode
    .replace(tag, transformTag)
    .replace(selfClosingTag, transformSelfClosingTag)

  return Buffer.from(transformed)
}

module.exports = transform
