import assert from 'node:assert/strict'
import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'

import { exportAxiomsToTurtle } from '../lib/ontology/rdf-export'
import { validateOntologyAxiomTurtle } from '../lib/ontology/semantic-validation'
import { buildOntologySemanticReport } from '../lib/ontology/semantic-report'

const sampleTurtle = exportAxiomsToTurtle(
  [
    {
      id: 'semantic-check-axiom',
      antecedent: 'Low sleep',
      consequent: 'Lower patience',
      confidence: 0.7,
      status: 'confirmed',
      scope: 'personal',
      relationshipType: 'predicts',
      evidenceEntryIds: ['entry-1'],
      evidenceCount: 1,
      provenance: { source: 'self_declared' },
    },
  ],
  { appVersion: 'semantic-check' }
)

const validation = validateOntologyAxiomTurtle(sampleTurtle)
assert.equal(validation.valid, true, `Semantic sample export invalid: ${JSON.stringify(validation.issues)}`)
assert.match(sampleTurtle, /# vocabularyVersion: understood-ontology-v1/)
assert.match(sampleTurtle, /# appVersion: semantic-check/)
assert.match(sampleTurtle, /understood:RelationPolicy/)
assert.match(sampleTurtle, /understood:relationshipPolicy/)

const report = buildOntologySemanticReport([], { appVersion: 'semantic-check' })
assert.equal(report.queryTemplateCount, 5)
assert.match(report.shacl, /understood:AxiomShape/)
assert.match(report.shacl, /sh:in/)

const fixtureDir = join(process.cwd(), 'fixtures', 'ontology')
const fixtureFiles = readdirSync(fixtureDir).filter((file) => file.endsWith('.ttl'))
assert.ok(fixtureFiles.length >= 4, 'Expected ontology Turtle fixtures')

for (const file of fixtureFiles) {
  const content = readFileSync(join(fixtureDir, file), 'utf8')
  assert.match(content, /@prefix understood:/, `${file} missing understood prefix`)
  assert.match(content, /understood:/, `${file} missing understood terms`)
}

console.log(`Ontology semantic check passed: ${fixtureFiles.length} fixtures, ${validation.checkedSubjects} sample axiom.`)
