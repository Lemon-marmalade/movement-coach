import { useEffect, useRef } from 'react';

interface Joint {
  x: number;
  y: number;
  label: string;
}

export function SkeletalTracking() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animationFrame: number;
    let time = 0;

    // Define skeletal joints with animation
    const getJoints = (t: number): Joint[] => {
      const centerX = canvas.width / 2;
      const baseY = canvas.height * 0.3;
      const breathe = Math.sin(t * 0.05) * 5;
      const armSwing = Math.sin(t * 0.08) * 20;

      return [
        // Head
        { x: centerX, y: baseY + breathe, label: 'HEAD' },
        // Neck
        { x: centerX, y: baseY + 40 + breathe, label: 'NECK' },
        // Shoulders
        { x: centerX - 60, y: baseY + 50 + breathe, label: 'L_SHOULDER' },
        { x: centerX + 60, y: baseY + 50 + breathe, label: 'R_SHOULDER' },
        // Elbows
        { x: centerX - 80 - armSwing, y: baseY + 110 + breathe, label: 'L_ELBOW' },
        { x: centerX + 80 + armSwing, y: baseY + 110 + breathe, label: 'R_ELBOW' },
        // Wrists
        { x: centerX - 90 - armSwing * 1.5, y: baseY + 170 + breathe, label: 'L_WRIST' },
        { x: centerX + 90 + armSwing * 1.5, y: baseY + 170 + breathe, label: 'R_WRIST' },
        // Spine points
        { x: centerX, y: baseY + 90 + breathe, label: 'SPINE_MID' },
        { x: centerX, y: baseY + 140 + breathe, label: 'SPINE_LOW' },
        // Hips
        { x: centerX - 40, y: baseY + 170 + breathe, label: 'L_HIP' },
        { x: centerX + 40, y: baseY + 170 + breathe, label: 'R_HIP' },
        // Knees
        { x: centerX - 35, y: baseY + 260 + breathe, label: 'L_KNEE' },
        { x: centerX + 35, y: baseY + 260 + breathe, label: 'R_KNEE' },
        // Ankles
        { x: centerX - 40, y: baseY + 350 + breathe, label: 'L_ANKLE' },
        { x: centerX + 40, y: baseY + 350 + breathe, label: 'R_ANKLE' },
      ];
    };

    const connections = [
      // Head to body
      [0, 1], [1, 2], [1, 3],
      // Arms
      [2, 4], [4, 6], [3, 5], [5, 7],
      // Spine
      [1, 8], [8, 9],
      // Hips
      [9, 10], [9, 11],
      // Legs
      [10, 12], [12, 14], [11, 13], [13, 15],
      // Shoulders to spine
      [2, 8], [3, 8],
      // Hips connection
      [10, 11]
    ];

    const animate = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      time++;

      const joints = getJoints(time);

      // Draw connections with glow effect
      connections.forEach(([start, end]) => {
        const startJoint = joints[start];
        const endJoint = joints[end];

        // Outer glow
        ctx.strokeStyle = 'rgba(0, 255, 136, 0.2)';
        ctx.lineWidth = 8;
        ctx.beginPath();
        ctx.moveTo(startJoint.x, startJoint.y);
        ctx.lineTo(endJoint.x, endJoint.y);
        ctx.stroke();

        // Main line
        ctx.strokeStyle = 'rgba(0, 255, 136, 0.9)';
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.moveTo(startJoint.x, startJoint.y);
        ctx.lineTo(endJoint.x, endJoint.y);
        ctx.stroke();

        // Inner bright line
        ctx.strokeStyle = 'rgba(136, 255, 200, 1)';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(startJoint.x, startJoint.y);
        ctx.lineTo(endJoint.x, endJoint.y);
        ctx.stroke();
      });

      // Draw joints with glow effect
      joints.forEach((joint, index) => {
        // Outer glow
        ctx.fillStyle = 'rgba(0, 255, 136, 0.3)';
        ctx.beginPath();
        ctx.arc(joint.x, joint.y, 12, 0, Math.PI * 2);
        ctx.fill();

        // Mid glow
        ctx.fillStyle = 'rgba(0, 255, 136, 0.6)';
        ctx.beginPath();
        ctx.arc(joint.x, joint.y, 8, 0, Math.PI * 2);
        ctx.fill();

        // Main joint
        ctx.fillStyle = '#00ff88';
        ctx.beginPath();
        ctx.arc(joint.x, joint.y, 5, 0, Math.PI * 2);
        ctx.fill();

        // Inner bright spot
        ctx.fillStyle = '#88ffc8';
        ctx.beginPath();
        ctx.arc(joint.x, joint.y, 2, 0, Math.PI * 2);
        ctx.fill();
      });

      animationFrame = requestAnimationFrame(animate);
    };

    animate();

    return () => {
      cancelAnimationFrame(animationFrame);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      width={640}
      height={480}
      className="w-full h-full"
      style={{ imageRendering: 'crisp-edges' }}
    />
  );
}
