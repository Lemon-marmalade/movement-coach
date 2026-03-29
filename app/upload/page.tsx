'use client'

import { useState, useCallback, useRef } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import dynamic from 'next/dynamic'
import { motion, AnimatePresence } from 'framer-motion'
import { Activity, Upload, FileVideo, X, Video, ChevronRight, AlertCircle } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { uploadVideo, getVideoExpiresAt } from '@/lib/supabase/storage'
import { useSessionStore } from '@/stores/sessionStore'
import { useAnalysisStore } from '@/stores/analysisStore'
import { MOVEMENT_META } from '@/types'
import type { MovementType } from '@/types'
import ProgressBar from '@/components/upload/ProgressBar'

const LiveRecorder = dynamic(() => import('@/components/recording/LiveRecorder'), { ssr: false })

const MOVEMENTS: { type: MovementType; icon: string }[] = [
  { type: 'lateral_cut', icon: '⚡' },
  { type: 'jump_landing', icon: '🦘' },
  { type: 'squat', icon: '🏋️' },
  { type: 'deadlift', icon: '💪' },
  { type: 'lunge', icon: '🦵' },
  { type: 'plank', icon: '📐' },
  { type: 'overhead_press', icon: '🏆' },
  { type: 'sprint', icon: '🏃' },
]

const CATEGORY_COLORS = {
  athletic:  'border-orange-500/30 bg-orange-500/5 hover:border-orange-400/50',
  strength:  'border-blue-500/30 bg-blue-500/5 hover:border-blue-400/50',
  stability: 'border-green-500/30 bg-green-500/5 hover:border-green-400/50',
  cardio:    'border-purple-500/30 bg-purple-500/5 hover:border-purple-400/50',
}

const CATEGORY_BADGE = {
  athletic:  'bg-orange-500/15 text-orange-400',
  strength:  'bg-blue-500/15 text-blue-400',
  stability: 'bg-green-500/15 text-green-400',
  cardio:    'bg-purple-500/15 text-purple-400',
}

type InputMode = 'upload' | 'record'

