'use client'

import { useEffect, useState, useRef, useCallback } from 'react'
import { motion } from 'framer-motion'
import { Bot, RefreshCw, Volume2 } from 'lucide-react'

interface AIFeedbackProps {
  feedback: string | null
  loading: boolean
  onRegenerate: () => void
  /** Stub: called when user clicks voice playback — wires into Iris/ElevenLabs */
  onFeedbackReady?: (text: string) => void
}

const TYPEWRITER_SPEED = 18 // ms per character

export default function AIFeedback({ feedback, loading, onRegenerate, onFeedbackReady }: AIFeedbackProps) {
  const [displayed, setDisplayed] = useState('')
  const [typing, setTyping] = useState(false)
  const indexRef = useRef(0)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const runTypewriter = useCallback((text: string) => {
    indexRef.current = 0
    setDisplayed('')
    setTyping(true)

    const tick = () => {
      if (indexRef.current < text.length) {
        indexRef.current++
        setDisplayed(text.slice(0, indexRef.current))
        timerRef.current = setTimeout(tick, TYPEWRITER_SPEED)
      } else {
        setTyping(false)
        onFeedbackReady?.(text)
      }
    }
    timerRef.current = setTimeout(tick, TYPEWRITER_SPEED)
  }, [onFeedbackReady])

  useEffect(() => {
    if (timerRef.current) clearTimeout(timerRef.current)
    if (feedback) {
      runTypewriter(feedback)
    } else {
      setDisplayed('')
      setTyping(false)
    }
    return () => { if (timerRef.current) clearTimeout(timerRef.current) }
  }, [feedback, runTypewriter])

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay: 0.2 }}
      className="bg-zinc-900/50 border border-zinc-800 rounded-xl p-5"
    >
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 rounded-full bg-purple-600/20 border border-purple-500/30 flex items-center justify-center">
            <Bot className="w-3 h-3 text-purple-400" />
          </div>
          <h3 className="text-xs font-mono text-zinc-400 uppercase tracking-widest">AI Coach</h3>
        </div>
        <div className="flex items-center gap-2">
          {/* Voice stub — emits text for Iris/ElevenLabs to consume */}
          {feedback && !typing && (
            <button
              onClick={() => onFeedbackReady?.(feedback)}
              className="p-1.5 text-zinc-500 hover:text-zinc-300 transition-colors"
              title="Voice playback (Iris)"
            >
              <Volume2 className="w-3.5 h-3.5" />
            </button>
          )}
          <button
            onClick={onRegenerate}
            disabled={loading || typing}
            className="flex items-center gap-1.5 text-[10px] font-mono text-zinc-500 hover:text-zinc-300 disabled:opacity-40 transition-colors"
          >
            <RefreshCw className={`w-3 h-3 ${loading ? 'animate-spin' : ''}`} />
            Regenerate
          </button>
        </div>
      </div>

      <div className="min-h-[80px]">
        {loading && !feedback && (
          <div className="flex items-center gap-2 text-zinc-500">
            <div className="flex gap-1">
              {[0, 1, 2].map(i => (
                <motion.div
                  key={i}
                  className="w-1.5 h-1.5 bg-purple-500 rounded-full"
                  animate={{ y: [0, -6, 0] }}
                  transition={{ duration: 0.8, repeat: Infinity, delay: i * 0.2 }}
                />
              ))}
            </div>
            <span className="text-xs text-zinc-500">Analyzing movement...</span>
          </div>
        )}

        {(displayed || typing) && (
          <p className="text-sm text-zinc-300 leading-relaxed whitespace-pre-wrap">
            {displayed}
            {typing && <span className="cursor-blink text-purple-400 font-bold">|</span>}
          </p>
        )}

        {!loading && !feedback && !displayed && (
          <p className="text-sm text-zinc-600 italic">No feedback generated yet.</p>
        )}
      </div>
    </motion.div>
  )
}
