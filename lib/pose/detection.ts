/**
 * Movement Analysis Detection Engine
 * Biomechanical rules based on published sports medicine research.
 * All thresholds are referenced to source literature.
 */
import type { PoseFrame, DetectedIssue, IssueSeverity, MovementType, IssueType } from '@/types'
import {
  kneeValgusDeviation, torsoLateralTilt, hipDropAbs, ankleAngle,
  lateralSymmetry, minKneeAngle, plankHipDeviation, shoulderAsymmetry,
  spineAngle, squatDepthDelta, kneeAngle, hipAngle, anteriorPelvicTilt,
  LANDMARKS,
} from './angles'

// ─── Thresholds (research-referenced) ────────────────────────────────────────

const T = {
  // Knee valgus — McLean et al., 2005; Hewett et al., 2005
  VALGUS_MILD: 0.028,
  VALGUS_MODERATE: 0.055,
  VALGUS_SEVERE: 0.085,

  // Hip drop / Trendelenburg — Noehren et al., 2007
  HIP_DROP_MILD: 0.025,
  HIP_DROP_MODERATE: 0.05,
  HIP_DROP_SEVERE: 0.08,

  // Torso lateral tilt (degrees)
  TILT_MILD: 7,
  TILT_MODERATE: 14,
  TILT_SEVERE: 20,

  // Stiff landing — Decker et al., 2003; Boden et al., 2009
  // Knee angle at first contact (smaller = stiffer / less flexed)
  STIFF_SAFE: 90,     // ≥90° = safe
  STIFF_MILD: 70,     // 70–90° = mild concern
  STIFF_MODERATE: 50, // 50–70° = moderate
  STIFF_SEVERE: 40,   // <50° = severe

  // Ankle eversion — foot-ankle-knee angle
  ANKLE_NORMAL: 130,   // above = normal
  ANKLE_MILD: 120,
  ANKLE_MODERATE: 110,

  // Plank hip deviation (fraction of frame height)
  PLANK_SAG_MILD: 0.020,
  PLANK_SAG_MODERATE: 0.045,
  PLANK_SAG_SEVERE: 0.075,

  // Squat depth — hip below knee level required
  SQUAT_DEPTH_SHALLOW: -0.02,  // hip is above knee by more than 2% of frame
  SQUAT_DEPTH_DEEP: 0.03,      // hip below knee by 3% = good

  // Forward trunk lean (spine angle from vertical, degrees)
  LEAN_MILD: 40,
  LEAN_MODERATE: 52,
  LEAN_SEVERE: 62,

  // Shoulder asymmetry (fraction of frame height)
  SHOULDER_SYM_MILD: 0.025,
  SHOULDER_SYM_MODERATE: 0.05,

  // Lateral asymmetry during landing (angle degrees difference)
  ASYM_MILD: 10,
  ASYM_MODERATE: 20,
  ASYM_SEVERE: 30,
}

type FrameFlag = { frameIndex: number; value: number }

function sevFromValue(v: number, mild: number, moderate: number, severe: number): IssueSeverity | null {
  if (v >= severe) return 'severe'
  if (v >= moderate) return 'moderate'
  if (v >= mild) return 'mild'
  return null
}

function maxSeverity(frames: FrameFlag[], mild: number, moderate: number, severe: number): IssueSeverity {
  const peak = Math.max(...frames.map(f => f.value))
  return sevFromValue(peak, mild, moderate, severe) ?? 'mild'
}

function minSeverity(frames: FrameFlag[], mild: number, moderate: number, severe: number): IssueSeverity {
  // For "less is worse" metrics (like knee angle = smaller is stiffer)
  const minVal = Math.min(...frames.map(f => f.value))
  const deviation = mild - minVal
  return sevFromValue(deviation, 0, moderate - mild, severe - mild) ?? 'mild'
}

function frequencyRatio(flags: FrameFlag[], total: number): number {
  return flags.length / Math.max(total, 1)
}

function avg(arr: number[]): number {
  return arr.length === 0 ? 0 : arr.reduce((s, v) => s + v, 0) / arr.length
}

