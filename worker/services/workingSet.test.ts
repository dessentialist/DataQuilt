import assert from "node:assert/strict";
import { WorkingSet } from "./workingSet";

function deepClone<T>(v: T): T {
  return JSON.parse(JSON.stringify(v));
}

async function run() {
  // Arrange: input with 5 rows, declared outputs A,B
  const input = [
    { id: 1, name: "alpha", "Company Domain": "a.com" },
    { id: 2, name: "beta", "Company Domain": "b.com" },
    { id: 3, name: "gamma", "Company Domain": "c.com" },
    { id: 4, name: "delta", "Company Domain": "d.com" },
    { id: 5, name: "epsilon", "Company Domain": "e.com" },
  ];
  const ws = new WorkingSet(deepClone(input), ["A", "B"]);

  // Act: merge a partial with first 3 rows having A filled; B absent
  const partial = [
    { id: 1, name: "alpha", "Company Domain": "a.com", A: "a1" },
    { id: 2, name: "beta", "Company Domain": "b.com", A: "a2" },
    { id: 3, name: "gamma", "Company Domain": "c.com", A: "a3" },
  ];
  ws.mergePartial(partial);

  // Assert: resume stats
  const stats = ws.getStats();
  assert.equal(stats.inputRows, 5, "inputRows should be 5");
  assert.equal(stats.overlayRows, 3, "overlayRows should be 3 after merge");
  assert.equal(stats.outputColumns.length, 2, "two declared output columns");

  // Assert: row views 1..3 include A, 4..5 don't
  for (let i = 0; i < 3; i++) {
    const row = ws.getRowView(i);
    assert.equal(row.name, input[i].name);
    assert.equal(row.A, `a${i + 1}`);
    assert.equal(row.B ?? "", "", "B should be empty/undefined before set");
  }
  for (let i = 3; i < 5; i++) {
    const row = ws.getRowView(i);
    assert.equal(row.name, input[i].name);
    assert.equal(row.A ?? "", "", "A should be empty on unprocessed rows");
  }

  // Act: set outputs for row 3 (index 3) and row 4 (index 4)
  ws.setOutput(3, "A", "a4");
  ws.setOutput(4, "B", "b5");

  // Assert: materialize slice of first 4 rows (indices 0..3)
  const slice = ws.materializeSlice(4);
  assert.equal(slice.length, 4);
  assert.equal(slice[0].A, "a1");
  assert.equal(slice[1].A, "a2");
  assert.equal(slice[2].A, "a3");
  assert.equal(slice[3].A, "a4");

  // Assert: full materialization has B only on last row
  const all = ws.materializeAll();
  assert.equal(all.length, 5);
  assert.equal(all[4].B, "b5");

  // Assert: headers stable (input headers first, then outputs A,B)
  const headers = ws.getHeaders();
  for (const h of ["id", "name", "Company Domain"]) {
    assert(headers.includes(h), `header should include ${h}`);
  }
  assert(headers.includes("A"));
  assert(headers.includes("B"));

  console.log("✅ WorkingSet unit test passed");
}

run().catch((err) => {
  console.error("❌ WorkingSet unit test failed", err);
  process.exit(1);
});


