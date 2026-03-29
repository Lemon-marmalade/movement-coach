import type { PoseFrame, DetectedIssue, Scores, MovementType } from '@/types'
import {
  kneeValgusDeviation, torsoLateralTilt, hipDropAbs, lateralSymmetry,
  spineAngle, plankHipDeviation, shoulderAsymmetry, kneeAngle,
} from './angles'

const SEVERITY_WEIGHT = { mild: 1, moderate: 2.5, severe: 5 }

function clamp(v: number, min = 0, max = 10): number {
  return Math.max(min, Math.min(max, v))
}
function pct(v: number): number { return parseFloat(v.toFixed(1)) }

// ─── Movement-specific score computation ─────────────────────────────────────

function computeAthletic(frames: PoseFrame[], issues: DetectedIssue[]): Scores {
  let valgusSum = 0, tiltSum = 0, dropSum = 0, asymSum = 0, n = 0
  for (const f of frames) {
    if (f.landmarks.length < 33) continue; n++
    valgusSum += Math.max(kneeValgusDeviation(f.landmarks, 'left'), kneeValgusDeviation(f.landmarks, 'right'), 0)
    tiltSum += torsoLateralTilt(f.landmarks)
    dropSum += hipDropAbs(f.landmarks)
    asymSum += lateralSymmetry(f.landmarks)
  }
  const N = Math.max(n, 1)
  const avgValgus = valgusSum / N
  const avgTilt = tiltSum / N
  const avgDrop = dropSum / N
  const avgAsym = asymSum / N

  const tiltDeduction = clamp((avgTilt / 18) * 3.5)
  const dropDeduction = clamp((avgDrop / 0.07) * 2.5)
  const stability = clamp(10 - tiltDeduction - dropDeduction)

  const valgusDeduction = clamp((avgValgus / 0.07) * 5)
  const asymDeduction = clamp((avgAsym / 22) * 2.5)
  const alignment = clamp(10 - valgusDeduction - asymDeduction)

  const issueScore = issues.reduce((s, i) => s + SEVERITY_WEIGHT[i.severity], 0)
  const risk = clamp(Math.min(10, issueScore * 1.1 + ((10 - stability) + (10 - alignment)) / 4))

  return buildScores(stability, alignment, risk, issues, [
    { name: 'Torso Stability', contribution: -tiltDeduction, description: `Avg ${avgTilt.toFixed(1)}° lateral tilt` },
    { name: 'Hip Level', contribution: -dropDeduction, description: `Avg ${(avgDrop * 100).toFixed(1)}% hip drop` },
  ], [
    { name: 'Knee Alignment', contribution: -valgusDeduction, description: `Avg valgus ${(avgValgus * 100).toFixed(1)}%` },
    { name: 'Bilateral Symmetry', contribution: -asymDeduction, description: `Avg ${avgAsym.toFixed(1)}° asymmetry` },
  ])
}

function computeSquat(frames: PoseFrame[], issues: DetectedIssue[]): Scores {
  let valgusSum = 0, leanSum = 0, dropSum = 0, n = 0
  let minKneeAvg = 180
  for (const f of frames) {
    if (f.landmarks.length < 33) continue; n++
    valgusSum += Math.max(kneeValgusDeviation(f.landmarks, 'left'), kneeValgusDeviation(f.landmarks, 'right'), 0)
    leanSum += spineAngle(f.landmarks)
    dropSum += hipDropAbs(f.landmarks)
    const kAvg = (kneeAngle(f.landmarks, 'left') + kneeAngle(f.landmarks, 'right')) / 2
    if (kAvg < minKneeAvg) minKneeAvg = kAvg
  }
  const N = Math.max(n, 1)
  const avgValgus = valgusSum / N
  const avgLean = leanSum / N
  const avgDrop = dropSum / N

  const valgusD = clamp((avgValgus / 0.07) * 4.5)
  const depthBonus = minKneeAvg < 95 ? 0 : 1.5 // reward for reaching depth
  const alignment = clamp(10 - valgusD + depthBonus)

  const leanD = clamp((Math.max(0, avgLean - 35) / 30) * 3)
  const dropD = clamp((avgDrop / 0.06) * 2)
  const stability = clamp(10 - leanD - dropD)

  const issueScore = issues.reduce((s, i) => s + SEVERITY_WEIGHT[i.severity], 0)
  const risk = clamp(issueScore * 1.0 + ((10 - stability) + (10 - alignment)) / 4.5)

  return buildScores(stability, alignment, risk, issues, [
    { name: 'Trunk Lean', contribution: -leanD, description: `Avg ${avgLean.toFixed(1)}° forward lean` },
    { name: 'Hip Level', contribution: -dropD, description: `Avg ${(avgDrop * 100).toFixed(1)}% hip drop` },
  ], [
    { name: 'Knee Tracking', contribution: -valgusD, description: `Avg ${(avgValgus * 100).toFixed(1)}% valgus` },
    { name: 'Squat Depth', contribution: depthBonus, description: minKneeAvg < 95 ? 'At/below parallel' : 'Above parallel' },
  ])
}