// ─── Per-movement detection ───────────────────────────────────────────────────

function detectKneeValgus(frames: PoseFrame[], side: 'left' | 'right', freqThreshold = 0.12): DetectedIssue | null {
  const flags: FrameFlag[] = []
  for (const f of frames) {
    if (f.landmarks.length < 33) continue
    const val = kneeValgusDeviation(f.landmarks, side)
    if (val > T.VALGUS_MILD) flags.push({ frameIndex: f.frameIndex, value: val })
  }
  if (frequencyRatio(flags, frames.length) < freqThreshold) return null

  const sev = maxSeverity(flags, T.VALGUS_MILD, T.VALGUS_MODERATE, T.VALGUS_SEVERE)
  const kneeIdx = side === 'left' ? LANDMARKS.LEFT_KNEE : LANDMARKS.RIGHT_KNEE
  const hipIdx = side === 'left' ? LANDMARKS.LEFT_HIP : LANDMARKS.RIGHT_HIP
  const ankleIdx = side === 'left' ? LANDMARKS.LEFT_ANKLE : LANDMARKS.RIGHT_ANKLE
  const peak = Math.max(...flags.map(f => f.value))

  return {
    id: `knee_valgus_${side}`,
    type: 'knee_valgus',
    severity: sev,
    affectedJoints: [kneeIdx, hipIdx, ankleIdx],
    frames: flags.map(f => f.frameIndex),
    description: `${side === 'left' ? 'Left' : 'Right'} knee collapses inward (${(peak * 100).toFixed(1)}% of body width). This dynamic valgus pattern significantly elevates ACL injury risk.`,
    recommendation: `Cue: "Knees out over little toes." Exercises: lateral band walks, clamshells, single-leg squat with mirror feedback. Strengthening target: glute medius.`,
    peakValue: parseFloat((peak * 100).toFixed(1)),
    avgValue: parseFloat((avg(flags.map(f => f.value)) * 100).toFixed(1)),
  }
}

function detectHipDrop(frames: PoseFrame[]): DetectedIssue | null {
  const flags: FrameFlag[] = []
  for (const f of frames) {
    if (f.landmarks.length < 33) continue
    const val = hipDropAbs(f.landmarks)
    if (val > T.HIP_DROP_MILD) flags.push({ frameIndex: f.frameIndex, value: val })
  }
  if (frequencyRatio(flags, frames.length) < 0.15) return null

  const sev = maxSeverity(flags, T.HIP_DROP_MILD, T.HIP_DROP_MODERATE, T.HIP_DROP_SEVERE)
  const peak = Math.max(...flags.map(f => f.value))

  return {
    id: 'hip_drop',
    type: 'hip_drop',
    severity: sev,
    affectedJoints: [LANDMARKS.LEFT_HIP, LANDMARKS.RIGHT_HIP],
    frames: flags.map(f => f.frameIndex),
    description: `Contralateral hip drops ${(peak * 100).toFixed(1)}% of frame height — a Trendelenburg sign indicating hip abductor weakness. Associated with IT band syndrome.`,
    recommendation: 'Strengthen glute medius: lateral step-downs, single-leg bridges, hip abductor machine. Cue: keep pelvis level throughout movement.',
    peakValue: parseFloat((peak * 100).toFixed(1)),
    avgValue: parseFloat((avg(flags.map(f => f.value)) * 100).toFixed(1)),
  }
}

