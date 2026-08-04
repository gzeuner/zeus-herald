import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRequestGate } from '../src/http/requestGate.js';

test('request gate serializes operations and continues after rejection', async () => {
  const gate = createRequestGate({ maxConcurrent: 1 });
  let active = 0;
  let peak = 0;
  const order = [];

  const run = (id, fail = false) => gate.run(async () => {
    active += 1;
    peak = Math.max(peak, active);
    order.push(`${id}:start`);
    await new Promise((resolve) => setTimeout(resolve, 5));
    active -= 1;
    order.push(`${id}:end`);
    if (fail) throw new Error('expected_failure');
    return id;
  });

  const results = await Promise.allSettled([run('a'), run('b', true), run('c')]);
  assert.equal(peak, 1);
  assert.deepEqual(order, ['a:start', 'a:end', 'b:start', 'b:end', 'c:start', 'c:end']);
  assert.equal(results[0].value, 'a');
  assert.match(results[1].reason.message, /expected_failure/);
  assert.equal(results[2].value, 'c');
  assert.deepEqual(gate.metrics(), { active: 0, pending: 0, maxConcurrent: 1 });
});
