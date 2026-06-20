import { readFileSync } from 'node:fs'
import { join } from 'node:path'

import { LIFE_DOMAINS, STANDARD_ONTOLOGY_VOCABULARY } from '@/types/ontology'
import { getRelationSemanticPolicy } from '@/lib/ontology/mid-level-reference'
import { isUnsafePlaceholderRule } from '@/lib/ontology/rule-quality'
import {
  ENTRY_BASE_IRI,
  exportAxiomsToTurtle,
  ONTOLOGY_VOCAB_VERSION,
  SUITE_GRAPH_PERSONAL,
  type RdfExportableAxiom,
  type RdfExportMetadata,
} from '@/lib/ontology/rdf-export'

export {
  ENTRY_BASE_IRI,
  ONTOLOGY_VOCAB_VERSION,
  SUITE_GRAPH_PERSONAL,
  type RdfExportableAxiom,
  type RdfExportMetadata,
}

const ONTOLOGY_BASE = 'https://understood.app/ontology'
const SUITE_ONTOLOGY_DOCUMENT = `${ONTOLOGY_BASE}`
const RDF_TYPE = 'http://www.w3.org/1999/02/22-rdf-syntax-ns#type'
const SKOS_NARROWER = 'http://www.w3.org/2004/02/skos/core#narrower'
const UNDERSTOOD_NS = 'https://understood.app/ontology#'

export interface RdfExportableConnection {
  id: string
  headline: string
  connectionType: string
  lifeDomains?: string[]
}

export interface SuiteExportInput {
  axioms: RdfExportableAxiom[]
  connections?: RdfExportableConnection[]
  metadata?: RdfExportMetadata
}

export interface RdfTripleRow {
  graphIri: string
  subject: string
  predicate: string
  object: string
  objectIsIri: boolean
  sourceApp: 'understood' | 'recall' | 'savy'
}

export function exportLifeDomainsToTurtle(): string {
  const lines = LIFE_DOMAINS.map((domain) => {
    const domainIri = `<${ONTOLOGY_BASE}/domain/${slugify(domain)}>`
    const childLabels = STANDARD_ONTOLOGY_VOCABULARY.parentDomains
      .find((entry) => entry.name === domain)
      ?.childLabels ?? []

    const body = [
      `${domainIri} a understood:LifeDomain, skos:Concept ;`,
      `  understood:label "${escapeTurtleString(domain)}" ;`,
      `  skos:prefLabel "${escapeTurtleString(domain)}" ;`,
    ]

    if (childLabels.length > 0) {
      childLabels.forEach((child, index) => {
        const terminator = index === childLabels.length - 1 ? ' .' : ' ;'
        body.push(`  skos:narrower <${ONTOLOGY_BASE}/concept/${slugify(child)}>${terminator}`)
      })
    } else {
      body[body.length - 1] = `${body[body.length - 1].replace(/ ;$/, '')} .`
    }

    return body.join('\n')
  })

  return `${lines.join('\n\n')}\n`
}

export function exportConnectionsToTurtle(connections: RdfExportableConnection[]): string {
  return connections
    .map((connection) => {
      const connectionIri = `<${ONTOLOGY_BASE}/connection/${encodeURIComponent(connection.id)}>`
      const domainTriples = (connection.lifeDomains ?? [])
        .map((domain) => `  understood:inLifeDomain <${ONTOLOGY_BASE}/domain/${slugify(domain)}> ;`)
        .join('\n')

      return [
        `${connectionIri} a understood:Connection ;`,
        `  understood:label "${escapeTurtleString(connection.headline)}" ;`,
        `  understood:connectionType "${escapeTurtleString(connection.connectionType)}" ;`,
        domainTriples,
        `  .`,
      ]
        .filter(Boolean)
        .join('\n')
    })
    .join('\n\n')
}