function detectTorsoInstability(frames: PoseFrame[]): DetectedIssue | null {
  const flags: FrameFlag[] = []
  for (const f of frames) {
    if (f.landmarks.length < 33) continue
    const val = torsoLateralTilt(f.landmarks)
    if (val > T.TILT_MILD) flags.push({ frameIndex: f.frameIndex, value: val })
  }
  if (frequencyRatio(flags, frames.length) < 0.18) return null

  const sev = maxSeverity(flags, T.TILT_MILD, T.TILT_MODERATE, T.TILT_SEVERE)
  const peak = Math.max(...flags.map(f => f.value))

  return {
    id: 'torso_instability',
    type: 'torso_instability',
    severity: sev,
    affectedJoints: [LANDMARKS.LEFT_SHOULDER, LANDMARKS.RIGHT_SHOULDER, LANDMARKS.LEFT_HIP, LANDMARKS.RIGHT_HIP],
    frames: flags.map(f => f.frameIndex),
    description: `Torso laterally tilts up to ${peak.toFixed(1)}° from vertical. Asymmetric spinal loading increases lumbar strain risk and reduces force transfer efficiency.`,
    recommendation: 'Core anti-lateral flexion exercises: Pallof press, suitcase carry, side plank progressions. Focus on maintaining neutral spine during all loaded movements.',
    peakValue: parseFloat(peak.toFixed(1)),
    avgValue: parseFloat(avg(flags.map(f => f.value)).toFixed(1)),
  }
}

function detectAnkleEversion(frames: PoseFrame[], side: 'left' | 'right'): DetectedIssue | null {
  const flags: FrameFlag[] = []
  const heelIdx = side === 'left' ? LANDMARKS.LEFT_HEEL : LANDMARKS.RIGHT_HEEL
  const footIdx = side === 'left' ? LANDMARKS.LEFT_FOOT_INDEX : LANDMARKS.RIGHT_FOOT_INDEX

  for (const f of frames) {
    if (f.landmarks.length < 33) continue
    // Skip frames where foot landmarks are not reliably visible
    const heel = f.landmarks[heelIdx], foot = f.landmarks[footIdx]
    if ((heel?.visibility ?? 0) < 0.5 || (foot?.visibility ?? 0) < 0.5) continue
    const val = ankleAngle(f.landmarks, side)
    if (val < T.ANKLE_MODERATE) flags.push({ frameIndex: f.frameIndex, value: val })
  }
  // Higher threshold — ankle eversion requires sustained, clearly visible pronation
  if (frequencyRatio(flags, frames.length) < 0.30) return null

  const sev = maxSeverity(flags.map(f => ({ ...f, value: T.ANKLE_NORMAL - f.value })),
    T.ANKLE_NORMAL - T.ANKLE_MILD, T.ANKLE_NORMAL - T.ANKLE_MODERATE, 30)

  const ankleIdx = side === 'left' ? LANDMARKS.LEFT_ANKLE : LANDMARKS.RIGHT_ANKLE

  return {
    id: `ankle_eversion_${side}`,
    type: 'ankle_eversion',
    severity: sev,
    affectedJoints: [ankleIdx, heelIdx, footIdx],
    frames: flags.map(f => f.frameIndex),
    description: `${side === 'left' ? 'Left' : 'Right'} ankle shows excessive pronation/eversion pattern, altering the kinetic chain upward through the knee and hip.`,
    recommendation: 'Ankle stability drills: single-leg balance, BOSU progressions, eccentric calf raises. Check footwear for adequate lateral support.',
    peakValue: parseFloat(Math.min(...flags.map(f => f.value)).toFixed(1)),
  }
}

