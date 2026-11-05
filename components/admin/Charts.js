"use client"

import { useRef, useState } from "react"

const pct = (n, d) => (d ? Math.round((n / d) * 100) : 0)

// Shared hover/focus tooltip, positioned over the hovered mark.
export function useTip() {
  const box = useRef(null)
  const [tip, setTip] = useState(null)
  const show = (e, lines) => {
    const outer = box.current.getBoundingClientRect()
    const r = e.currentTarget.getBoundingClientRect()
    setTip({ lines, x: r.left - outer.left + r.width / 2, y: r.top - outer.top })
  }
  const el = tip && (
    <div className="an-tip" style={{ left: tip.x, top: tip.y }} role="tooltip">
      {tip.lines.map((l, i) => <div key={i} className={i === 0 ? "an-tip-head" : ""}>{l}</div>)}
    </div>
  )
  return { box, show, hide: () => setTip(null), el }
}

export function Columns({ items, max, color, compact = false }) {
  const { box, show, hide, el } = useTip()
  return (
    <div className="an-chart" ref={box} onMouseLeave={hide}>
      <div className={`an-cols ${compact ? "compact" : ""}`}>
        {items.map((it) => (
          <button key={it.key} type="button" className={`an-col ${it.active ? "on" : ""}`} aria-label={it.tip.join(". ")}
            onMouseEnter={(e) => show(e, it.tip)} onFocus={(e) => show(e, it.tip)} onBlur={hide} onClick={it.onClick}>
            <span className="an-col-plot">
              {!compact && <span className="an-col-val num">{it.text}</span>}
              <i style={{ height: `${Math.max(it.value ? 2 : 0, pct(it.value, max))}%`, background: color }} />
            </span>
            <span className="an-col-label">{it.label}</span>
            {it.sub && <span className="an-col-sub">{it.sub}</span>}
          </button>
        ))}
      </div>
      {el}
    </div>
  )
}
