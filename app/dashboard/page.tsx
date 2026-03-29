import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import RecentSessions from '@/components/session/RecentSessions'
import { Activity, Plus, Zap, TrendingUp, Target, User, Clock } from 'lucide-react'

const MOVEMENT_ICONS: Record<string, string> = {
  lateral_cut: '⚡', jump_landing: '🦘', squat: '🏋️', deadlift: '💪',
  lunge: '🦵', plank: '📐', overhead_press: '🏆', sprint: '🏃',
}

export default async function DashboardPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const [profileResult, recentResult, countResult] = await Promise.all([
    supabase.from('profiles').select('name, sport, fitness_level').eq('id', user.id).single(),
    supabase.from('sessions')
      .select('id, movement_type, timestamp, scores, detected_issues, duration_seconds')
      .eq('user_id', user.id)
      .order('timestamp', { ascending: false })
      .limit(10),
    supabase.from('sessions').select('id', { count: 'exact', head: true }).eq('user_id', user.id),
  ])

  const profile = profileResult.data
  const sessions = recentResult.data ?? []
  const totalCount = countResult.count ?? 0

  // Compute quick stats from recent sessions
  const scored = sessions.filter(s => s.scores)
  const avgStability = scored.length
    ? (scored.reduce((s, x) => s + (x.scores?.stability ?? 0), 0) / scored.length).toFixed(1)
    : null
  const avgAlignment = scored.length
    ? (scored.reduce((s, x) => s + (x.scores?.alignment ?? 0), 0) / scored.length).toFixed(1)
    : null
  const totalIssues = sessions.reduce((s, x) => s + (x.detected_issues?.length ?? 0), 0)

  // Most analyzed movement
  const movCounts: Record<string, number> = {}
  sessions.forEach(s => { movCounts[s.movement_type] = (movCounts[s.movement_type] ?? 0) + 1 })
  const topMovement = Object.entries(movCounts).sort((a, b) => b[1] - a[1])[0]

  // Last session
  const lastSession = sessions[0]
  const lastSessionDate = lastSession
    ? new Date(lastSession.timestamp).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
    : null

  const firstName = profile?.name?.split(' ')[0] || null
  const hour = new Date().getHours()
  const greeting = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening'

  return (
    <div className="min-h-screen bg-[#050505]">
      {/* Header */}
      <header className="h-14 border-b border-zinc-800/60 flex items-center justify-between px-6 sticky top-0 z-10 bg-[#050505]/95 backdrop-blur-md">
        <div className="flex items-center gap-6">
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 bg-purple-600 rounded-lg flex items-center justify-center">
              <Activity className="w-4 h-4 text-white" />
            </div>
            <span className="text-sm font-semibold text-white tracking-tight">FORM</span>
          </div>
          <nav className="hidden sm:flex items-center gap-1">
            {[
              { href: '/dashboard', label: 'Dashboard', active: true },
              { href: '/profile', label: 'Profile', active: false },
            ].map(({ href, label, active }) => (
              <Link key={href} href={href}
                className={`px-3 py-1.5 rounded-lg text-xs font-mono transition-colors ${
                  active ? 'bg-zinc-800 text-white' : 'text-zinc-500 hover:text-zinc-300 hover:bg-zinc-900'
                }`}>
                {label}
              </Link>
            ))}
          </nav>
        </div>
        <Link
          href="/upload"
          className="flex items-center gap-1.5 bg-purple-600 hover:bg-purple-500 text-white text-xs font-mono rounded-lg px-3.5 py-2 transition-colors"
        >
          <Plus className="w-3.5 h-3.5" />
          New Session
        </Link>
      </header>

      <main className="max-w-5xl mx-auto px-6 py-8 space-y-8">
        {/* Greeting */}
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-2xl font-semibold text-white tracking-tight">
              {firstName ? `${greeting}, ${firstName}` : greeting}
            </h1>
            <p className="text-sm text-zinc-500 mt-0.5 flex items-center gap-2">
              {profile?.sport && (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-zinc-800 text-zinc-300 text-xs font-mono">
                  {profile.sport}
                </span>
              )}
              {profile?.fitness_level && (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-purple-600/15 text-purple-300 text-xs font-mono capitalize">
                  {profile.fitness_level}
                </span>
              )}
              {!profile?.sport && !profile?.fitness_level && (
                <Link href="/profile" className="text-zinc-600 hover:text-zinc-400 transition-colors">
                  Complete your profile →
                </Link>
              )}
            </p>
          </div>
          <Link href="/profile"
            className="w-9 h-9 rounded-xl bg-zinc-800 border border-zinc-700 flex items-center justify-center text-sm font-bold text-zinc-300 hover:border-zinc-600 transition-colors">
            {(profile?.name || user.email)?.[0]?.toUpperCase() ?? '?'}
          </Link>
        </div>

        {/* KPI strip */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[
            {
              icon: <Target className="w-4 h-4 text-purple-400" />,
              label: 'Sessions',
              value: totalCount,
              sub: 'total analyzed',
            },
            {
              icon: <TrendingUp className="w-4 h-4 text-green-400" />,
              label: 'Stability',
              value: avgStability ?? '—',
              sub: avgStability ? 'avg /10' : 'no data yet',
            },
            {
              icon: <Zap className="w-4 h-4 text-blue-400" />,
              label: 'Alignment',
              value: avgAlignment ?? '—',
              sub: avgAlignment ? 'avg /10' : 'no data yet',
            },
            {
              icon: <Clock className="w-4 h-4 text-zinc-400" />,
              label: 'Last Session',
              value: lastSessionDate ?? '—',
              sub: lastSession?.movement_type?.replace('_', ' ') ?? 'no sessions yet',
            },
          ].map(({ icon, label, value, sub }) => (
            <div key={label} className="bg-zinc-900/50 border border-zinc-800 rounded-xl p-4 hover:border-zinc-700 transition-colors">
              <div className="flex items-center gap-2 mb-3">
                {icon}
                <span className="text-[10px] font-mono text-zinc-500 uppercase tracking-widest">{label}</span>
              </div>
              <div className="text-xl font-bold text-white font-mono capitalize">{value}</div>
              <div className="text-[10px] text-zinc-600 mt-0.5 capitalize">{sub}</div>
            </div>
          ))}
        </div>

        {/* Action + spotlight row */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {/* Primary CTA */}
          <Link href="/upload">
            <div className="relative overflow-hidden bg-purple-600/10 border border-purple-500/25 hover:border-purple-500/50 rounded-2xl p-6 cursor-pointer transition-all group h-full">
              <div className="absolute -top-8 -right-8 w-32 h-32 bg-purple-600/10 rounded-full blur-2xl group-hover:bg-purple-600/20 transition-colors" />
              <div className="w-10 h-10 rounded-xl bg-purple-600/20 border border-purple-500/30 flex items-center justify-center mb-4">
                <Plus className="w-5 h-5 text-purple-300" />
              </div>
              <h3 className="text-sm font-semibold text-white mb-1">Analyze Movement</h3>
              <p className="text-xs text-zinc-400 leading-relaxed">Upload a video or record live for AI-powered biomechanical analysis with pose estimation.</p>
              <div className="mt-4 text-xs font-mono text-purple-400 group-hover:text-purple-300 transition-colors">
                Start now →
              </div>
            </div>
          </Link>

          {/* Last session or onboarding nudge */}
          {lastSession ? (
            <Link href={`/session/${lastSession.id}`}>
              <div className="bg-zinc-900/50 border border-zinc-800 hover:border-zinc-700 rounded-2xl p-6 cursor-pointer transition-all group h-full">
                <div className="flex items-center justify-between mb-3">
                  <span className="text-[10px] font-mono text-zinc-500 uppercase tracking-widest">Last Session</span>
                  <span className="text-[10px] text-zinc-600">{lastSessionDate}</span>
                </div>
                <div className="flex items-center gap-3 mb-3">
                  <span className="text-2xl">{MOVEMENT_ICONS[lastSession.movement_type] ?? '🎯'}</span>
                  <div>
                    <p className="text-sm font-semibold text-zinc-100 capitalize">{lastSession.movement_type.replace('_', ' ')}</p>
                    {lastSession.duration_seconds && (
                      <p className="text-[10px] text-zinc-500">{lastSession.duration_seconds.toFixed(1)}s · {lastSession.detected_issues?.length ?? 0} issues</p>
                    )}
                  </div>
                </div>
                {lastSession.scores && (
                  <div className="flex gap-4">
                    {[
                      { label: 'Stability', val: lastSession.scores.stability, color: lastSession.scores.stability >= 7 ? 'text-green-400' : lastSession.scores.stability >= 4 ? 'text-yellow-400' : 'text-red-400' },
                      { label: 'Alignment', val: lastSession.scores.alignment, color: lastSession.scores.alignment >= 7 ? 'text-green-400' : lastSession.scores.alignment >= 4 ? 'text-yellow-400' : 'text-red-400' },
                      { label: 'Risk', val: lastSession.scores.risk, color: lastSession.scores.risk >= 7 ? 'text-red-400' : lastSession.scores.risk >= 4 ? 'text-yellow-400' : 'text-green-400' },
                    ].map(({ label, val, color }) => (
                      <div key={label}>
                        <div className={`text-base font-bold font-mono ${color}`}>{val.toFixed(1)}</div>
                        <div className="text-[9px] text-zinc-600 font-mono uppercase">{label}</div>
                      </div>
                    ))}
                  </div>
                )}
                <div className="mt-3 text-xs font-mono text-zinc-500 group-hover:text-zinc-300 transition-colors">
                  View full analysis →
                </div>
              </div>
            </Link>
          ) : (
            <div className="bg-zinc-900/30 border border-zinc-800 border-dashed rounded-2xl p-6 flex flex-col items-center justify-center text-center gap-2">
              <User className="w-8 h-8 text-zinc-700" />
              <p className="text-sm text-zinc-500">No sessions yet</p>
              <p className="text-xs text-zinc-600">Upload your first movement video to get started</p>
            </div>
          )}
        </div>

        {/* Session feed */}
        <div>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xs font-mono text-zinc-400 uppercase tracking-widest">Recent Activity</h2>
            {topMovement && (
              <span className="text-[10px] font-mono text-zinc-600">
                Most analyzed: <span className="text-zinc-400 capitalize">{topMovement[0].replace('_', ' ')} ({topMovement[1]}×)</span>
              </span>
            )}
          </div>
          <RecentSessions userId={user.id} />
        </div>
      </main>
    </div>
  )
}