export default function UploadPage() {
  const router = useRouter()
  const supabase = createClient()
  const fileInputRef = useRef<HTMLInputElement>(null)

  const { setVideoFile, setVideoUrl, setVideoBlobUrl, setSessionId, movementType, setMovementType } = useSessionStore()
  const { status, progress, setStatus, setProgress, setError } = useAnalysisStore()

  const [mode, setMode] = useState<InputMode>('upload')
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [dragOver, setDragOver] = useState(false)
  const [localError, setLocalError] = useState<string | null>(null)
  const [step, setStep] = useState<'movement' | 'input'>('movement')

  const validateFile = (file: File): string | null => {
    if (!['video/mp4', 'video/quicktime', 'video/webm'].includes(file.type)) return 'Invalid file type. Use MP4, MOV, or WebM.'
    if (file.size > 200 * 1024 * 1024) return 'File too large. Maximum 200 MB.'
    return null
  }

  const handleFile = useCallback((file: File) => {
    const err = validateFile(file)
    if (err) { setLocalError(err); return }
    setLocalError(null)
    setSelectedFile(file)
    setVideoFile(file)
    setVideoBlobUrl(URL.createObjectURL(file))
  }, [setVideoFile, setVideoBlobUrl])

  const handleRecordingComplete = useCallback((blob: Blob, blobUrl: string) => {
    const file = new File([blob], 'recording.webm', { type: 'video/webm' })
    setSelectedFile(file)
    setVideoFile(file)
    setVideoBlobUrl(blobUrl)
  }, [setVideoFile, setVideoBlobUrl])

  const handleUploadAndAnalyze = async () => {
    if (!selectedFile) return
    setStatus('uploading')
    setLocalError(null)
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error('Not signed in')
      const sessionId = crypto.randomUUID()
      setSessionId(sessionId)
      const videoUrl = await uploadVideo(selectedFile, user.id, sessionId, p => setProgress(p * 50))
      setVideoUrl(videoUrl)
      await supabase.from('sessions').insert({
        id: sessionId, user_id: user.id, movement_type: movementType,
        video_url: videoUrl, video_expires_at: getVideoExpiresAt(),
      })
      setStatus('processing')
      setProgress(50)
      router.push(`/analysis?session=${sessionId}`)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Upload failed')
    }
  }

  const isUploading = status === 'uploading'
  const meta = MOVEMENT_META[movementType]

  return (
    <div className="min-h-screen bg-[#050505]">
      <header className="h-14 border-b border-zinc-800/50 flex items-center px-6 gap-3 sticky top-0 z-10 bg-[#050505]/90 backdrop-blur-md">
        <Link href="/dashboard" className="flex items-center gap-2 group">
          <div className="w-7 h-7 bg-purple-600 rounded-lg flex items-center justify-center">
            <Activity className="w-4 h-4 text-white" />
          </div>
          <span className="text-xs font-mono uppercase tracking-widest text-zinc-400 group-hover:text-white transition-colors">FORM</span>
        </Link>
        <span className="text-zinc-700">/</span>
        <span className="text-xs font-mono text-zinc-500 uppercase tracking-widest">New Session</span>
      </header>

      <main className="max-w-3xl mx-auto px-6 py-10">
        {/* Steps indicator */}
        <div className="flex items-center gap-3 mb-8">
          {['Select Movement', 'Add Video'].map((s, i) => (
            <div key={s} className="flex items-center gap-3">
              <div className={`flex items-center gap-2 text-xs font-mono transition-colors ${
                (i === 0 && step === 'movement') || (i === 1 && step === 'input') ? 'text-white' : 'text-zinc-600'
              }`}>
                <div className={`w-5 h-5 rounded-full text-[10px] flex items-center justify-center font-bold transition-colors ${
                  (i === 0 && step === 'movement') || (i === 1 && step === 'input') ? 'bg-purple-600 text-white' : 'bg-zinc-800 text-zinc-500'
                }`}>{i + 1}</div>
                {s}
              </div>
              {i < 1 && <ChevronRight className="w-3 h-3 text-zinc-700" />}
            </div>
          ))}
        </div>

        <AnimatePresence mode="wait">
          {/* Step 1: Movement Selection */}
          {step === 'movement' && (
            <motion.div key="movement" initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}>
              <h2 className="text-xl font-semibold text-white mb-1">What movement are you analyzing?</h2>
              <p className="text-sm text-zinc-500 mb-6">Choose the type of movement in your video.</p>

              <div className="grid grid-cols-2 gap-3">
                {MOVEMENTS.map(({ type, icon }) => {
                  const m = MOVEMENT_META[type]
                  const isSelected = movementType === type
                  return (
                    <button
                      key={type}
                      onClick={() => { setMovementType(type); setStep('input') }}
                      className={`text-left p-4 rounded-xl border transition-all group ${
                        isSelected
                          ? 'border-purple-500 bg-purple-600/10'
                          : `${CATEGORY_COLORS[m.category]} border`
                      }`}
                    >
                      <div className="flex items-start justify-between mb-2">
                        <span className="text-xl">{icon}</span>
                        <span className={`text-[10px] font-mono px-2 py-0.5 rounded-full capitalize ${CATEGORY_BADGE[m.category]}`}>
                          {m.category}
                        </span>
                      </div>
                      <p className="text-sm font-semibold text-zinc-100 mb-1">{m.label}</p>
                      <p className="text-[11px] text-zinc-500 leading-relaxed mb-2">{m.description}</p>
                      <div className="flex flex-wrap gap-1">
                        {m.injuryFocuses.map(f => (
                          <span key={f} className="text-[9px] px-1.5 py-0.5 rounded bg-red-500/10 text-red-400/80">{f}</span>
                        ))}
                      </div>
                      <p className="text-[9px] text-zinc-600 mt-2">📷 {m.cameraAngle}</p>
                    </button>
                  )
                })}
              </div>
            </motion.div>
          )}

          {/* Step 2: Input */}
          {step === 'input' && (
            <motion.div key="input" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 20 }}>
              {/* Selected movement summary */}
              <div className="flex items-center gap-3 mb-6">
                <button onClick={() => setStep('movement')} className="text-zinc-500 hover:text-white text-xs font-mono transition-colors">
                  ← Change
                </button>
                <div className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-xl border ${CATEGORY_COLORS[meta.category]}`}>
                  <span className="text-sm font-semibold text-zinc-100">{meta.label}</span>
                  <span className={`text-[10px] font-mono px-1.5 py-0.5 rounded-full capitalize ${CATEGORY_BADGE[meta.category]}`}>
                    {meta.category}
                  </span>
                </div>
                <span className="text-xs text-zinc-600">📷 Best angle: {meta.cameraAngle}</span>
              </div>

              {/* Mode tabs */}
              <div className="flex bg-zinc-900 rounded-xl p-1 border border-zinc-800 mb-6">
                {(['upload', 'record'] as InputMode[]).map(m => (
                  <button
                    key={m}
                    onClick={() => setMode(m)}
                    className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg text-sm font-mono transition-all ${
                      mode === m ? 'bg-zinc-800 text-white shadow-sm' : 'text-zinc-500 hover:text-zinc-300'
                    }`}
                  >
                    {m === 'upload' ? <><Upload className="w-3.5 h-3.5" />Upload Video</> : <><Video className="w-3.5 h-3.5" />Record Live</>}
                  </button>
                ))}
              </div>

              {/* Upload mode */}
              {mode === 'upload' && (
                <div className="space-y-4">
                  <div
                    onDrop={e => { e.preventDefault(); setDragOver(false); const f = e.dataTransfer.files[0]; if (f) handleFile(f) }}
                    onDragOver={e => { e.preventDefault(); setDragOver(true) }}
                    onDragLeave={() => setDragOver(false)}
                    onClick={() => fileInputRef.current?.click()}
                    className={`relative border-2 border-dashed rounded-2xl p-10 flex flex-col items-center cursor-pointer transition-all ${
                      dragOver ? 'border-purple-500 bg-purple-500/5' : 'border-zinc-700 hover:border-zinc-600 bg-zinc-900/20'
                    }`}
                  >
                    <input ref={fileInputRef} type="file" accept="video/*" className="hidden"
                      onChange={e => { const f = e.target.files?.[0]; if (f) handleFile(f) }} />
                    <AnimatePresence mode="wait">
                      {selectedFile ? (
                        <motion.div key="file" initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="text-center">
                          <FileVideo className="w-10 h-10 text-purple-400 mx-auto mb-3" />
                          <p className="text-sm font-semibold text-white">{selectedFile.name}</p>
                          <p className="text-xs text-zinc-500 mt-1">{(selectedFile.size / 1024 / 1024).toFixed(1)} MB</p>
                        </motion.div>
                      ) : (
                        <motion.div key="empty" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="text-center">
                          <div className="w-16 h-16 rounded-2xl border-2 border-dashed border-zinc-700 flex items-center justify-center mx-auto mb-4">
                            <Upload className="w-6 h-6 text-zinc-600" />
                          </div>
                          <p className="text-sm text-zinc-300 font-medium mb-1">Drop your video here</p>
                          <p className="text-xs text-zinc-600">MP4, MOV, WebM · Max 200 MB</p>
                        </motion.div>
                      )}
                    </AnimatePresence>
                    {selectedFile && (
                      <button className="absolute top-3 right-3 p-1 text-zinc-500 hover:text-white"
                        onClick={e => { e.stopPropagation(); setSelectedFile(null) }}>
                        <X className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                </div>
              )}

              {/* Record mode */}
              {mode === 'record' && (
                <LiveRecorder
                  movementType={movementType}
                  onRecordingComplete={handleRecordingComplete}
                />
              )}

              {/* Errors */}
              {(localError || status === 'error') && (
                <div className="flex items-center gap-2 bg-red-950/50 border border-red-800/50 rounded-xl p-3.5 text-sm text-red-400 mt-4">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  {localError ?? useAnalysisStore.getState().errorMessage}
                </div>
              )}

              {/* Upload progress */}
              {isUploading && <ProgressBar progress={progress} label="Uploading..." className="mt-4" />}

              {/* CTA */}
              {selectedFile && !isUploading && (
                <motion.button
                  initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
                  onClick={handleUploadAndAnalyze}
                  className="w-full mt-5 bg-purple-600 hover:bg-purple-500 text-white font-mono text-sm font-semibold rounded-xl py-4 transition-colors shadow-lg shadow-purple-600/20"
                >
                  Analyze {meta.label} →
                </motion.button>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </main>
    </div>
  )
}
