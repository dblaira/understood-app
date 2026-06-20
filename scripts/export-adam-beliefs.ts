import { mkdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

import { CONNECTION_ONTOLOGY_INTAKE_ITEMS } from '../lib/ontology/connections-intake'
import {
  buildTripleRowsFromSuiteBundle,
  exportConnectionsToTurtle,
  exportSuiteBundle,
  type RdfExportableConnection,
} from '../lib/ontology/suite-export'

const outputDir = join(process.cwd(), 'ontology')
const fixturesDir = join(process.cwd(), 'fixtures', 'ontology')
const exportedAt = new Date().toISOString()

function intakeItemToConnection(
  item: (typeof CONNECTION_ONTOLOGY_INTAKE_ITEMS)[number]
): RdfExportableConnection {
  return {
    id: item.id,
    headline: item.headline,
    connectionType: item.connectionType,
    lifeDomains: boundaryToLifeDomains(item.boundary),
  }
}

function boundaryToLifeDomains(boundary: string): string[] | undefined {
  switch (boundary) {
    case 'personal_pattern':
      return ['Belief']
    case 'product_system':
      return ['Learning']
    case 'both':
      return ['Belief', 'Learning']
    default:
      return undefined
  }
}

const connections = CONNECTION_ONTOLOGY_INTAKE_ITEMS.map(intakeItemToConnection)

const bundle = exportSuiteBundle({
  axioms: [],
  connections,
  metadata: {
    exportedAt,
    appVersion: 'export-adam-beliefs',
    vocabularyVersion: 'adam-beliefs-connections-v1',
  },
})

const connectionsOnly = [
  '# Adam personal connections — aligned to https://understood.app/ontology#',
  `# exportedAt: ${exportedAt}`,
  '# source: CONNECTION_ONTOLOGY_INTAKE_ITEMS (connections-calibration-001)',
  '',
  '@prefix understood: <https://understood.app/ontology#> .',
  '',
  exportConnectionsToTurtle(connections).trim(),
  '',
].join('\n')

mkdirSync(outputDir, { recursive: true })
mkdirSync(fixturesDir, { recursive: true })
writeFileSync(join(outputDir, 'adam-beliefs.ttl'), connectionsOnly, 'utf8')
writeFileSync(join(outputDir, 'adam-beliefs-bundle.ttl'), bundle, 'utf8')

const tripleRows = buildTripleRowsFromSuiteBundle({
  axioms: [],
  connections,
  metadata: { exportedAt },
}).filter((row) => row.subject.includes('/ontology/connection/'))

const triplesJson = `${JSON.stringify(tripleRows, null, 2)}\n`
writeFileSync(join(fixturesDir, 'adam-beliefs-triples.json'), triplesJson, 'utf8')
writeFileSync(join(outputDir, 'adam-beliefs-triples.json'), triplesJson, 'utf8')

console.log(
  `Adam beliefs export complete: ${connections.length} connections → ontology/adam-beliefs.ttl (${tripleRows.length} triple rows)`
)
