import { test } from "node:test";
import assert from "node:assert/strict";
import { generateMockBusinesses } from "@/lib/api/mock-data";
import { NICHES } from "@/lib/utils/constants";

// Demo mode is the first thing a new user sees, and for a long time it showed
// restaurant names for twelve of the niches: a pharmacy search returned "Golden
// Plate" and "Blue Plate", because the name table only covered the fifteen
// niches that existed when it was written and everything after fell through to
// the restaurant list. These tests exist so that adding a niche and forgetting
// its templates fails here rather than in front of someone evaluating the
// product.

function generate(nicheId: string, count = 20) {
  return generateMockBusinesses(
    nicheId, "Lagos", "Lagos", "Nigeria", "NG", "+234", 6.5244, 3.3792, count
  );
}

const names = (nicheId: string) => generate(nicheId).map((r) => r.name);

test("every niche has its own demo names, none borrow the fallback list", () => {
  // What an unmapped niche produces. Any real niche matching this is a niche
  // whose templates are missing.
  const fallback = names("not_a_real_niche");

  for (const niche of NICHES) {
    const generated = names(niche.id);

    if (niche.id === "restaurant") {
      // Restaurants are the fallback list, so matching it is correct here.
      assert.deepEqual(generated, fallback);
      continue;
    }

    assert.notDeepEqual(
      generated,
      fallback,
      `${niche.id} has no name templates and is generating restaurant names`
    );
  }
});

test("every niche has a demo category of its own", () => {
  for (const niche of NICHES) {
    const [record] = generate(niche.id, 1);
    assert.notEqual(
      record.category,
      "Business",
      `${niche.id} has no category and is falling back to the generic one`
    );
  }
});

test("an unmapped niche still generates usable records rather than throwing", () => {
  // The fallback is a safety net, not a bug. It just must not be reachable
  // from anything in NICHES.
  const records = generate("not_a_real_niche", 5);

  assert.equal(records.length, 5);
  assert.equal(records[0].category, "Business");
  assert.ok(records.every((r) => r.name));
});