export function exportSuiteBundle(input: SuiteExportInput): string {
  const metadata = input.metadata ?? {}
  const connections = input.connections ?? []

  const sections = [
    readSuiteOntologyHeader(),
    '',
    `# vocabularyVersion: ${escapeComment(metadata.vocabularyVersion ?? ONTOLOGY_VOCAB_VERSION)}`,
    `# suiteGraph: ${SUITE_GRAPH_PERSONAL}`,
    metadata.exportedAt ? `# exportedAt: ${escapeComment(metadata.exportedAt)}` : null,
    '',
    '@prefix understood: <https://understood.app/ontology#> .',
    '@prefix skos: <http://www.w3.org/2004/02/skos/core#> .',
    '@prefix xsd: <http://www.w3.org/2001/XMLSchema#> .',
    '',
    exportLifeDomainsToTurtle().trim(),
    stripTurtleDocumentHeader(exportAxiomsToTurtle(input.axioms, metadata)),
    connections.length > 0 ? exportConnectionsToTurtle(connections).trim() : null,
  ]

  return `${sections.filter((section) => section != null && section.length > 0).join('\n\n')}\n`
}

export function buildTripleRowsFromSuiteBundle(input: SuiteExportInput): RdfTripleRow[] {
  const graphIri = SUITE_GRAPH_PERSONAL
  const sourceApp: RdfTripleRow['sourceApp'] = 'understood'
  const rows: RdfTripleRow[] = []

  for (const domain of LIFE_DOMAINS) {
    const domainIri = `${ONTOLOGY_BASE}/domain/${slugify(domain)}`
    const childLabels = STANDARD_ONTOLOGY_VOCABULARY.parentDomains
      .find((entry) => entry.name === domain)
      ?.childLabels ?? []

    rows.push(
      row(graphIri, domainIri, RDF_TYPE, `${UNDERSTOOD_NS}LifeDomain`, true, sourceApp),
      row(graphIri, domainIri, `${UNDERSTOOD_NS}label`, domain, false, sourceApp),
    )

    for (const child of childLabels) {
      rows.push(
        row(graphIri, domainIri, SKOS_NARROWER, `${ONTOLOGY_BASE}/concept/${slugify(child)}`, true, sourceApp),
      )
    }
  }

  const axioms = input.axioms.filter(
    (axiom) => axiom.status === 'confirmed' && axiom.scope === 'personal' && !isUnsafePlaceholderRule(axiom)
  )

  for (const axiom of axioms) {
    const axiomIri = `${ONTOLOGY_BASE}/axiom/${encodeURIComponent(axiom.id)}`
    const antecedentIri = `${ONTOLOGY_BASE}/concept/${slugify(axiom.antecedent)}`
    const consequentIri = `${ONTOLOGY_BASE}/concept/${slugify(axiom.consequent)}`
    const policyIri = `${ONTOLOGY_BASE}/relation/${encodeURIComponent(axiom.relationshipType)}`
    const provenanceSource = typeof axiom.provenance.source === 'string' ? axiom.provenance.source : 'unknown'

    rows.push(
      row(graphIri, antecedentIri, RDF_TYPE, `${UNDERSTOOD_NS}Concept`, true, sourceApp),
      row(graphIri, antecedentIri, `${UNDERSTOOD_NS}label`, axiom.antecedent, false, sourceApp),
      row(graphIri, consequentIri, RDF_TYPE, `${UNDERSTOOD_NS}Concept`, true, sourceApp),
      row(graphIri, consequentIri, `${UNDERSTOOD_NS}label`, axiom.consequent, false, sourceApp),
      row(graphIri, axiomIri, RDF_TYPE, `${UNDERSTOOD_NS}Axiom`, true, sourceApp),
      row(graphIri, axiomIri, `${UNDERSTOOD_NS}axiomId`, axiom.id, false, sourceApp),
      row(graphIri, axiomIri, `${UNDERSTOOD_NS}antecedent`, antecedentIri, true, sourceApp),
      row(graphIri, axiomIri, `${UNDERSTOOD_NS}consequent`, consequentIri, true, sourceApp),
      row(graphIri, axiomIri, `${UNDERSTOOD_NS}relationshipPolicy`, policyIri, true, sourceApp),
      row(graphIri, axiomIri, `${UNDERSTOOD_NS}relationshipType`, axiom.relationshipType, false, sourceApp),
      row(graphIri, axiomIri, `${UNDERSTOOD_NS}confidence`, formatDecimal(axiom.confidence), false, sourceApp),
      row(
        graphIri,
        axiomIri,
        `${UNDERSTOOD_NS}evidenceCount`,
        String(Math.max(axiom.evidenceCount, axiom.evidenceEntryIds.length)),
        false,
        sourceApp
      ),
      row(graphIri, axiomIri, `${UNDERSTOOD_NS}status`, axiom.status, false, sourceApp),
      row(graphIri, axiomIri, `${UNDERSTOOD_NS}scope`, axiom.scope, false, sourceApp),
      row(graphIri, axiomIri, `${UNDERSTOOD_NS}provenanceSource`, provenanceSource, false, sourceApp),
      row(graphIri, policyIri, RDF_TYPE, `${UNDERSTOOD_NS}RelationPolicy`, true, sourceApp),
      row(graphIri, policyIri, `${UNDERSTOOD_NS}relationshipType`, axiom.relationshipType, false, sourceApp),
    )

    const policy = getRelationSemanticPolicy(axiom.relationshipType)
    if (policy) {
      rows.push(
        row(graphIri, policyIri, `${UNDERSTOOD_NS}relationLabel`, policy.label, false, sourceApp),
        row(graphIri, policyIri, `${UNDERSTOOD_NS}semanticKind`, policy.semanticKind, false, sourceApp),
        row(graphIri, policyIri, `${UNDERSTOOD_NS}evidenceExpectation`, policy.evidenceExpectation, false, sourceApp),
        row(graphIri, policyIri, `${UNDERSTOOD_NS}assistantRule`, policy.assistantRule, false, sourceApp),
        row(
          graphIri,
          policyIri,
          `${UNDERSTOOD_NS}sourceReferenceIds`,
          policy.sourceReferenceIds.join(','),
          false,
          sourceApp
        ),
      )
    }

    for (const entryId of [...new Set(axiom.evidenceEntryIds.filter(Boolean))]) {
      rows.push(
        row(graphIri, axiomIri, `${UNDERSTOOD_NS}supportedBy`, `${ENTRY_BASE_IRI}/${encodeURIComponent(entryId)}`, true, sourceApp),
      )
    }
  }

  for (const connection of input.connections ?? []) {
    const connectionIri = `${ONTOLOGY_BASE}/connection/${encodeURIComponent(connection.id)}`
    rows.push(
      row(graphIri, connectionIri, RDF_TYPE, `${UNDERSTOOD_NS}Connection`, true, sourceApp),
      row(graphIri, connectionIri, `${UNDERSTOOD_NS}label`, connection.headline, false, sourceApp),
      row(graphIri, connectionIri, `${UNDERSTOOD_NS}connectionType`, connection.connectionType, false, sourceApp),
    )

    for (const domain of connection.lifeDomains ?? []) {
      rows.push(
        row(graphIri, connectionIri, `${UNDERSTOOD_NS}inLifeDomain`, `${ONTOLOGY_BASE}/domain/${slugify(domain)}`, true, sourceApp),
      )
    }
  }

  return dedupeTripleRows(rows)
}

