import React, { useMemo, useState, useEffect } from 'react';
import { Results } from '@mediapipe/pose';
import { EXERCISES, ExerciseReference } from '@/src/types';
import { AlertCircle, CheckCircle2, Info, MessageSquare, Zap } from 'lucide-react';
import { cn } from '@/src/lib/utils';
import { GoogleGenAI } from "@google/genai";

interface FeedbackPanelProps {
  results: Results | null;
  selectedExercise: ExerciseReference;
}

const calculateAngle = (p1: any, p2: any, p3: any) => {
  const ba = { x: p1.x - p2.x, y: p1.y - p2.y, z: p1.z - p2.z };
  const bc = { x: p3.x - p2.x, y: p3.y - p2.y, z: p3.z - p2.z };
  
  const dot = ba.x * bc.x + ba.y * bc.y + ba.z * bc.z;
  const magA = Math.sqrt(ba.x * ba.x + ba.y * ba.y + ba.z * ba.z);
  const magC = Math.sqrt(bc.x * bc.x + bc.y * bc.y + bc.z * bc.z);
  
  const angle = Math.acos(dot / (magA * magC));
  return (angle * 180) / Math.PI;
};

export const FeedbackPanel: React.FC<FeedbackPanelProps> = ({ results, selectedExercise }) => {
  const [aiFeedback, setAiFeedback] = useState<string>("");
  const [isAnalyzing, setIsAnalyzing] = useState(false);

  const [heartRate, setHeartRate] = useState(155);
  const [pulseBars, setPulseBars] = useState<number[]>(Array.from({ length: 18 }, () => 30 + Math.random() * 45));
  const [calories, setCalories] = useState(569);
  const [formQuality, setFormQuality] = useState(94);
  const [postureDots, setPostureDots] = useState<boolean[]>([true, true, true, true, true]);

  const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value));

  useEffect(() => {
    const hrInterval = setInterval(() => {
      setHeartRate((prev) => clamp(prev + Math.floor(Math.random() * 3 - 1), 152, 160));
      setPulseBars((prev) => prev.map((h) => clamp(h + (Math.random() * 8 - 4), 35, 48)));
    }, 2400);

    const calInterval = setInterval(() => {
      setCalories((prev) => prev + (Math.random() > 0.3 ? 2 : 1));
    }, 5000);

    const formInterval = setInterval(() => {
      setPostureDots((prev) => {
        const next = [...prev];
        const flickerIndex = Math.floor(Math.random() * next.length);
        next[flickerIndex] = false;
        setTimeout(() => {
          setPostureDots((restore) => restore.map((v, idx) => (idx === flickerIndex ? true : v)));
        }, 1200);
        return next;
      });
      setFormQuality((prev) => clamp(prev + (Math.random() > 0.5 ? 1 : -1), 90, 99));
    }, 4000);

    return () => {
      clearInterval(hrInterval);
      clearInterval(calInterval);
      clearInterval(formInterval);
    };
  }, []);

  const angles = useMemo(() => {
    if (!results?.poseLandmarks) return null;
    const l = results.poseLandmarks;
    
    return {
      left_knee: calculateAngle(l[23], l[25], l[27]),
      right_knee: calculateAngle(l[24], l[26], l[28]),
      left_hip: calculateAngle(l[11], l[23], l[25]),
      right_hip: calculateAngle(l[12], l[24], l[26]),
      back: calculateAngle(l[11], l[23], l[24]), // Simplified back angle
    };
  }, [results]);

  const getStatus = (angle: number, range: { min: number; max: number }) => {
    if (angle < range.min) return 'low';
    if (angle > range.max) return 'high';
    return 'optimal';
  };

  const analyzeWithAI = async () => {
    if (!results || isAnalyzing) return;
    setIsAnalyzing(true);
    
    try {
      const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
      const response = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: `Analyze this pose data for a ${selectedExercise.name}. 
        Landmarks: ${JSON.stringify(results.poseLandmarks.slice(0, 33).map(l => ({ x: l.x.toFixed(2), y: l.y.toFixed(2), z: l.z.toFixed(2) })))}
        Current calculated angles: ${JSON.stringify(angles)}
        Ideal ranges: ${JSON.stringify(selectedExercise.idealAngles)}
        Provide concise, spatially specific feedback for a physical therapist.`,
      });
      setAiFeedback(response.text || "No feedback available.");
    } catch (error) {
      console.error("AI Analysis error:", error);
      setAiFeedback("Analysis failed. Check connection.");
    } finally {
      setIsAnalyzing(false);
    }
  };

  return (
    <div className="flex flex-col gap-4 h-full">
      {/* Live Session Metics */}
      <div className="grid grid-cols-3 gap-3">
        <div className="bg-[#14161c] border border-[#00ff9d]/40 rounded-[24px] p-4 shadow-[0_0_30px_rgba(0,255,157,0.35)]">
          <p className="text-xs font-mono text-[#a7f5d6] uppercase tracking-widest">Heart Rate</p>
          <div className="flex items-end gap-2">
            <span className="text-4xl font-extrabold text-[#00ff9d] transition-all duration-500">{heartRate}</span>
            <span className="text-sm font-mono text-[#8df9ce]">bpm</span>
          </div>
          <div className="mt-2 h-1 w-full bg-[#112126] rounded-full overflow-hidden">
            <div className="h-full bg-[#00ff9d] transition-all duration-500" style={{ width: `${clamp(((heartRate - 140) / 40) * 100, 0, 100)}%` }} />
          </div>
          <div className="mt-2 flex items-center gap-1 h-6">
            {pulseBars.map((h, index) => (
              <span
                key={index}
                className="bg-[#00ff9d] rounded-full transition-all duration-[2800ms] ease-in-out"
                style={{ width: 3, height: `${h}px` }}
              />
            ))}
          </div>
        </div>

        <div className="bg-[#14161c] border border-[#00ff9d]/40 rounded-[24px] p-4 shadow-[0_0_30px_rgba(0,255,157,0.35)]">
          <p className="text-xs font-mono text-[#a7f5d6] uppercase tracking-widest">Calories Burned</p>
          <div className="flex items-end gap-2">
            <span className="text-4xl font-extrabold text-[#00ff9d] transition-all duration-500">{calories}</span>
            <span className="text-sm font-mono text-[#8df9ce]">kcal</span>
          </div>
          <div className="mt-2 h-1 w-full bg-[#112126] rounded-full overflow-hidden">
            <div className="h-full bg-[#00ff9d] transition-all duration-500" style={{ width: `${clamp((calories / 800) * 100, 0, 100)}%` }} />
          </div>
          <span className="text-xs font-mono text-[#8df9ce]">Goal: 800 kcal</span>
        </div>

        <div className="bg-[#14161c] border border-[#00ff9d] /40 rounded-[24px] p-4 shadow-[0_0_30px_rgba(0,255,157,0.35)]">
          <p className="text-xs font-mono text-[#a7f5d6] uppercase tracking-widest">Form Quality</p>
          <div className="flex items-center gap-2">
            <span className="text-4xl font-extrabold text-[#00ff9d] transition-all duration-500">{formQuality}</span>
            <span className="text-sm font-mono text-[#8df9ce]">/ 100</span>
          </div>
          <div className="mt-2 flex items-center gap-2">
            {postureDots.map((good, index) => (
              <span key={index} className={`h-2 w-2 rounded-full transition-all duration-300 ${good ? 'bg-[#00ff9d]' : 'bg-[#2f3f48]'}`} />
            ))}
          </div>
          <span className="text-xs font-mono text-[#8df9ce]">Posture consistency live status</span>
        </div>
      </div>

      {/* Real-time Metrics */}
      <div className="grid grid-cols-2 gap-3">
        {Object.entries(selectedExercise.idealAngles).map(([key, range]) => {
          const currentAngle = angles ? (angles as any)[key] || 0 : 0;
          const status = getStatus(currentAngle, range);
          
          return (
            <div key={key} className="bg-zinc-900 border border-zinc-800 p-3 rounded-lg flex flex-col gap-1">
              <div className="flex justify-between items-center">
                <span className="text-[10px] font-mono text-zinc-500 uppercase tracking-widest">{range.label}</span>
                {status === 'optimal' ? (
                  <CheckCircle2 className="w-3 h-3 text-green-500" />
                ) : (
                  <AlertCircle className="w-3 h-3 text-amber-500" />
                )}
              </div>
              <div className="flex items-baseline gap-2">
                <span className="text-2xl font-mono text-white">{Math.round(currentAngle)}°</span>
                <span className="text-[10px] text-zinc-600 font-mono">/ {range.min}-{range.max}°</span>
              </div>
              <div className="w-full h-1 bg-zinc-800 rounded-full mt-2 overflow-hidden">
                <div 
                  className={cn(
                    "h-full transition-all duration-300",
                    status === 'optimal' ? "bg-green-500" : "bg-amber-500"
                  )}
                  style={{ width: `${Math.min(100, (currentAngle / range.max) * 100)}%` }}
                />
              </div>
            </div>
          );
        })}
      </div>

      {/* AI Insights */}
      <div className="flex-1 bg-zinc-900 border border-zinc-800 rounded-lg p-4 flex flex-col gap-4">
        <div className="flex justify-between items-center">
          <div className="flex items-center gap-2">
            <Zap className="w-4 h-4 text-purple-400" />
            <h3 className="text-xs font-mono text-white uppercase tracking-widest">AI Clinical Analysis</h3>
          </div>
          <button 
            onClick={analyzeWithAI}
            disabled={!results || isAnalyzing}
            className="px-3 py-1 bg-purple-600 hover:bg-purple-500 disabled:bg-zinc-800 disabled:text-zinc-600 rounded text-[10px] font-mono uppercase tracking-widest transition-colors flex items-center gap-2"
          >
            {isAnalyzing ? "Analyzing..." : "Run Analysis"}
          </button>
        </div>

        <div className="flex-1 overflow-y-auto text-zinc-400 text-sm font-light leading-relaxed">
          {aiFeedback ? (
            <div className="bg-zinc-950/50 border border-zinc-800 p-3 rounded italic">
              {aiFeedback}
            </div>
          ) : (
            <div className="h-full flex flex-col items-center justify-center text-center opacity-50">
              <MessageSquare className="w-8 h-8 mb-2" />
              <p className="text-[10px] font-mono uppercase tracking-widest">Awaiting data for clinical inference</p>
            </div>
          )}
        </div>
      </div>

      {/* Exercise Info */}
      <div className="bg-zinc-900/50 border border-zinc-800 p-4 rounded-lg flex gap-4 items-start">
        <Info className="w-5 h-5 text-zinc-500 shrink-0 mt-0.5" />
        <div>
          <h4 className="text-xs font-mono text-white uppercase tracking-widest mb-1">{selectedExercise.name} Guidance</h4>
          <p className="text-xs text-zinc-500 leading-relaxed">{selectedExercise.description}</p>
        </div>
      </div>
    </div>
  );
};
