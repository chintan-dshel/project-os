// Terminal report formatter

export function printResults(allResults, { judge = false } = {}) {
  let totalPass = 0
  let totalFail = 0
  let anyFailed = false

  for (const r of allResults) {
    const passCount = r.assertions.filter(a => a.pass).length
    const failCount = r.assertions.filter(a => !a.pass).length
    totalPass += passCount
    totalFail += failCount
    if (failCount > 0) anyFailed = true

    const status = failCount === 0 ? '✓' : '✗'
    const label  = `${r.agent.toUpperCase().padEnd(9)} ${r.fixture.padEnd(30)}`
    const counts = `${passCount}/${r.assertions.length} assertions`

    let judgeStr = ''
    if (judge && r.judgeScores) {
      const scores = Object.values(r.judgeScores).map(d => d.score).filter(Boolean)
      const avg    = scores.length ? (scores.reduce((a, b) => a + b, 0) / scores.length).toFixed(1) : '—'
      judgeStr = `  quality: ${avg}/5`
    }

    console.log(`  ${status} ${label} ${counts}${judgeStr}`)

    for (const a of r.assertions) {
      if (!a.pass) {
        console.log(`      FAIL: ${a.name}${a.detail ? ` — ${a.detail}` : ''}`)
      }
    }

    if (judge && r.judgeScores) {
      for (const [dim, data] of Object.entries(r.judgeScores)) {
        if (!data.score) continue
        const bar = '█'.repeat(data.score) + '░'.repeat(5 - data.score)
        console.log(`      ${bar} ${data.score}/5  ${dim}`)
        if (data.reason) console.log(`             ${data.reason}`)
        if (data.summary) console.log(`             ${data.summary}`)
      }
    }
  }

  console.log('')
  console.log(`  Total: ${totalPass + totalFail} assertions — ${totalPass} passed, ${totalFail} failed`)

  return anyFailed ? 1 : 0
}