function detectStiffLanding(frames: PoseFrame[]): DetectedIssue | null {
  const flags: FrameFlag[] = []
  // Look at first-contact frames — find the point where the body drops fastest (highest downward velocity)
  // Proxy: find frames where both knee angles are near their minimum
  let minLeft = 180, minRight = 180
  for (const f of frames) {
    if (f.landmarks.length < 33) continue
    const lK = kneeAngle(f.landmarks, 'left')
    const rK = kneeAngle(f.landmarks, 'right')
    if (lK < minLeft) minLeft = lK
    if (rK < minRight) minRight = rK
  }
  const minKnee = Math.min(minLeft, minRight)

  // Detect frames near minimum knee angle (within 15° of minimum)
  for (const f of frames) {
    if (f.landmarks.length < 33) continue
    const mK = minKneeAngle(f.landmarks)
    if (mK - minKnee < 15 && minKnee < T.STIFF_SAFE) {
      flags.push({ frameIndex: f.frameIndex, value: mK })
    }
  }
  if (flags.length === 0 || minKnee >= T.STIFF_SAFE) return null

  const deviation = T.STIFF_SAFE - minKnee
  const sev = sevFromValue(deviation, T.STIFF_SAFE - T.STIFF_MILD, T.STIFF_SAFE - T.STIFF_MODERATE, T.STIFF_SAFE - T.STIFF_SEVERE) ?? 'mild'

  return {
    id: 'stiff_landing',
    type: 'stiff_landing',
    severity: sev,
    affectedJoints: [LANDMARKS.LEFT_KNEE, LANDMARKS.RIGHT_KNEE, LANDMARKS.LEFT_ANKLE, LANDMARKS.RIGHT_ANKLE],
    frames: flags.map(f => f.frameIndex),
    description: `Landing with only ${minKnee.toFixed(0)}° of knee flexion (safe = ≥90°). Stiff-knee landings increase ACL loading forces 2.4× and ground reaction force at the patella.`,
    recommendation: 'Practice soft landing drills: drop landings with 3-second hold at 90° knee flexion. Progress to jump-and-stick, then continuous landings with cue "quiet feet."',
    peakValue: parseFloat(minKnee.toFixed(1)),
  }
}

function detectLandingAsymmetry(frames: PoseFrame[]): DetectedIssue | null {
  const flags: FrameFlag[] = []
  for (const f of frames) {
    if (f.landmarks.length < 33) continue
    const asym = lateralSymmetry(f.landmarks)
    if (asym > T.ASYM_MILD) flags.push({ frameIndex: f.frameIndex, value: asym })
  }
  if (frequencyRatio(flags, frames.length) < 0.20) return null

  const sev = maxSeverity(flags, T.ASYM_MILD, T.ASYM_MODERATE, T.ASYM_SEVERE)
  const peak = Math.max(...flags.map(f => f.value))

  return {
    id: 'landing_asymmetry',
    type: 'landing_asymmetry',
    severity: sev,
    affectedJoints: [LANDMARKS.LEFT_KNEE, LANDMARKS.RIGHT_KNEE, LANDMARKS.LEFT_HIP, LANDMARKS.RIGHT_HIP],
    frames: flags.map(f => f.frameIndex),
    description: `Bilateral landing asymmetry of ${peak.toFixed(1)}° detected. Unequal force distribution overloads one limb and often indicates prior injury compensation.`,
    recommendation: 'Symmetry drills: bilateral stance balance challenges, box step-ups equal reps each side. Assess for prior lower-limb injury or leg-length discrepancy.',
    peakValue: parseFloat(peak.toFixed(1)),
  }
}

function detectHipSag(frames: PoseFrame[]): DetectedIssue | null {
  const sagFlags: FrameFlag[] = []
  const pikeFlags: FrameFlag[] = []

  for (const f of frames) {
    if (f.landmarks.length < 33) continue
    const dev = plankHipDeviation(f.landmarks)
    if (dev > T.PLANK_SAG_MILD) sagFlags.push({ frameIndex: f.frameIndex, value: dev })
    if (dev < -T.PLANK_SAG_MILD) pikeFlags.push({ frameIndex: f.frameIndex, value: Math.abs(dev) })
  }

  if (sagFlags.length > pikeFlags.length && frequencyRatio(sagFlags, frames.length) > 0.25) {
    const sev = maxSeverity(sagFlags, T.PLANK_SAG_MILD, T.PLANK_SAG_MODERATE, T.PLANK_SAG_SEVERE)
    const peak = Math.max(...sagFlags.map(f => f.value))
    return {
      id: 'hip_sag',
      type: 'hip_sag',
      severity: sev,
      affectedJoints: [LANDMARKS.LEFT_HIP, LANDMARKS.RIGHT_HIP, LANDMARKS.LEFT_SHOULDER, LANDMARKS.RIGHT_SHOULDER],
      frames: sagFlags.map(f => f.frameIndex),
      description: `Hips sag ${(peak * 100).toFixed(1)}% below the shoulder-ankle plank line, causing lumbar hyperextension and spinal compression.`,
      recommendation: 'Regression: perform plank from knees until core strength improves. Cue: "tuck pelvis, squeeze glutes." Progress with dead bug and hollow body holds.',
      peakValue: parseFloat((peak * 100).toFixed(1)),
    }
  }

  if (pikeFlags.length > sagFlags.length && frequencyRatio(pikeFlags, frames.length) > 0.25) {
    const sev = maxSeverity(pikeFlags, T.PLANK_SAG_MILD, T.PLANK_SAG_MODERATE, T.PLANK_SAG_SEVERE)
    const peak = Math.max(...pikeFlags.map(f => f.value))
    return {
      id: 'hip_pike',
      type: 'hip_pike',
      severity: sev,
      affectedJoints: [LANDMARKS.LEFT_HIP, LANDMARKS.RIGHT_HIP],
      frames: pikeFlags.map(f => f.frameIndex),
      description: `Hips piked ${(peak * 100).toFixed(1)}% above the plank line, reducing core muscle activation and loading the shoulders.`,
      recommendation: 'Focus on engaging the posterior chain: cue "hips level with shoulders," squeeze glutes throughout hold. Check hamstring flexibility.',
      peakValue: parseFloat((peak * 100).toFixed(1)),
    }
  }
  return null
}

