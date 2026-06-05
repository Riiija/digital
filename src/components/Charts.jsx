// Graphiques SVG 100% natifs — aucune dépendance

export function BarChartSVG({ data }) {
  const max = Math.max(...data.map(d => d.count), 1)
  const W = 480, H = 180, PAD = { top: 10, right: 10, bottom: 40, left: 30 }
  const inner = { w: W - PAD.left - PAD.right, h: H - PAD.top - PAD.bottom }
  const bw = inner.w / data.length
  return (
    <svg viewBox={`0 0 ${W} ${H}`} style={{ width: '100%', maxWidth: W }}>
      {/* Lignes de grille */}
      {[0.25, 0.5, 0.75, 1].map(r => (
        <line key={r}
          x1={PAD.left} y1={PAD.top + inner.h * (1 - r)}
          x2={PAD.left + inner.w} y2={PAD.top + inner.h * (1 - r)}
          stroke="#1e1e3a" strokeWidth={1}
        />
      ))}
      {data.map((d, i) => {
        const bh = (d.count / max) * inner.h || 0
        const x = PAD.left + i * bw + bw * 0.15
        const y = PAD.top + inner.h - bh
        const barW = bw * 0.7
        return (
          <g key={d.name}>
            <rect x={x} y={y} width={barW} height={bh} fill={d.fill} rx={4} opacity={0.9} />
            {d.count > 0 && (
              <text x={x + barW / 2} y={y - 4} textAnchor="middle" fill={d.fill} fontSize={11} fontWeight="600">
                {d.count}
              </text>
            )}
            <text x={x + barW / 2} y={H - PAD.bottom + 16} textAnchor="middle" fill="#64748b" fontSize={10}>
              {d.name.slice(0, 6)}
            </text>
          </g>
        )
      })}
      {/* Axe Y */}
      {[0, Math.round(max / 2), max].map(v => (
        <text key={v} x={PAD.left - 4} y={PAD.top + inner.h - (v / max) * inner.h + 4} textAnchor="end" fill="#3a4a6a" fontSize={10}>{v}</text>
      ))}
    </svg>
  )
}

export function PieChartSVG({ data }) {
  const total = data.reduce((s, d) => s + d.value, 0) || 1
  const CX = 100, CY = 100, R = 80
  let angle = -Math.PI / 2
  const slices = data.map(d => {
    const a = (d.value / total) * Math.PI * 2
    const x1 = CX + R * Math.cos(angle)
    const y1 = CY + R * Math.sin(angle)
    angle += a
    const x2 = CX + R * Math.cos(angle)
    const y2 = CY + R * Math.sin(angle)
    const large = a > Math.PI ? 1 : 0
    const mx = CX + (R + 18) * Math.cos(angle - a / 2)
    const my = CY + (R + 18) * Math.sin(angle - a / 2)
    const pct = Math.round(d.value / total * 100)
    return { ...d, x1, y1, x2, y2, large, mx, my, pct, a }
  })

  return (
    <svg viewBox="0 0 260 200" style={{ width: '100%', maxWidth: 260 }}>
      {slices.map((s, i) => s.a > 0 && (
        <g key={i}>
          <path
            d={`M${CX},${CY} L${s.x1},${s.y1} A${R},${R} 0 ${s.large},1 ${s.x2},${s.y2} Z`}
            fill={s.fill} opacity={0.9}
          />
        </g>
      ))}
      {/* Légende */}
      {data.map((d, i) => (
        <g key={i} transform={`translate(200, ${30 + i * 28})`}>
          <rect x={0} y={0} width={14} height={14} rx={3} fill={d.fill} />
          <text x={20} y={11} fill="#94a3b8" fontSize={11}>{d.name}</text>
          <text x={20} y={24} fill={d.fill} fontSize={10} fontWeight="600">
            {d.value} ({Math.round(d.value / total * 100)}%)
          </text>
        </g>
      ))}
    </svg>
  )
}

export function HBarChartSVG({ data }) {
  const max = Math.max(...data.map(d => d.count), 1)
  const H = data.length * 36 + 20
  return (
    <svg viewBox={`0 0 400 ${H}`} style={{ width: '100%', maxWidth: 400 }}>
      {data.map((d, i) => {
        const y = i * 36 + 10
        const bw = ((d.count / max) * 250) || 0
        return (
          <g key={d.name}>
            <text x={0} y={y + 14} fill="#94a3b8" fontSize={12}>{d.name}</text>
            <rect x={100} y={y} width={bw} height={22} fill={d.fill} rx={4} opacity={0.9} />
            {d.count > 0 && (
              <text x={106 + bw} y={y + 15} fill={d.fill} fontSize={11} fontWeight="600">{d.count}</text>
            )}
          </g>
        )
      })}
    </svg>
  )
}
