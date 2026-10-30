import type { ExerciseTrend } from '../../shared/progression'

export function TrendChart({ trend, large = false }: { trend: ExerciseTrend; large?: boolean }) {
  const points = trend.points.slice(-8)
  const values = points.map((point) => point.e1rm ?? point.bestReps)
  const min = Math.min(...values)
  const max = Math.max(...values)
  const spread = max - min || 1
  const width = large ? 300 : 116
  const height = large ? 108 : 30
  const coordinates = points.map((_, index) => {
    const x = points.length === 1 ? width / 2 : 4 + index / (points.length - 1) * (width - 8)
    const y = points.length === 1 ? height / 2 : height - 5 - ((values[index] - min) / spread) * (height - 10)
    return { x, y }
  })
  const path = coordinates.map((point) => `${point.x.toFixed(1)},${point.y.toFixed(1)}`).join(' ')
  return <svg className={large ? 'trend-chart large' : 'trend-chart'} viewBox={`0 0 ${width} ${height}`} role="img" aria-label={`${trend.name} 最近 ${points.length} 次训练趋势`}>
    <polyline points={path} fill="none" stroke="currentColor" strokeWidth={large ? 2 : 1.8} strokeLinejoin="round" strokeLinecap="round"/>
    {points.length === 1 && <circle cx={width / 2} cy={height / 2} r={large ? 4 : 2.5} fill="currentColor"/>}
    {large && points.length > 1 && coordinates.map((point, index) => <circle key={points[index].workoutId} cx={point.x} cy={point.y} r="3" fill="currentColor"/>)}
  </svg>
}
