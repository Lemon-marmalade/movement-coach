'use client'

import { useRef, useEffect, useCallback, useState } from 'react'
import type { PoseFrame, MovementType } from '@/types'
import { renderSkeleton, renderIdealSkeleton, interpolateLandmarks } from './SkeletonRenderer'
import { LANDMARK_NAMES } from '@/lib/pose/angles'
import { getIdealLandmarksForPose, interpolateRefFrames } from '@/lib/pose/idealPoses'

interface PoseCanvasProps {
  videoRef: React.RefObject<HTMLVideoElement | null>
  frames: PoseFrame[]
  referenceFrames?: PoseFrame[]   // custom uploaded reference video frames
  flaggedJoints?: Set<number>
  pulsedJoints?: Set<number>
  showOverlay: boolean
  showIdeal: boolean
  currentTime: number
  duration: number
  movementType: MovementType
}

/**
 * Compute where the video CONTENT is rendered inside the video element.
 * The element itself fills the container, but `object-contain` adds letterbox
 * or pillarbox bars, so landmarks must be mapped to the actual content area.
 */
function getVideoBounds(vW: number, vH: number, cW: number, cH: number) {
  const vAR = vW / vH
  const cAR = cW / cH
  let renderW: number, renderH: number, offsetX: number, offsetY: number
  if (vAR > cAR) {
    // Wider video → letterbox (bars top/bottom)
    renderW = cW
    renderH = cW / vAR
    offsetX = 0
    offsetY = (cH - renderH) / 2
  } else {
    // Taller video → pillarbox (bars left/right)
    renderH = cH
    renderW = cH * vAR
    offsetX = (cW - renderW) / 2
    offsetY = 0
  }
  return { renderW, renderH, offsetX, offsetY }
}