function row(
  graphIri: string,
  subject: string,
  predicate: string,
  object: string,
  objectIsIri: boolean,
  sourceApp: RdfTripleRow['sourceApp']
): RdfTripleRow {
  return { graphIri, subject, predicate, object, objectIsIri, sourceApp }
}

function formatDecimal(value: number): string {
  if (!Number.isFinite(value)) return '0'
  return String(value)
}

export function parseTurtleToTripleRows(
  turtle: string,
  options: { graphIri: string; sourceApp: RdfTripleRow['sourceApp'] }
): RdfTripleRow[] {
  const rows: RdfTripleRow[] = []
  const prefixMap = new Map<string, string>()

  for (const line of turtle.split('\n')) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) continue

    const prefixMatch = trimmed.match(/^@prefix\s+([^:]+):\s+<([^>]+)>\s*\./)
    if (prefixMatch) {
      prefixMap.set(prefixMatch[1], prefixMatch[2])
      continue
    }

    const statement = trimmed.endsWith('.') ? trimmed.slice(0, -1).trim() : trimmed
    if (!statement.includes(' ')) continue

    const tokens = tokenizeTurtleStatement(statement)
    if (tokens.length < 3) continue

    const subject = expandIri(tokens[0], prefixMap)
    let index = 1

    while (index < tokens.length) {
      const predicate = expandIri(tokens[index], prefixMap)
      const objectToken = tokens[index + 1]
      if (!predicate || !objectToken) break

      const literal = parseLiteral(objectToken)
      rows.push({
        graphIri: options.graphIri,
        subject,
        predicate,
        object: literal ? literal.value : expandIri(objectToken, prefixMap),
        objectIsIri: literal ? false : isIriToken(objectToken),
        sourceApp: options.sourceApp,
      })

      index += 2
      if (tokens[index] === ';') index += 1
      if (tokens[index] === '.') break
    }
  }

  return dedupeTripleRows(rows)
}

