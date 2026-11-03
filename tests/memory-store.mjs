// In-memory stand-in for the Appwrite documents API, for tests.
export function memoryStore() {
  const data = new Map()
  const table = (c) => (data.has(c) ? data.get(c) : data.set(c, new Map()).get(c))
  const conflict = () => Object.assign(new Error("Document already exists"), { status: 409, name: "AppwriteError" })
  return {
    data,
    async get(c, id) { return table(c).get(id) || null },
    async list(c, queries = []) {
      let rows = [...table(c).values()]
      let limit = 25
      let after = null
      for (const q of queries.map((x) => JSON.parse(x))) {
        if (q.method === "equal") rows = rows.filter((r) => q.values.includes(r[q.attribute]))
        if (q.method === "greaterThan") rows = rows.filter((r) => r[q.attribute] > q.values[0])
        if (q.method === "limit") limit = q.values[0]
        if (q.method === "cursorAfter") after = q.values[0]
      }
      const total = rows.length
      if (after) rows = rows.slice(rows.findIndex((r) => r.$id === after) + 1)
      return { total, documents: rows.slice(0, limit) }
    },
    async create(c, id, doc) {
      if (table(c).has(id)) throw conflict()
      const row = { $id: id, $createdAt: new Date().toISOString(), ...doc }
      table(c).set(id, row)
      return row
    },
    async update(c, id, doc) {
      const row = { ...table(c).get(id), ...doc }
      table(c).set(id, row)
      return row
    },
    async remove(c, id) { table(c).delete(id) },
  }
}