function computePlank(frames: PoseFrame[], issues: DetectedIssue[]): Scores {
  let sagSum = 0, shoulderSum = 0, n = 0
  for (const f of frames) {
    if (f.landmarks.length < 33) continue; n++
    sagSum += Math.abs(plankHipDeviation(f.landmarks))
    shoulderSum += shoulderAsymmetry(f.landmarks)
  }
  const N = Math.max(n, 1)
  const avgSag = sagSum / N
  const avgShoulder = shoulderSum / N

  const sagD = clamp((avgSag / 0.06) * 5)
  const shoulderD = clamp((avgShoulder / 0.045) * 2.5)
  const stability = clamp(10 - sagD - shoulderD)
  const alignment = clamp(10 - sagD * 0.6 - shoulderD * 0.8)

  const issueScore = issues.reduce((s, i) => s + SEVERITY_WEIGHT[i.severity], 0)
  const risk = clamp(issueScore * 0.9 + (10 - stability) / 3)

  return buildScores(stability, alignment, risk, issues, [
    { name: 'Hip Position', contribution: -sagD, description: `Avg deviation ${(avgSag * 100).toFixed(1)}%` },
    { name: 'Shoulder Symmetry', contribution: -shoulderD, description: `${(avgShoulder * 100).toFixed(1)}% height diff` },
  ], [
    { name: 'Body Line', contribution: -sagD * 0.6, description: 'Plank line deviation' },
    { name: 'Shoulder Level', contribution: -shoulderD * 0.8, description: 'Scapular alignment' },
  ])
}

function computeGeneric(frames: PoseFrame[], issues: DetectedIssue[]): Scores {
  return computeAthletic(frames, issues)
}

function buildScores(
  stability: number, alignment: number, risk: number,
  issues: DetectedIssue[],
  stabilityFactors: { name: string; contribution: number; description: string }[],
  alignmentFactors: { name: string; contribution: number; description: string }[]
): Scores {
  const issueScore = issues.reduce((s, i) => s + SEVERITY_WEIGHT[i.severity], 0)
  const biomechD = ((10 - stability) + (10 - alignment)) / 5

  return {
    stability: pct(stability),
    alignment: pct(alignment),
    risk: pct(risk),
    breakdowns: {
      stability: { value: pct(stability), factors: stabilityFactors },
      alignment: { value: pct(alignment), factors: alignmentFactors },
      risk: {
        value: pct(risk),
        factors: [
          { name: 'Issue Severity', contribution: Math.min(8, issueScore * 0.9), description: `${issues.length} issue(s) detected` },
          { name: 'Biomechanical Deficit', contribution: biomechD, description: 'From stability + alignment' },
        ],
      },
    },
  }
}

export function computeScores(frames: PoseFrame[], issues: DetectedIssue[], movementType: MovementType = 'lateral_cut'): Scores {
  if (frames.length === 0) {
    const empty = { value: 0, factors: [] }
    return { stability: 0, alignment: 0, risk: 0, breakdowns: { stability: empty, alignment: empty, risk: empty } }
  }
  switch (movementType) {
    case 'lateral_cut':
    case 'jump_landing':
    case 'sprint':
      return computeAthletic(frames, issues)
    case 'squat':
    case 'deadlift':
    case 'lunge':
      return computeSquat(frames, issues)
    case 'plank':
      return computePlank(frames, issues)
    case 'overhead_press':
      return computeGeneric(frames, issues)
    default:
      return computeGeneric(frames, issues)
  }
}
