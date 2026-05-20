import {
  buildConstraintNodeTree,
  buildPresentationSystemConstraint,
} from '../lib/ai/presentation-interceptor'
import {
  LINTER_DEMO_BAD,
  LINTER_DEMO_GOOD,
  validatePresentation,
} from '../lib/ai/presentation-linter'
import { DEFAULT_PRESENTATION_CONSTRAINTS } from '../lib/ai/default-presentation-constraints'

const constraints = DEFAULT_PRESENTATION_CONSTRAINTS.map((c) => ({ ...c }))

console.log('=== NODE TREE ===')
console.log(buildConstraintNodeTree(constraints, 'Adam'))
console.log('')

const badResult = validatePresentation(LINTER_DEMO_BAD)
const goodResult = validatePresentation(LINTER_DEMO_GOOD)

console.log('=== LINTER ===')
console.log('Paragraph:', badResult.ok ? 'PASS (unexpected)' : `FAIL ✓ — ${badResult.violations[0]}`)
console.log('Theme lines:', goodResult.ok ? 'PASS ✓' : `FAIL — ${goodResult.violations.join(', ')}`)
console.log('')
console.log('=== SYSTEM CONSTRAINT (first 200 chars) ===')
console.log(buildPresentationSystemConstraint(constraints).trim().slice(0, 200) + '…')
console.log('')
console.log(badResult.ok || !goodResult.ok ? 'VERIFICATION FAILED' : 'VERIFICATION OK')

process.exit(badResult.ok || !goodResult.ok ? 1 : 0)