function readSuiteOntologyHeader(): string {
  const path = join(process.cwd(), 'ontology', 'understood-suite.ttl')
  return readFileSync(path, 'utf8').trim()
}

function stripTurtleDocumentHeader(turtle: string): string {
  return turtle
    .split('\n')
    .filter((line) => !line.startsWith('#') && !line.startsWith('@prefix'))
    .join('\n')
    .trim()
}

function tokenizeTurtleStatement(statement: string): string[] {
  const tokens: string[] = []
  let current = ''
  let inString = false

  for (let i = 0; i < statement.length; i += 1) {
    const char = statement[i]

    if (char === '"') {
      inString = !inString
      current += char
      continue
    }

    if (!inString && (char === ' ' || char === ';')) {
      if (current.length > 0) {
        tokens.push(current)
        current = ''
      }
      if (char === ';') tokens.push(';')
      continue
    }

    current += char
  }

  if (current.length > 0) tokens.push(current)
  return tokens
}

function parseLiteral(token: string): { value: string } | null {
  if (!token.startsWith('"')) return null
  const unquoted = token.replace(/^"/, '').replace(/"(\^\^.*)?$/, '').replace(/\\"/g, '"')
  return { value: unquoted }
}

function isIriToken(token: string): boolean {
  return token.startsWith('<') || token.includes(':')
}

function expandIri(token: string, prefixMap: Map<string, string>): string {
  if (token.startsWith('<') && token.endsWith('>')) {
    return token.slice(1, -1)
  }

  const colonIndex = token.indexOf(':')
  if (colonIndex === -1) return token

  const prefix = token.slice(0, colonIndex)
  const localName = token.slice(colonIndex + 1)
  const namespace = prefixMap.get(prefix)
  if (!namespace) return token
  return `${namespace}${localName}`
}

function dedupeTripleRows(rows: RdfTripleRow[]): RdfTripleRow[] {
  const seen = new Set<string>()
  const out: RdfTripleRow[] = []

  for (const row of rows) {
    const key = `${row.graphIri}|${row.subject}|${row.predicate}|${row.object}`
    if (seen.has(key)) continue
    seen.add(key)
    out.push(row)
  }

  return out
}

function slugify(value: string): string {
  const slug = value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')

  return slug || 'unnamed'
}

function escapeTurtleString(value: string): string {
  return value
    .replace(/\\/g, '\\\\')
    .replace(/"/g, '\\"')
    .replace(/\n/g, '\\n')
    .replace(/\r/g, '\\r')
}

function escapeComment(value: string): string {
  return value.replace(/\r?\n/g, ' ').trim()
}

export const SUITE_ONTOLOGY_IRI = SUITE_ONTOLOGY_DOCUMENT
