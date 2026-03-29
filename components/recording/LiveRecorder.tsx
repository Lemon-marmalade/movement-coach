'use client'

import { useRef, useState, useCallback, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Video, Square, Loader2, AlertCircle } from 'lucide-react'
import { renderSkeleton } from '@/components/pose/SkeletonRenderer'
import type { MovementType } from '@/types'

interface LiveRecorderProps {
  movementType: MovementType
  onRecordingComplete: (blob: Blob, blobUrl: string) => void
}

type RecordState = 'idle' | 'requesting' | 'ready' | 'recording' | 'processing' | 'error'

export default function LiveRecorder({ movementType, onRecordingComplete }: LiveRecorderProps) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const poseRef = useRef<unknown>(null)
  const chunksRef = useRef<Blob[]>([])
  const rafRef = useRef<number>(0)

  const [state, setState] = useState<RecordState>('idle')
  const [error, setError] = useState<string | null>(null)
  const [elapsed, setElapsed] = useState(0)
  const [fps, setFps] = useState(0)
  const elapsedRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const fpsCountRef = useRef(0)
  const lastFpsRef = useRef(Date.now())

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      streamRef.current?.getTracks().forEach(t => t.stop())
      cancelAnimationFrame(rafRef.current)
      if (elapsedRef.current) clearInterval(elapsedRef.current)
      poseRef.current && (poseRef.current as { close: () => void }).close?.()
    }
  }, [])

  const startCamera = useCallback(async () => {
    setState('requesting')
    setError(null)
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { width: 1280, height: 720, frameRate: 30, facingMode: 'user' },
        audio: false,
      })
      streamRef.current = stream
      if (videoRef.current) {
        videoRef.current.srcObject = stream
        videoRef.current.play()
      }

      // Dynamically load MediaPipe
      const { Pose, POSE_CONNECTIONS: _ } = await import('@mediapipe/pose')
      const pose = new Pose({
        locateFile: (f: string) => `https://cdn.jsdelivr.net/npm/@mediapipe/pose/${f}`,
      })
      pose.setOptions({ modelComplexity: 0, smoothLandmarks: true, minDetectionConfidence: 0.5, minTrackingConfidence: 0.5 })
      poseRef.current = pose

      const canvas = canvasRef.current!
      const ctx = canvas.getContext('2d')!

      let lastLandmarks: unknown[] | null = null

      pose.onResults((results: { poseLandmarks?: unknown[] }) => {
        if (results.poseLandmarks) lastLandmarks = results.poseLandmarks
      })

      const drawLoop = () => {
        const video = videoRef.current
        if (!video || !canvas) return

        canvas.width = video.videoWidth || 1280
        canvas.height = video.videoHeight || 720
        ctx.clearRect(0, 0, canvas.width, canvas.height)
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height)

        if (lastLandmarks) {
          renderSkeleton(
            ctx,
            lastLandmarks as Parameters<typeof renderSkeleton>[1],
            canvas.width,
            canvas.height,
            new Set(),
            new Set(),
            {},
            Date.now() / 200
          )
        }

        fpsCountRef.current++
        const now = Date.now()
        if (now - lastFpsRef.current >= 1000) {
          setFps(fpsCountRef.current)
          fpsCountRef.current = 0
          lastFpsRef.current = now
        }

        pose.send({ image: video }).catch(() => {})
        rafRef.current = requestAnimationFrame(drawLoop)
      }

      rafRef.current = requestAnimationFrame(drawLoop)
      setState('ready')
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Camera access denied'
      setError(msg.includes('Permission') ? 'Camera permission denied. Allow access in browser settings.' : msg)
      setState('error')
    }
  }, [])

  const startRecording = useCallback(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    chunksRef.current = []
    const canvasStream = canvas.captureStream(30)
    const recorder = new MediaRecorder(canvasStream, {
      mimeType: MediaRecorder.isTypeSupported('video/webm;codecs=vp9') ? 'video/webm;codecs=vp9' : 'video/webm',
    })

    recorder.ondataavailable = e => { if (e.data.size > 0) chunksRef.current.push(e.data) }
    recorder.onstop = () => {
      setState('processing')
      const blob = new Blob(chunksRef.current, { type: 'video/webm' })
      const url = URL.createObjectURL(blob)
      onRecordingComplete(blob, url)
    }

    recorder.start(100)
    mediaRecorderRef.current = recorder
    setState('recording')

    setElapsed(0)
    elapsedRef.current = setInterval(() => setElapsed(s => s + 1), 1000)
  }, [onRecordingComplete])

  const stopRecording = useCallback(() => {
    mediaRecorderRef.current?.stop()
    if (elapsedRef.current) clearInterval(elapsedRef.current)
  }, [])

  const fmt = (s: number) => `${Math.floor(s / 60).toString().padStart(2, '0')}:${(s % 60).toString().padStart(2, '0')}`

  return (
    <div className="space-y-4">
      {/* Camera viewport */}
      <div className="relative aspect-video bg-zinc-950 rounded-2xl overflow-hidden border border-zinc-800">
        <video ref={videoRef} className="absolute inset-0 w-full h-full object-cover mirror" muted playsInline />
        <canvas ref={canvasRef} className="absolute inset-0 w-full h-full object-cover" />

        {/* Status badges */}
        <div className="absolute top-3 left-3 flex items-center gap-2">
          {state === 'recording' && (
            <div className="flex items-center gap-2 bg-red-600/90 backdrop-blur-sm rounded-lg px-3 py-1.5">
              <span className="w-2 h-2 rounded-full bg-white animate-pulse" />
              <span className="text-white text-xs font-mono font-bold">{fmt(elapsed)}</span>
            </div>
          )}
          {fps > 0 && state !== 'idle' && state !== 'requesting' && (
            <div className="bg-black/60 backdrop-blur-sm rounded-lg px-2.5 py-1.5 text-[10px] font-mono text-zinc-400">
              {fps} fps
            </div>
          )}
        </div>

        {/* Idle / requesting overlay */}
        <AnimatePresence>
          {(state === 'idle' || state === 'requesting') && (
            <motion.div
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="absolute inset-0 flex flex-col items-center justify-center bg-zinc-900/95"
            >
              {state === 'requesting' ? (
                <>
                  <Loader2 className="w-10 h-10 text-purple-400 animate-spin mb-3" />
                  <p className="text-sm text-zinc-400 font-mono">Starting camera...</p>
                </>
              ) : (
                <>
                  <div className="w-16 h-16 rounded-full border-2 border-dashed border-zinc-700 flex items-center justify-center mb-4">
                    <Video className="w-7 h-7 text-zinc-500" />
                  </div>
                  <p className="text-sm text-zinc-300 mb-1">Record your {movementType.replace('_', ' ')}</p>
                  <p className="text-xs text-zinc-500">Skeleton overlay shown live during recording</p>
                </>
              )}
            </motion.div>
          )}
        </AnimatePresence>

        {/* Error */}
        {state === 'error' && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-red-950/80 p-6 text-center">
            <AlertCircle className="w-8 h-8 text-red-400 mb-3" />
            <p className="text-sm text-red-300">{error}</p>
          </div>
        )}
      </div>

      {/* Action button */}
      <div className="flex justify-center">
        {state === 'idle' && (
          <button
            onClick={startCamera}
            className="flex items-center gap-2 bg-zinc-800 hover:bg-zinc-700 text-white rounded-xl px-6 py-3 text-sm font-mono transition-colors border border-zinc-700"
          >
            <Video className="w-4 h-4" />
            Enable Camera
          </button>
        )}
        {state === 'ready' && (
          <button
            onClick={startRecording}
            className="flex items-center gap-2 bg-red-600 hover:bg-red-500 text-white rounded-xl px-8 py-3.5 text-sm font-bold font-mono transition-colors shadow-lg shadow-red-600/20"
          >
            <span className="w-3 h-3 rounded-full bg-white animate-pulse" />
            Start Recording
          </button>
        )}
        {state === 'recording' && (
          <button
            onClick={stopRecording}
            className="flex items-center gap-2 bg-zinc-800 hover:bg-zinc-700 text-white rounded-xl px-8 py-3.5 text-sm font-bold font-mono transition-colors border border-zinc-600"
          >
            <Square className="w-4 h-4 fill-white" />
            Stop & Analyze
          </button>
        )}
        {state === 'processing' && (
          <div className="flex items-center gap-2 text-zinc-400 text-sm font-mono">
            <Loader2 className="w-4 h-4 animate-spin" />
            Processing recording...
          </div>
        )}
      </div>

      <style>{`.mirror { transform: scaleX(-1); }`}</style>
    </div>
  )
}
