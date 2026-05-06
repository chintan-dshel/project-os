function inlineFormat(text) {
  if (!text) return ''
  const re = /\*\*(.*?)\*\*|\*(.*?)\*|`([^`]+)`/g
  const parts = []
  let last = 0; let key = 0; let match
  while ((match = re.exec(text)) !== null) {
    if (match.index > last) parts.push(text.slice(last, match.index))
    if (match[1] !== undefined) parts.push(<strong key={key++}>{match[1]}</strong>)
    else if (match[2] !== undefined) parts.push(<em key={key++}>{match[2]}</em>)
    else if (match[3] !== undefined) parts.push(<code key={key++} className="doc-inline-code">{match[3]}</code>)
    last = match.index + match[0].length
  }
  if (last < text.length) parts.push(text.slice(last))
  return parts.length === 0 ? '' : parts.length === 1 && typeof parts[0] === 'string' ? parts[0] : parts
}

function parseCells(row) {
  return row.replace(/^\||\|$/g, '').split('|').map(c => c.trim())
}

function isSeparator(row) {
  const cells = parseCells(row)
  return cells.length > 0 && cells.every(c => /^[-:]+$/.test(c))
}

export function renderMd(md) {
  if (!md) return null
  const lines = md.split('\n')
  const out = []
  let i = 0

  while (i < lines.length) {
    const line = lines[i]

    if (line.startsWith('### ')) { out.push(<h3 key={i} className="doc-h3">{inlineFormat(line.slice(4))}</h3>); i++; continue }
    if (line.startsWith('## '))  { out.push(<h2 key={i} className="doc-h2">{inlineFormat(line.slice(3))}</h2>); i++; continue }
    if (line.startsWith('# '))   { out.push(<h1 key={i} className="doc-h1">{inlineFormat(line.slice(2))}</h1>); i++; continue }
    if (line.startsWith('> '))   { out.push(<blockquote key={i} className="doc-quote">{inlineFormat(line.slice(2))}</blockquote>); i++; continue }

    if (/^-{3,}$/.test(line.trim())) {
      out.push(<hr key={i} className="doc-hr" />)
      i++; continue
    }

    if (line.startsWith('|')) {
      const tableLines = []
      while (i < lines.length && lines[i].startsWith('|')) { tableLines.push(lines[i]); i++ }
      const dataRows = tableLines.filter(l => !isSeparator(l))
      if (dataRows.length > 0) {
        const [header, ...body] = dataRows
        out.push(
          <table key={`t${i}`} className="doc-table">
            <thead>
              <tr>{parseCells(header).map((h, ci) => <th key={ci} className="doc-th">{inlineFormat(h)}</th>)}</tr>
            </thead>
            {body.length > 0 && (
              <tbody>
                {body.map((row, ri) => (
                  <tr key={ri}>{parseCells(row).map((cell, ci) => <td key={ci} className="doc-td">{inlineFormat(cell)}</td>)}</tr>
                ))}
              </tbody>
            )}
          </table>
        )
      }
      continue
    }

    if (line.startsWith('- ')) {
      const items = []
      while (i < lines.length && lines[i].startsWith('- ')) { items.push(lines[i].slice(2)); i++ }
      out.push(
        <ul key={`ul${i}`} className="doc-ul">
          {items.map((item, ii) => <li key={ii} className="doc-li">{inlineFormat(item)}</li>)}
        </ul>
      )
      continue
    }

    if (/^\d+\. /.test(line)) {
      const items = []
      while (i < lines.length && /^\d+\. /.test(lines[i])) { items.push(lines[i].replace(/^\d+\. /, '')); i++ }
      out.push(
        <ol key={`ol${i}`} className="doc-ol">
          {items.map((item, ii) => <li key={ii} className="doc-ol-li">{inlineFormat(item)}</li>)}
        </ol>
      )
      continue
    }

    if (line.trim() === '') { out.push(<div key={i} style={{ height: '8px' }} />); i++; continue }

    out.push(<p key={i} className="doc-p">{inlineFormat(line)}</p>)
    i++
  }

  return out
}