function detectForwardTrunkLean(frames: PoseFrame[], leanThreshold = T.LEAN_MILD): DetectedIssue | null {
  const flags: FrameFlag[] = []
  for (const f of frames) {
    if (f.landmarks.length < 33) continue
    const val = spineAngle(f.landmarks)
    if (val > leanThreshold) flags.push({ frameIndex: f.frameIndex, value: val })
  }
  if (frequencyRatio(flags, frames.length) < 0.20) return null

  const sev = maxSeverity(flags, leanThreshold, T.LEAN_MODERATE, T.LEAN_SEVERE)
  const peak = Math.max(...flags.map(f => f.value))

  return {
    id: 'forward_trunk_lean',
    type: 'forward_trunk_lean',
    severity: sev,
    affectedJoints: [LANDMARKS.LEFT_SHOULDER, LANDMARKS.RIGHT_SHOULDER, LANDMARKS.LEFT_HIP, LANDMARKS.RIGHT_HIP],
    frames: flags.map(f => f.frameIndex),
    description: `Trunk leans ${peak.toFixed(0)}° forward (safe <${leanThreshold}°). Excessive forward lean shifts load from the posterior chain to the lumbar spine, increasing L4-L5 disc compressive forces.`,
    recommendation: 'Ankle mobility work to allow a more upright torso. Goblet squat to pattern upright position. Strengthen upper back (rows) to counteract forward pull.',
    peakValue: parseFloat(peak.toFixed(1)),
  }
}

function detectShallowSquatDepth(frames: PoseFrame[]): DetectedIssue | null {
  // Find deepest squat position (minimum knee angle)
  let deepestFrame: PoseFrame | null = null
  let minKnee = 180
  for (const f of frames) {
    if (f.landmarks.length < 33) continue
    const avg = (kneeAngle(f.landmarks, 'left') + kneeAngle(f.landmarks, 'right')) / 2
    if (avg < minKnee) { minKnee = avg; deepestFrame = f }
  }
  if (!deepestFrame) return null

  // Check if hip crease reaches knee level at deepest point
  const depth = squatDepthDelta(deepestFrame.landmarks)
  if (depth >= T.SQUAT_DEPTH_DEEP) return null // good depth

  return {
    id: 'shallow_squat_depth',
    type: 'shallow_squat_depth',
    severity: depth > T.SQUAT_DEPTH_SHALLOW ? 'mild' : 'moderate',
    affectedJoints: [LANDMARKS.LEFT_HIP, LANDMARKS.RIGHT_HIP, LANDMARKS.LEFT_KNEE, LANDMARKS.RIGHT_KNEE],
    frames: [deepestFrame.frameIndex],
    description: `Squat does not reach parallel — hip crease is above knee level at deepest point. Below-parallel depth is required for full glute and hamstring activation.`,
    recommendation: 'Ankle mobility: calf stretches, ankle circles. Box squat to depth target. Goblet squat holds at bottom. Check for hip flexor tightness limiting range.',
    peakValue: parseFloat(depth.toFixed(3)),
  }
}