export default function PoseCanvas({
  videoRef, frames, referenceFrames,
  flaggedJoints = new Set(), pulsedJoints = new Set(),
  showOverlay, showIdeal, currentTime, duration, movementType,
}: PoseCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const pulseRef = useRef<number>(0)
  const [hoveredJoint, setHoveredJoint] = useState<{ index: number; name: string; x: number; y: number } | null>(null)

  // Mutable refs so the RAF loop always reads latest without restarting
  const framesRef = useRef(frames)
  const refFramesRef = useRef(referenceFrames)
  const showOverlayRef = useRef(showOverlay)
  const showIdealRef = useRef(showIdeal)
  const movementTypeRef = useRef(movementType)
  const flaggedRef = useRef(flaggedJoints)
  const pulsedRef = useRef(pulsedJoints)
  const durationRef = useRef(duration)

  useEffect(() => { framesRef.current = frames }, [frames])
  useEffect(() => { refFramesRef.current = referenceFrames }, [referenceFrames])
  useEffect(() => { showOverlayRef.current = showOverlay }, [showOverlay])
  useEffect(() => { showIdealRef.current = showIdeal }, [showIdeal])
  useEffect(() => { movementTypeRef.current = movementType }, [movementType])
  useEffect(() => { flaggedRef.current = flaggedJoints }, [flaggedJoints])
  useEffect(() => { pulsedRef.current = pulsedJoints }, [pulsedJoints])
  useEffect(() => { durationRef.current = duration }, [duration])

  const getLandmarksAtTime = useCallback((time: number) => {
    const fs = framesRef.current
    if (!fs.length) return null
    let lo = 0, hi = fs.length - 1
    while (lo < hi) {
      const mid = (lo + hi) >> 1
      if (fs[mid].timestamp < time) lo = mid + 1
      else hi = mid
    }
    if (lo === 0) return fs[0].landmarks
    const prev = fs[lo - 1], next = fs[lo]
    const span = next.timestamp - prev.timestamp
    const t = span > 0 ? (time - prev.timestamp) / span : 1
    return interpolateLandmarks(prev.landmarks, next.landmarks, Math.min(1, Math.max(0, t)))
  }, [])

  useEffect(() => {
    const canvas = canvasRef.current
    const video = videoRef.current
    if (!canvas || !video) return

    const ctx = canvas.getContext('2d')!
    let animFrame: number

    const draw = () => {
      pulseRef.current += 0.08

      const vW = video.videoWidth
      const vH = video.videoHeight

      // Use the video element's CSS layout dimensions as canvas size.
      // This means the canvas is displayed 1:1 — no CSS distortion.
      const cW = video.clientWidth
      const cH = video.clientHeight

      if (!vW || !vH || !cW || !cH) {
        animFrame = requestAnimationFrame(draw)
        return
      }

      if (canvas.width !== cW) canvas.width = cW
      if (canvas.height !== cH) canvas.height = cH
      ctx.clearRect(0, 0, cW, cH)

      // Map landmarks to the actual video content area (inside object-contain bars)
      const { renderW, renderH, offsetX, offsetY } = getVideoBounds(vW, vH, cW, cH)

      const videoTime = video.currentTime
      const userLms = framesRef.current.length > 0 ? getLandmarksAtTime(videoTime) : null

      ctx.save()
      ctx.translate(offsetX, offsetY)

      // Ideal / reference skeleton
      if (showIdealRef.current && userLms) {
        const refFrames = refFramesRef.current
        let idealLms: ReturnType<typeof getLandmarksAtTime> = null

        if (refFrames && refFrames.length > 0) {
          // Use uploaded reference video at matching relative time
          const t = durationRef.current > 0 ? videoTime / durationRef.current : 0
          idealLms = interpolateRefFrames(refFrames, t)
        } else {
          // Phase-based synthetic ideal: reads user's actual joint angles
          idealLms = getIdealLandmarksForPose(movementTypeRef.current, userLms)
        }

        if (idealLms) renderIdealSkeleton(ctx, idealLms, renderW, renderH, userLms)
      }

      // User skeleton
      if (showOverlayRef.current && userLms) {
        renderSkeleton(ctx, userLms, renderW, renderH, flaggedRef.current, pulsedRef.current, {}, pulseRef.current)
      }

      ctx.restore()

      animFrame = requestAnimationFrame(draw)
    }

    draw()
    return () => cancelAnimationFrame(animFrame)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [videoRef, getLandmarksAtTime])

  const handleMouseMove = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current
    const video = videoRef.current
    if (!canvas || !video || !showOverlay) { setHoveredJoint(null); return }

    const rect = canvas.getBoundingClientRect()
    const vW = video.videoWidth || 640
    const vH = video.videoHeight || 480
    const cW = canvas.width
    const cH = canvas.height

    const { renderW, renderH, offsetX, offsetY } = getVideoBounds(vW, vH, cW, cH)

    const scaleX = cW / rect.width
    const scaleY = cH / rect.height
    const mx = (e.clientX - rect.left) * scaleX - offsetX
    const my = (e.clientY - rect.top) * scaleY - offsetY

    if (mx < 0 || mx > renderW || my < 0 || my > renderH) {
      setHoveredJoint(null)
      return
    }

    const lms = getLandmarksAtTime(currentTime)
    if (!lms) return

    for (let i = 0; i < lms.length; i++) {
      const lm = lms[i]
      if (!LANDMARK_NAMES[i]) continue
      const lx = lm.x * renderW
      const ly = lm.y * renderH
      if (Math.hypot(mx - lx, my - ly) < 16) {
        setHoveredJoint({ index: i, name: LANDMARK_NAMES[i], x: e.clientX - rect.left, y: e.clientY - rect.top })
        return
      }
    }
    setHoveredJoint(null)
  }, [currentTime, getLandmarksAtTime, showOverlay, videoRef])

  return (
    <div className="absolute inset-0">
      <canvas
        ref={canvasRef}
        className="absolute inset-0 w-full h-full"
        style={{ pointerEvents: showOverlay ? 'auto' : 'none' }}
        onMouseMove={handleMouseMove}
        onMouseLeave={() => setHoveredJoint(null)}
      />
      {hoveredJoint && (
        <div
          className="absolute z-20 pointer-events-none px-2.5 py-1.5 bg-zinc-900/95 border border-zinc-600 rounded-lg text-xs text-white whitespace-nowrap shadow-xl"
          style={{ left: hoveredJoint.x + 12, top: hoveredJoint.y - 28 }}
        >
          <span className="font-mono text-purple-300">{hoveredJoint.name}</span>
        </div>
      )}
    </div>
  )
}
