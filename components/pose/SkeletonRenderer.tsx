'use client'

import type { PoseLandmark } from '@/types'

export const POSE_CONNECTIONS: [number, number][] = [
  [11, 12], [11, 23], [12, 24], [23, 24],           // torso
  [11, 13], [13, 15],                                 // left arm
  [12, 14], [14, 16],                                 // right arm
  [23, 25], [25, 27], [27, 29], [27, 31], [29, 31],  // left leg
  [24, 26], [26, 28], [28, 30], [28, 32], [30, 32],  // right leg
  [0, 7], [0, 8],                                     // head
]

const KEY_JOINTS = new Set([0, 11, 12, 23, 24, 25, 26, 27, 28])

export interface SkeletonStyle {
  boneColor?: string
  jointColor?: string
  flaggedColor?: string
  pulseColor?: string
  alpha?: number
  lineWidth?: number
  jointRadius?: number
}

const DEFAULT_STYLE: Required<SkeletonStyle> = {
  boneColor: 'rgba(34,197,94,0.85)',
  jointColor: '#22c55e',
  flaggedColor: '#ef4444',
  pulseColor: 'rgba(239,68,68,0.3)',
  alpha: 1,
  lineWidth: 2.5,
  jointRadius: 5,
}

/**
 * Scale and translate ideal skeleton to match the user's detected body
 * proportions and position, so the ghost overlay aligns correctly.
 */
function scaleIdealToUser(ideal: PoseLandmark[], user: PoseLandmark[]): PoseLandmark[] {
  const uLSh = user[11], uRSh = user[12]
  const uLAnk = user[27], uRAnk = user[28]
  const iLSh = ideal[11], iRSh = ideal[12]
  const iLAnk = ideal[27], iRAnk = ideal[28]

  if (!uLSh || !uRSh || !uLAnk || !uRAnk || !iLSh || !iRSh || !iLAnk || !iRAnk) return ideal

  const uShX = (uLSh.x + uRSh.x) / 2
  const uShY = (uLSh.y + uRSh.y) / 2
  const uAnkY = (uLAnk.y + uRAnk.y) / 2
  const uSpan = Math.abs(uAnkY - uShY)

  const iShX = (iLSh.x + iRSh.x) / 2
  const iShY = (iLSh.y + iRSh.y) / 2
  const iAnkY = (iLAnk.y + iRAnk.y) / 2
  const iSpan = Math.abs(iAnkY - iShY)

  if (uSpan < 0.05 || iSpan < 0.001) return ideal

  const scale = uSpan / iSpan
  // Anchor: align shoulder midpoints
  const ox = uShX - iShX * scale
  const oy = uShY - iShY * scale

  return ideal.map(lm => ({
    x: lm.x * scale + ox,
    y: lm.y * scale + oy,
    z: lm.z,
    visibility: lm.visibility,
  }))
}

