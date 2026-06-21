import { NextResponse } from 'next/server'
import { ADAM_PATTERN_STEPS, ADAM_PATTERN_STEP_HINTS } from '@/types/adam-pattern'

export async function GET() {
  const steps = ADAM_PATTERN_STEPS.map((label) => ({
    id: label,
    label,
    hint: ADAM_PATTERN_STEP_HINTS[label],
  }))

  return NextResponse.json({ steps })
}