function detectShoulderAsymmetry(frames: PoseFrame[]): DetectedIssue | null {
  const flags: FrameFlag[] = []
  for (const f of frames) {
    if (f.landmarks.length < 33) continue
    const val = shoulderAsymmetry(f.landmarks)
    if (val > T.SHOULDER_SYM_MILD) flags.push({ frameIndex: f.frameIndex, value: val })
  }
  if (frequencyRatio(flags, frames.length) < 0.25) return null

  const sev = maxSeverity(flags, T.SHOULDER_SYM_MILD, T.SHOULDER_SYM_MODERATE, 0.08)
  const peak = Math.max(...flags.map(f => f.value))

  return {
    id: 'shoulder_asymmetry',
    type: 'shoulder_asymmetry',
    severity: sev,
    affectedJoints: [LANDMARKS.LEFT_SHOULDER, LANDMARKS.RIGHT_SHOULDER],
    frames: flags.map(f => f.frameIndex),
    description: `Shoulder height difference of ${(peak * 100).toFixed(1)}% during overhead movement, indicating scapular dyskinesis or rotator cuff imbalance.`,
    recommendation: 'Scapular stability: wall slides, band pull-aparts, face pulls. Unilateral shoulder pressing to address strength imbalance. Assess for rotator cuff weakness.',
    peakValue: parseFloat((peak * 100).toFixed(1)),
  }
}

function detectPelvicTilt(frames: PoseFrame[]): DetectedIssue | null {
  const flags: FrameFlag[] = []
  for (const f of frames) {
    if (f.landmarks.length < 33) continue
    const val = anteriorPelvicTilt(f.landmarks)
    if (val > 3.5) flags.push({ frameIndex: f.frameIndex, value: val })
  }
  // Require sustained anterior tilt across most frames to avoid false positives
  if (frequencyRatio(flags, frames.length) < 0.45) return null

  return {
    id: 'pelvic_tilt',
    type: 'pelvic_tilt',
    severity: 'mild',
    affectedJoints: [LANDMARKS.LEFT_HIP, LANDMARKS.RIGHT_HIP, LANDMARKS.LEFT_KNEE, LANDMARKS.RIGHT_KNEE],
    frames: flags.map(f => f.frameIndex),
    description: 'Anterior pelvic tilt detected — pelvis rotates forward, creating lumbar lordosis and placing hamstrings in a lengthened/weakened position.',
    recommendation: 'Hip flexor stretches (kneeling lunge stretch). Glute activation: hip thrusts, bridges. Core: dead bug, posterior pelvic tilt drills.',
  }
}

/**
 * Merge bilateral ankle eversion into a single issue when both sides flag,
 * and remove exact duplicate issue types (same `type`, keep highest severity).
 */
function deduplicateAndMerge(issues: DetectedIssue[]): DetectedIssue[] {
  let result = [...issues]

  // Merge bilateral ankle eversion → one issue
  const leftAnkle = result.find(i => i.id === 'ankle_eversion_left')
  const rightAnkle = result.find(i => i.id === 'ankle_eversion_right')
  if (leftAnkle && rightAnkle) {
    const sevOrder: Record<IssueSeverity, number> = { severe: 2, moderate: 1, mild: 0 }
    const merged: DetectedIssue = {
      id: 'ankle_eversion',
      type: 'ankle_eversion',
      severity: sevOrder[leftAnkle.severity] >= sevOrder[rightAnkle.severity] ? leftAnkle.severity : rightAnkle.severity,
      affectedJoints: [...new Set([...leftAnkle.affectedJoints, ...rightAnkle.affectedJoints])],
      frames: [...new Set([...leftAnkle.frames, ...rightAnkle.frames])].sort((a, b) => a - b),
      description: `Bilateral ankle pronation/eversion detected — both feet show excessive inward collapse, which alters loading through both knees and hips.`,
      recommendation: leftAnkle.recommendation!,
      peakValue: Math.min(leftAnkle.peakValue ?? 180, rightAnkle.peakValue ?? 180),
    }
    result = result.filter(i => i !== leftAnkle && i !== rightAnkle)
    result.push(merged)
  }

  // Remove true duplicates by id (shouldn't happen but defensive)
  const seenIds = new Set<string>()
  return result.filter(i => {
    if (seenIds.has(i.id)) return false
    seenIds.add(i.id)
    return true
  })
}

