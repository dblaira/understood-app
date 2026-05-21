import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import { getTableContainerFit } from '../lib/ai/table-container-fit'

describe('table container fit', () => {
  it('keeps compact lookup tables inline', () => {
    assert.equal(
      getTableContainerFit({
        columns: ['Trait', 'Target'],
        rows: [
          ['High graphoria', 'Dense tables'],
          ['Low number memory', 'Cells only'],
        ],
      }),
      'inline-grid'
    )
  })

  it('uses a priority grid for short three-column tables', () => {
    assert.equal(
      getTableContainerFit({
        columns: ['Theme', 'Signal', 'Entry'],
        rows: [
          ['App', 'Search modal', '[12]'],
          ['Finance', 'CEO moment', '[4]'],
        ],
      }),
      'priority-grid'
    )
  })

  it('stacks wide evidence tables so long cells stay readable', () => {
    assert.equal(
      getTableContainerFit({
        columns: ['Entry', 'Date', 'Learning Signature'],
        rows: [
          [
            'Remember Club Visits Always Deliver Value',
            'Jan 21, 2026',
            'Amazing conversations create learning energy and social momentum',
          ],
        ],
      }),
      'stacked-cards'
    )
  })
})
