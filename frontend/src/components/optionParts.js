// A choice as [{option, qty, ...}] parts: one part, or one per source when a
// multi-unit need is split (for example 1 × move ours + 1 × buy).
export function optionParts(choice) {
  if (choice?.units?.length) return choice.units
  return [{ option: choice?.option, qty: choice?.qty ?? 1 }]
}

// Count each source once per choice, so a split adds to every source it uses.
export function countSources(choices) {
  const counts = {}
  for (const choice of choices) {
    for (const part of optionParts(choice)) counts[part.option] = (counts[part.option] ?? 0) + 1
  }
  return counts
}
