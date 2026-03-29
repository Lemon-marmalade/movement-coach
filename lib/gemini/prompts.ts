import type { DetectedIssue, Scores, MovementType } from '@/types'

export interface GeminiAnalysisInput {
  movementType: MovementType
  detectedIssues: DetectedIssue[]
  scores: Scores
  topDeviatedJoints: string[]
  repCount?: number
  duration?: number
}

export const SYSTEM_PROMPT = `You are a sports biomechanics coach analyzing athlete movement data.
Be specific, technical but accessible, and actionable. Focus on injury prevention and performance improvement.
Keep your response concise: 3-5 sentences of coaching analysis, then 2-3 specific drill recommendations.`

export function buildAnalysisPrompt(input: GeminiAnalysisInput): string {
  const { movementType, detectedIssues, scores, topDeviatedJoints, repCount, duration } = input

  const movementLabel = movementType === 'lateral_cut' ? 'Football Lateral Cut' : 'Jump Landing'
  const issuesSummary = detectedIssues.length === 0
    ? 'No significant issues detected.'
    : detectedIssues.map(i =>
        `- ${i.type.replace(/_/g, ' ')} (${i.severity}): ${i.description} [joints: ${i.affectedJoints.join(', ')}]`
      ).join('\n')

  return `Movement Type: ${movementLabel}
${repCount ? `Repetitions: ${repCount}` : ''}
${duration ? `Duration: ${duration.toFixed(1)}s` : ''}

BIOMECHANICAL SCORES (0-10):
- Stability: ${scores.stability.toFixed(1)}/10
- Alignment: ${scores.alignment.toFixed(1)}/10
- Injury Risk: ${scores.risk.toFixed(1)}/10 (higher = more risk)

DETECTED ISSUES:
${issuesSummary}

TOP DEVIATED JOINTS FROM IDEAL REFERENCE:
${topDeviatedJoints.join(', ')}

Provide a coaching analysis followed by specific corrective drills.`
}
