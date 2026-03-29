interface MetricCardProps {
  label: string;
  value: string;
  unit: string;
  trend?: 'up' | 'down';
  trendValue?: string;
  icon?: string;
}

export function MetricCard({ label, value, unit, trend, trendValue, icon }: MetricCardProps) {
  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center gap-2 text-white/60">
        {icon && <span className="text-lg">{icon}</span>}
        <span className="uppercase tracking-wider" style={{ fontFamily: "'Tiro Tamil', serif", fontSize: '0.75rem' }}>
          {label}
        </span>
      </div>
      <div className="flex items-baseline gap-2">
        <span
          className="text-4xl font-bold bg-gradient-to-r from-[#00ff88] to-[#00ffdd] bg-clip-text text-transparent"
          style={{ fontFamily: "'Tiro Tamil', serif" }}
        >
          {value}
        </span>
        <span className="text-white/60" style={{ fontFamily: "'Tiro Tamil', serif", fontSize: '0.875rem' }}>
          {unit}
        </span>
      </div>
      {trend && trendValue && (
        <div className="flex items-center gap-1">
          <span className={trend === 'up' ? 'text-[#00ff88]' : 'text-[#3b82f6]'}>
            {trend === 'up' ? '↑' : '↓'}
          </span>
          <span className="text-white/70" style={{ fontFamily: "'Tiro Tamil', serif", fontSize: '0.75rem' }}>
            {trendValue}
          </span>
        </div>
      )}
    </div>
  );
}
