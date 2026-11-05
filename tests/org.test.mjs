import { test } from "node:test"
import assert from "node:assert/strict"
import { groupOrganisations } from "../lib/shared/org.mjs"

test("spellings of one organisation are grouped under one label", () => {
  const groups = [
    ["NEMA", "National Environment Management Authority", "National Environment Management Authority (NEMA)."],
    ["UEDCL", "Uganda Electricity Distribution Company Limited"],
    ["NREP", "National Renewable Energy Platform", "National Renewable Energy Platform (NREP)"],
    ["MEMD", "Ministry of Energy and Mineral Development", "MINISTRY OF ENERGY AND MINERAL DEVELOPMENT"],
    ["Kobo Engineers", "KOBO ENGINEERS LIMITED", "Kobo Engineers Limited"],
  ]
  const map = groupOrganisations([...groups.flat(), "Makerere University", "Makerere University Business School"])
  for (const names of groups) {
    assert.equal(new Set(names.map((n) => map.get(n).key)).size, 1, names.join(" / "))
  }
  assert.equal(map.get("National Environment Management Authority").label, "NEMA")
  assert.equal(map.get("Uganda Electricity Distribution Company Limited").label, "UEDCL")
  assert.notEqual(map.get("Makerere University").key, map.get("Makerere University Business School").key)
})
