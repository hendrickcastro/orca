#!/usr/bin/env node
// Lists the upstream files the fork edits (its merge-conflict surface) and how many lines each carries.
// Usage: node config/fork/fork-footprint.mjs [upstreamRef=upstream/main] [--all]
import { execFileSync } from 'node:child_process'

const args = process.argv.slice(2)
const showAll = args.includes('--all')
const upstreamRef = args.find((arg) => !arg.startsWith('--')) ?? 'upstream/main'

const numstat = execFileSync(
  'git',
  ['-c', 'diff.renameLimit=60000', 'diff', '--numstat', '--diff-filter=M', upstreamRef, 'HEAD'],
  { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 }
)

const rows = numstat
  .split('\n')
  .filter(Boolean)
  .map((line) => {
    const [added, removed, path] = line.split('\t')
    return { path, lines: Number(added) + Number(removed) }
  })
  .filter((row) => Number.isFinite(row.lines))
  .sort((left, right) => right.lines - left.lines)

const isLocale = (path) => path.includes('/i18n/')
const total = rows.reduce((sum, row) => sum + row.lines, 0)
const code = rows.filter((row) => !isLocale(row.path))
const codeTotal = code.reduce((sum, row) => sum + row.lines, 0)

for (const row of showAll ? rows : rows.slice(0, 40)) {
  console.log(`${String(row.lines).padStart(5)}  ${row.path}`)
}
console.log(
  `\n${rows.length} upstream files edited by the fork, ${total} changed lines ` +
    `(${code.length} files / ${codeTotal} lines without locales) against ${upstreamRef}.`
)