// ─── Main dispatcher ──────────────────────────────────────────────────────────

export function detectIssues(frames: PoseFrame[], movementType: MovementType): DetectedIssue[] {
  if (frames.length < 5) return []

  const issues: DetectedIssue[] = []
  const push = (i: DetectedIssue | null) => { if (i) issues.push(i) }

  switch (movementType) {
    case 'lateral_cut':
      push(detectKneeValgus(frames, 'left', 0.12))
      push(detectKneeValgus(frames, 'right', 0.12))
      push(detectHipDrop(frames))
      push(detectTorsoInstability(frames))
      push(detectAnkleEversion(frames, 'left'))
      push(detectAnkleEversion(frames, 'right'))
      break

    case 'jump_landing':
      push(detectKneeValgus(frames, 'left', 0.10))
      push(detectKneeValgus(frames, 'right', 0.10))
      push(detectStiffLanding(frames))
      push(detectLandingAsymmetry(frames))
      push(detectHipDrop(frames))
      push(detectAnkleEversion(frames, 'left'))
      push(detectAnkleEversion(frames, 'right'))
      break

    case 'squat':
      push(detectKneeValgus(frames, 'left', 0.15))
      push(detectKneeValgus(frames, 'right', 0.15))
      // 50° threshold for squat — forward lean is partially expected due to ankle mobility
      push(detectForwardTrunkLean(frames, 50))
      push(detectShallowSquatDepth(frames))
      push(detectHipDrop(frames))
      push(detectAnkleEversion(frames, 'left'))
      push(detectAnkleEversion(frames, 'right'))
      push(detectPelvicTilt(frames))
      break

    case 'plank':
      push(detectHipSag(frames))
      push(detectShoulderAsymmetry(frames))
      push(detectTorsoInstability(frames))
      // No ankle eversion for plank — foot orientation is not meaningful here
      break

    case 'deadlift':
      // Forward trunk lean is EXPECTED in deadlift (hip hinge) — not flagged
      // Focus on neutral spine, hip symmetry, and knee tracking
      push(detectHipDrop(frames))
      push(detectKneeValgus(frames, 'left', 0.15))
      push(detectKneeValgus(frames, 'right', 0.15))
      push(detectShoulderAsymmetry(frames))
      push(detectPelvicTilt(frames))
      break

    case 'lunge':
      push(detectKneeValgus(frames, 'left', 0.12))
      push(detectKneeValgus(frames, 'right', 0.12))
      push(detectTorsoInstability(frames))
      push(detectHipDrop(frames))
      push(detectAnkleEversion(frames, 'left'))
      push(detectAnkleEversion(frames, 'right'))
      break

    case 'overhead_press':
      push(detectShoulderAsymmetry(frames))
      push(detectTorsoInstability(frames))
      // 45° threshold for overhead press — slight lean is common
      push(detectForwardTrunkLean(frames, 45))
      // No ankle eversion for overhead press
      break

    case 'sprint':
      push(detectHipDrop(frames))
      push(detectTorsoInstability(frames))
      push(detectLandingAsymmetry(frames))
      push(detectAnkleEversion(frames, 'left'))
      push(detectAnkleEversion(frames, 'right'))
      push(detectPelvicTilt(frames))
      break
  }

  // Merge bilateral issues + remove duplicates
  const deduped = deduplicateAndMerge(issues)

  // Sort by severity (severe first)
  const order: Record<IssueSeverity, number> = { severe: 0, moderate: 1, mild: 2 }
  return deduped.sort((a, b) => order[a.severity] - order[b.severity])
}
