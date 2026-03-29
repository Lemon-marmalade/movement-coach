import React, { useRef, useEffect, useState } from 'react';
import { Pose, Results } from '@mediapipe/pose';
import { Camera } from '@mediapipe/camera_utils';
import { drawConnectors, drawLandmarks } from '@mediapipe/drawing_utils';
import { POSE_CONNECTIONS } from '@mediapipe/pose';
import { Activity, Camera as CameraIcon, Play, Square, Settings } from 'lucide-react';
import { cn } from '../lib/utils';

interface PoseAnalyzerProps {
  onResults: (results: Results) => void;
  isRecording: boolean;
}

export const PoseAnalyzer: React.FC<PoseAnalyzerProps> = ({ onResults, isRecording }) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isCameraReady, setIsCameraReady] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const pose = new Pose({
      locateFile: (file) => {
        return `https://cdn.jsdelivr.net/npm/@mediapipe/pose/${file}`;
      },
    });

    pose.setOptions({
      modelComplexity: 1,
      smoothLandmarks: true,
      enableSegmentation: false,
      smoothSegmentation: false,
      minDetectionConfidence: 0.5,
      minTrackingConfidence: 0.5,
    });

    pose.onResults((results) => {
      onResults(results);
      
      if (canvasRef.current && videoRef.current) {
        const canvasCtx = canvasRef.current.getContext('2d');
        if (!canvasCtx) return;

        canvasCtx.save();
        canvasCtx.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height);
        
        // Draw video frame
        canvasCtx.drawImage(
          results.image,
          0,
          0,
          canvasRef.current.width,
          canvasRef.current.height
        );

        // Draw landmarks
        if (results.poseLandmarks) {
          drawConnectors(canvasCtx, results.poseLandmarks, POSE_CONNECTIONS, {
            color: '#00FF00',
            lineWidth: 4,
          });
          drawLandmarks(canvasCtx, results.poseLandmarks, {
            color: '#FF0000',
            lineWidth: 2,
            radius: 4,
          });
        }
        canvasCtx.restore();
      }
    });

    if (videoRef.current) {
      const camera = new Camera(videoRef.current, {
        onFrame: async () => {
          if (videoRef.current) {
            await pose.send({ image: videoRef.current });
          }
        },
        width: 640,
        height: 480,
      });
      
      camera.start()
        .then(() => setIsCameraReady(true))
        .catch((err) => {
          console.error('Camera start error:', err);
          setError('Failed to access camera. Please ensure permissions are granted.');
        });
    }

    return () => {
      pose.close();
    };
  }, [onResults]);

  return (
    <div className="relative w-full aspect-video bg-black rounded-lg overflow-hidden border border-zinc-800">
      <video
        ref={videoRef}
        className="hidden"
        playsInline
      />
      <canvas
        ref={canvasRef}
        className="w-full h-full object-cover"
        width={640}
        height={480}
      />
      
      {!isCameraReady && !error && (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-zinc-900/80 backdrop-blur-sm">
          <CameraIcon className="w-12 h-12 text-zinc-500 animate-pulse mb-4" />
          <p className="text-zinc-400 font-mono text-sm uppercase tracking-widest">Initializing Vision Engine...</p>
        </div>
      )}

      {error && (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-red-950/80 backdrop-blur-sm p-6 text-center">
          <p className="text-red-400 font-mono text-sm uppercase tracking-widest mb-2">Error</p>
          <p className="text-white text-sm">{error}</p>
        </div>
      )}

      <div className="absolute top-4 left-4 flex gap-2">
        <div className={cn(
          "px-3 py-1 rounded-full text-[10px] font-mono uppercase tracking-tighter flex items-center gap-2",
          isRecording ? "bg-red-500 text-white animate-pulse" : "bg-zinc-800 text-zinc-400"
        )}>
          <div className={cn("w-2 h-2 rounded-full", isRecording ? "bg-white" : "bg-zinc-600")} />
          {isRecording ? "Live Stream: Recording" : "Live Stream: Standby"}
        </div>
      </div>
    </div>
  );
};