export function renderSkeleton(
  ctx: CanvasRenderingContext2D,
  landmarks: PoseLandmark[],
  width: number,
  height: number,
  flaggedJoints: Set<number> = new Set(),
  pulsedJoints: Set<number> = new Set(),
  style: SkeletonStyle = {},
  pulsePhase = 0
) {
  if (!landmarks?.length) return
  const s = { ...DEFAULT_STYLE, ...style }
  ctx.save()

  // Draw bones
  for (const [a, b] of POSE_CONNECTIONS) {
    const lmA = landmarks[a], lmB = landmarks[b]
    if (!lmA || !lmB) continue
    if ((lmA.visibility ?? 1) < 0.25 || (lmB.visibility ?? 1) < 0.25) continue

    const isFlagged = flaggedJoints.has(a) || flaggedJoints.has(b)
    const isPulsedBone = pulsedJoints.has(a) && pulsedJoints.has(b)

    ctx.beginPath()
    ctx.moveTo(lmA.x * width, lmA.y * height)
    ctx.lineTo(lmB.x * width, lmB.y * height)
    ctx.lineCap = 'round'

    if (isPulsedBone) {
      // Highlighted bone: amber glow, breathing opacity
      ctx.strokeStyle = '#fbbf24'
      ctx.lineWidth = s.lineWidth + 2.5
      ctx.globalAlpha = s.alpha * (0.65 + Math.sin(pulsePhase) * 0.35)
    } else if (isFlagged) {
      ctx.strokeStyle = s.flaggedColor
      ctx.lineWidth = s.lineWidth + 1
      ctx.globalAlpha = s.alpha
    } else {
      ctx.strokeStyle = s.boneColor
      ctx.lineWidth = s.lineWidth
      ctx.globalAlpha = s.alpha
    }
    ctx.stroke()
  }

  ctx.globalAlpha = s.alpha

  // Draw joints
  for (let i = 0; i < landmarks.length; i++) {
    const lm = landmarks[i]
    if (!lm || (lm.visibility ?? 1) < 0.25) continue
    const isKey = KEY_JOINTS.has(i)
    const isFlagged = flaggedJoints.has(i)
    const isPulsed = pulsedJoints.has(i)
    if (!isKey && !isFlagged && !isPulsed) continue

    const x = lm.x * width
    const y = lm.y * height
    const r = isFlagged || isPulsed ? s.jointRadius + 1 : s.jointRadius

    // Active issue joint — prominent amber spotlight
    if (isPulsed) {
      // Radial glow
      const grd = ctx.createRadialGradient(x, y, 0, x, y, r + 22)
      grd.addColorStop(0, 'rgba(251,191,36,0.40)')
      grd.addColorStop(0.5, 'rgba(251,191,36,0.15)')
      grd.addColorStop(1, 'rgba(251,191,36,0)')
      ctx.beginPath()
      ctx.arc(x, y, r + 22, 0, 2 * Math.PI)
      ctx.fillStyle = grd
      ctx.fill()

      // Animated outer ring
      const pulseR = r + 8 + Math.sin(pulsePhase) * 5
      const ringAlpha = 0.55 + Math.sin(pulsePhase) * 0.25
      ctx.beginPath()
      ctx.arc(x, y, pulseR, 0, 2 * Math.PI)
      ctx.strokeStyle = `rgba(251,191,36,${ringAlpha})`
      ctx.lineWidth = 2.5
      ctx.stroke()
    }

    // Flagged (non-active) joint — red ring
    if (isFlagged && !isPulsed) {
      ctx.beginPath()
      ctx.arc(x, y, r + 4, 0, 2 * Math.PI)
      ctx.strokeStyle = 'rgba(239,68,68,0.5)'
      ctx.lineWidth = 2
      ctx.stroke()
    }

    // Joint dot
    ctx.beginPath()
    ctx.arc(x, y, r, 0, 2 * Math.PI)
    ctx.fillStyle = isPulsed ? '#fbbf24' : (isFlagged ? s.flaggedColor : s.jointColor)
    ctx.fill()
  }

  ctx.restore()
}

/**
 * Render ideal "ghost" skeleton scaled to the user's detected body.
 * Pass userLandmarks to auto-scale/align the overlay.
 */
export function renderIdealSkeleton(
  ctx: CanvasRenderingContext2D,
  landmarks: PoseLandmark[],
  width: number,
  height: number,
  userLandmarks?: PoseLandmark[]
) {
  const scaled = userLandmarks ? scaleIdealToUser(landmarks, userLandmarks) : landmarks
  renderSkeleton(ctx, scaled, width, height, new Set(), new Set(), {
    boneColor: 'rgba(255,255,255,0.55)',
    jointColor: 'rgba(255,255,255,0.75)',
    flaggedColor: 'rgba(255,255,255,0.75)',
    alpha: 0.65,
    lineWidth: 2,
    jointRadius: 4,
  })
}

export function interpolateLandmarks(a: PoseLandmark[], b: PoseLandmark[], t: number): PoseLandmark[] {
  return a.map((lmA, i) => {
    const lmB = b[i]
    if (!lmB) return lmA
    return {
      x: lmA.x + (lmB.x - lmA.x) * t,
      y: lmA.y + (lmB.y - lmA.y) * t,
      z: lmA.z + (lmB.z - lmA.z) * t,
      visibility: (lmA.visibility ?? 1) + ((lmB.visibility ?? 1) - (lmA.visibility ?? 1)) * t,
    }
  })
}
