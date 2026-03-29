import { ReactNode } from 'react';

interface GlassCardProps {
  children: ReactNode;
  className?: string;
}

export function GlassCard({ children, className = '' }: GlassCardProps) {
  return (
    <div
      className={`relative backdrop-blur-xl bg-white/5 rounded-2xl border border-white/10 shadow-2xl ${className}`}
      style={{
        boxShadow: `
          0 0 1px rgba(0, 255, 136, 0.3),
          0 0 20px rgba(0, 255, 136, 0.1),
          0 20px 40px rgba(0, 0, 0, 0.5),
          inset 0 1px 0 rgba(255, 255, 255, 0.1)
        `,
      }}
    >
      {/* Edge glow effect */}
      <div
        className="absolute inset-0 rounded-2xl"
        style={{
          background: `linear-gradient(135deg, 
            rgba(0, 255, 136, 0.1) 0%, 
            transparent 30%, 
            transparent 70%, 
            rgba(59, 130, 246, 0.1) 100%)`,
          pointerEvents: 'none',
        }}
      />
      <div className="relative">{children}</div>
    </div>
  );
}
