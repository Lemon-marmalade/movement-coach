'use client'

import { useRef, useState, useCallback, useEffect } from 'react'
import dynamic from 'next/dynamic'
import type { PoseFrame, DetectedIssue, MovementType } from '@/types'
import FrameScrubber from './FrameScrubber'
import { Play, Pause, Eye, EyeOff, Ghost, Upload, Loader2, CheckCircle } from 'lucide-react'
import { cn } from '@/lib/utils'
import { extractPoseFromVideo } from '@/lib/pose/mediapipe'

const PoseCanvas = dynamic(() => import('./PoseCanvas'), { ssr: false })

interface PoseOverlayProps {
  videoSrc: string
  frames: PoseFrame[]
  detectedIssues: DetectedIssue[]
  activeIssueId?: string | null
  movementType: MovementType
  onTimeChange?: (time: number) => void
}

export default function PoseOverlay({
  videoSrc, frames, detectedIssues, activeIssueId,
  movementType, onTimeChange,
}: PoseOverlayProps) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const [currentTime, setCurrentTime] = useState(0)
  const [duration, setDuration] = useState(0)
  const [isPlaying, setIsPlaying] = useState(false)
  const [showOverlay, setShowOverlay] = useState(true)
  const [showIdeal, setShowIdeal] = useState(false)
  const [playbackRate, setPlaybackRate] = useState(1)

  // Reference video state
  const [referenceFrames, setReferenceFrames] = useState<PoseFrame[]>([])
  const [refStatus, setRefStatus] = useState<'idle' | 'processing' | 'ready'>('idle')
  const [refProgress, setRefProgress] = useState(0)
  const refInputRef = useRef<HTMLInputElement>(null)

  const flaggedJoints = new Set<number>(detectedIssues.flatMap(i => i.affectedJoints))
  const pulsedJoints = new Set<number>(
    activeIssueId
      ? (detectedIssues.find(i => i.id === activeIssueId)?.affectedJoints ?? [])
      : []
  )

  const issueMarkers = detectedIssues.flatMap(issue =>
    issue.frames.slice(0, 2).map(fi => {
      const frame = frames[Math.min(fi, frames.length - 1)]
      return {
        time: frame?.timestamp ?? (fi / Math.max(frames.length, 1)) * duration,
        color: issue.severity === 'severe' ? '#ef4444' : issue.severity === 'moderate' ? '#f97316' : '#eab308',
      }
    })
  )

  useEffect(() => {
    if (!activeIssueId || !videoRef.current || !frames.length) return
    const issue = detectedIssues.find(i => i.id === activeIssueId)
    if (!issue?.frames.length) return
    const frame = frames[Math.min(issue.frames[0], frames.length - 1)]
    if (frame) { videoRef.current.currentTime = frame.timestamp; setCurrentTime(frame.timestamp) }
  }, [activeIssueId, detectedIssues, frames])

  useEffect(() => {
    if (videoRef.current) videoRef.current.playbackRate = playbackRate
  }, [playbackRate])

  const togglePlay = useCallback(() => {
    const v = videoRef.current; if (!v) return
    v.paused ? v.play() : v.pause()
  }, [])

  const handleScrub = useCallback((t: number) => {
    const v = videoRef.current; if (!v) return
    v.currentTime = t; setCurrentTime(t)
    onTimeChange?.(t)
  }, [onTimeChange])

  const handleReferenceFile = useCallback(async (file: File) => {
    setRefStatus('processing')
    setRefProgress(0)
    try {
      const blobUrl = URL.createObjectURL(file)
      const videoEl = document.createElement('video')
      videoEl.src = blobUrl
      videoEl.muted = true
      await new Promise<void>((res, rej) => {
        videoEl.addEventListener('loadedmetadata', () => res())
        videoEl.addEventListener('error', () => rej(new Error('Reference video failed to load')))
        videoEl.load()
      })
      const rFrames = await extractPoseFromVideo(videoEl, p => setRefProgress(Math.round(p * 100)))
      URL.revokeObjectURL(blobUrl)
      setReferenceFrames(rFrames)
      setRefStatus('ready')
      setShowIdeal(true)  // auto-enable ideal overlay when reference is loaded
    } catch {
      setRefStatus('idle')
    }
  }, [])

  const rates = [0.25, 0.5, 1, 1.5, 2]

  return (
    <div className="flex flex-col gap-3">
      {/* Video container */}
      <div className="relative rounded-2xl overflow-hidden bg-zinc-950 border border-zinc-800 shadow-2xl aspect-video">
        <video
          ref={videoRef}
          src={videoSrc}
          className="w-full h-full object-contain"
          onTimeUpdate={e => { const t = e.currentTarget.currentTime; setCurrentTime(t); onTimeChange?.(t) }}
          onLoadedMetadata={e => setDuration(e.currentTarget.duration)}
          onPlay={() => setIsPlaying(true)}
          onPause={() => setIsPlaying(false)}
          onEnded={() => setIsPlaying(false)}
        />

        {(showOverlay || showIdeal) && (
          <PoseCanvas
            videoRef={videoRef}
            frames={frames}
            referenceFrames={referenceFrames.length > 0 ? referenceFrames : undefined}
            flaggedJoints={flaggedJoints}
            pulsedJoints={pulsedJoints}
            showOverlay={showOverlay}
            showIdeal={showIdeal}
            currentTime={currentTime}
            duration={duration}
            movementType={movementType}
          />
        )}

        {/* Legend */}
        {(showOverlay || showIdeal) && (
          <div className="absolute top-3 left-3 flex flex-col gap-1.5 pointer-events-none">
            {showOverlay && (
              <div className="flex items-center gap-1.5 bg-black/60 backdrop-blur-sm rounded-lg px-2.5 py-1.5 text-[10px] font-mono">
                <span className="w-2 h-2 rounded-full bg-green-400 inline-block" />
                <span className="text-zinc-300">Your skeleton</span>
                <span className="w-2 h-2 rounded-full bg-red-400 inline-block ml-2" />
                <span className="text-zinc-300">Flagged</span>
                <span className="w-2 h-2 rounded-full bg-yellow-400 inline-block ml-2" />
                <span className="text-zinc-300">Active</span>
              </div>
            )}
            {showIdeal && (
              <div className="flex items-center gap-1.5 bg-black/60 backdrop-blur-sm rounded-lg px-2.5 py-1.5 text-[10px] font-mono">
                <span className="w-2 h-2 rounded-full bg-white inline-block" />
                <span className="text-zinc-300">
                  {refStatus === 'ready' ? 'Reference video' : 'Ideal form'}
                </span>
              </div>
            )}
          </div>
        )}

        {/* Controls — top right */}
        <div className="absolute top-3 right-3 flex items-center gap-2">
          {/* Reference upload */}
          <div className="relative">
            <button
              onClick={() => refInputRef.current?.click()}
              disabled={refStatus === 'processing'}
              title="Upload reference video"
              className={cn(
                'p-2 rounded-lg border backdrop-blur-sm transition-all text-xs flex items-center gap-1.5',
                refStatus === 'ready'
                  ? 'bg-green-600/80 border-green-500 text-white'
                  : refStatus === 'processing'
                  ? 'bg-zinc-800/80 border-zinc-600 text-zinc-400 cursor-not-allowed'
                  : 'bg-black/60 border-zinc-700 text-zinc-400 hover:text-white hover:border-zinc-500'
              )}
            >
              {refStatus === 'processing'
                ? <><Loader2 className="w-3.5 h-3.5 animate-spin" /><span className="text-[10px] font-mono hidden sm:inline">{refProgress}%</span></>
                : refStatus === 'ready'
                ? <><CheckCircle className="w-3.5 h-3.5" /><span className="text-[10px] font-mono hidden sm:inline">Ref loaded</span></>
                : <><Upload className="w-3.5 h-3.5" /><span className="text-[10px] font-mono hidden sm:inline">Upload ref</span></>
              }
            </button>
            <input
              ref={refInputRef}
              type="file"
              accept="video/*"
              className="hidden"
              onChange={e => { const f = e.target.files?.[0]; if (f) handleReferenceFile(f) }}
            />
          </div>

          <button
            onClick={() => setShowIdeal(!showIdeal)}
            title={showIdeal ? 'Hide ideal form' : 'Show ideal form'}
            className={cn(
              'p-2 rounded-lg border backdrop-blur-sm transition-all',
              showIdeal
                ? 'bg-white/20 border-white/40 text-white'
                : 'bg-black/60 border-zinc-700 text-zinc-400 hover:text-white'
            )}
          >
            <Ghost className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={() => setShowOverlay(!showOverlay)}
            title={showOverlay ? 'Hide skeleton' : 'Show skeleton'}
            className={cn(
              'p-2 rounded-lg border backdrop-blur-sm transition-all',
              showOverlay
                ? 'bg-green-600/80 border-green-500 text-white'
                : 'bg-black/60 border-zinc-700 text-zinc-400 hover:text-white'
            )}
          >
            {showOverlay ? <Eye className="w-3.5 h-3.5" /> : <EyeOff className="w-3.5 h-3.5" />}
          </button>
        </div>

        {/* Centre play button */}
        {!isPlaying && (
          <button
            onClick={togglePlay}
            className="absolute inset-0 flex items-center justify-center bg-black/20 hover:bg-black/30 transition-colors"
          >
            <div className="w-14 h-14 rounded-full bg-white/10 backdrop-blur-sm border border-white/20 flex items-center justify-center">
              <Play className="w-6 h-6 text-white ml-1" />
            </div>
          </button>
        )}
      </div>

      {/* Scrubber + transport */}
      <div className="space-y-2">
        <FrameScrubber
          duration={duration}
          currentTime={currentTime}
          onChange={handleScrub}
          issueMarkers={issueMarkers}
        />

        <div className="flex items-center justify-between">
          <button
            onClick={togglePlay}
            className="w-8 h-8 rounded-lg bg-zinc-800 hover:bg-zinc-700 flex items-center justify-center transition-colors"
          >
            {isPlaying ? <Pause className="w-3.5 h-3.5 text-white" /> : <Play className="w-3.5 h-3.5 text-white ml-0.5" />}
          </button>

          <div className="flex items-center gap-1">
            {rates.map(r => (
              <button
                key={r}
                onClick={() => setPlaybackRate(r)}
                className={cn(
                  'px-2 py-1 rounded text-[10px] font-mono transition-colors',
                  playbackRate === r ? 'bg-purple-600 text-white' : 'bg-zinc-800 text-zinc-400 hover:text-white'
                )}
              >
                {r}×
              </button>
            ))}
          </div>

          <span className="text-[10px] font-mono text-zinc-600">
            {currentTime.toFixed(1)}s / {duration.toFixed(1)}s
          </span>
        </div>
      </div>
    </div>
  )
}
