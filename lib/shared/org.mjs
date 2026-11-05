const FILLER = new Set(["of", "and", "&", "the", "for", "in"])
const SUFFIX = /^(limited|ltd|plc|llp|co)$/i
const ACRONYM = /^[A-Z]{2,10}$/

// The forms one organisation's name can take: "National Environment Management Authority (NEMA)."
// gives NEMA and "national environment management authority".
function forms(name) {
  const text = String(name || "").replace(/[.,;]+$/, "").trim()
  const out = new Set()
  const paren = text.match(/\(([A-Za-z]{2,10})\)/)
  if (paren) out.add(paren[1].toUpperCase())
  const bare = text.replace(/\([^)]*\)/g, " ").trim()
  if (ACRONYM.test(bare)) out.add(bare)
  const words = bare.split(/[\s/,-]+/).filter(Boolean)
  const trimmed = [...words]
  while (trimmed.length > 1 && SUFFIX.test(trimmed[trimmed.length - 1].replace(/\.$/, ""))) trimmed.pop()
  for (const list of [words, trimmed]) {
    const initials = list.filter((w) => !FILLER.has(w.toLowerCase())).map((w) => w[0].toUpperCase()).join("")
    if (list.length >= 3 && initials.length >= 3) out.add(initials)
  }
  if (trimmed.length) out.add(trimmed.join(" ").toLowerCase())
  return out
}

// Groups the spellings of each organisation, e.g. "NEMA", "National Environment Management Authority"
// and "... (NEMA)." Returns a Map from each name to { key, label } for its group.
export function groupOrganisations(names) {
  const list = [...new Set(names.map((n) => String(n || "").trim()))]
  const parent = list.map((_, i) => i)
  const root = (i) => (parent[i] === i ? i : (parent[i] = root(parent[i])))
  const owner = new Map()
  list.forEach((name, i) => {
    for (const f of forms(name)) {
      if (owner.has(f)) parent[root(i)] = root(owner.get(f))
      else owner.set(f, i)
    }
  })
  const members = new Map()
  list.forEach((name, i) => members.set(root(i), [...(members.get(root(i)) || []), name]))
  const result = new Map()
  for (const [r, group] of members) {
    const acronym = group.flatMap((n) => [...forms(n)]).find((f) => ACRONYM.test(f) && group.some((n) => n.includes(f)))
    const label = acronym || [...group].sort((x, y) => y.length - x.length)[0] || "No organisation"
    for (const n of group) result.set(n, { key: `org${r}`, label: label || "No organisation" })
  }
  return result
}
