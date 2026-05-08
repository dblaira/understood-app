export const FLUENCY_SESSION_TARGET = 50

export type FluencyMove =
  | 'capture'
  | 'classify'
  | 'attach_evidence'
  | 'create_candidate'
  | 'confirm_or_reject'
  | 'retire'
  | 'training_only'

export interface FluencySessionInput {
  reviewedItems: string
  primaryMove: FluencyMove
  domainsUsed: string[]
  statusChanges: string
  neededExplanation: boolean
  updatedOntologyState: boolean
}

export interface FluencySession extends FluencySessionInput {
  id: string
  createdAt: string
}

export interface FluencyStats {
  countedSessions: number
  trainingSessions: number
  remainingSessions: number
  percentComplete: number
}

export function canCountFluencySession(session: FluencySessionInput): boolean {
  return (
    session.reviewedItems.trim().length > 0 &&
    session.domainsUsed.length > 0 &&
    session.primaryMove !== 'training_only' &&
    session.updatedOntologyState &&
    !session.neededExplanation
  )
}

export function buildFluencyStats(sessions: FluencySession[]): FluencyStats {
  const countedSessions = sessions.filter(canCountFluencySession).length
  const trainingSessions = sessions.length - countedSessions
  const remainingSessions = Math.max(FLUENCY_SESSION_TARGET - countedSessions, 0)
  const percentComplete = Math.min(
    Math.round((countedSessions / FLUENCY_SESSION_TARGET) * 100),
    100
  )

  return {
    countedSessions,
    trainingSessions,
    remainingSessions,
    percentComplete,
  }
}
