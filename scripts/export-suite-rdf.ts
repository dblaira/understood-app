import assert from 'node:assert/strict'
import { mkdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

import {
  buildTripleRowsFromSuiteBundle,
  exportSuiteBundle,
  SUITE_GRAPH_PERSONAL,
} from '../lib/ontology/suite-export'
import type { RdfExportableAxiom } from '../lib/ontology/rdf-export'

const outputDir = join(process.cwd(), 'fixtures', 'ontology')
const sampleAxioms: RdfExportableAxiom[] = [
  {
    id: 'axiom-learning-affect',
    antecedent: 'High Learning',
    consequent: 'Higher Affect',
    confidence: 0.67,
    status: 'confirmed',
    scope: 'personal',
    relationshipType: 'predicts',
    evidenceEntryIds: ['entry-1', 'entry-2'],
    evidenceCount: 2,
    provenance: { source: 'human_confirmed' },
  },
  {
    id: 'axiom-sleep-patience',
    antecedent: 'Sleep under 6 hours',
    consequent: 'Lower work patience',
    confidence: 0.72,
    status: 'confirmed',
    scope: 'personal',
    relationshipType: 'predicts',
    evidenceEntryIds: ['entry-3'],
    evidenceCount: 1,
    provenance: { source: 'self_declared' },
  },
]

const sampleConnections = [
  {
    id: 'conn-learning-master-key',
    headline: 'Learning is the master key',
    connectionType: 'identity_anchor',
    lifeDomains: ['Learning', 'Belief'],
  },
]

const exportedAt = new Date().toISOString()
const bundle = exportSuiteBundle({
  axioms: sampleAxioms,
  connections: sampleConnections,
  metadata: {
    exportedAt,
    appVersion: 'export-suite-rdf',
  },
})

const tripleRows = buildTripleRowsFromSuiteBundle({
  axioms: sampleAxioms,
  connections: sampleConnections,
  metadata: { exportedAt },
})

assert.match(bundle, /understood:Axiom a owl:Class/)
assert.match(bundle, /understood:supportedBy/)
assert.match(bundle, /<https:\/\/understood\.app\/entry\/entry-1>/)
assert.match(bundle, /<https:\/\/understood\.app\/ontology\/domain\/learning>/)
assert.match(bundle, /<https:\/\/understood\.app\/ontology\/connection\/conn-learning-master-key>/)

assert.ok(tripleRows.length > 0, 'Expected suite triple rows')
assert.ok(
  tripleRows.some(
    (row) =>
      row.graphIri === SUITE_GRAPH_PERSONAL &&
      row.predicate.endsWith('supportedBy') &&
      row.object.startsWith('https://understood.app/entry/')
  ),
  'Expected supportedBy evidence triple row'
)

mkdirSync(outputDir, { recursive: true })
writeFileSync(join(outputDir, 'suite-bundle.ttl'), bundle, 'utf8')
writeFileSync(join(outputDir, 'suite-triples.json'), `${JSON.stringify(tripleRows, null, 2)}\n`, 'utf8')

console.log(
  `Suite RDF export complete: ${tripleRows.length} triple rows → fixtures/ontology/suite-bundle.ttl`
)
