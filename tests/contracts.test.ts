import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { schemas, instrumentKey, eventKey } from '../src/contracts.js';

const fixture = JSON.parse(readFileSync(new URL('../fixtures/contracts-v1.json', import.meta.url), 'utf8'));
const invalid = JSON.parse(readFileSync(new URL('../fixtures/invalid-contracts-v1.json', import.meta.url), 'utf8'));

for (const [name, schema] of Object.entries(schemas)) {
  test('D-03: valid ' + name + ' fixture and unsupported version', () => {
    assert.equal(schema.safeParse(fixture[name]).success, true);
    assert.equal(schema.safeParse(invalid[name]).success, false);
    assert.equal(schema.safeParse({ ...fixture[name], schemaVersion: 2 }).success, false);
    assert.equal(schema.safeParse({ ...fixture[name], unexpected: true }).success, false);
  });
}
test('D-03 R-02: complete instrument identity separates venue, market and multiplier', () => {
  const baseline = instrumentKey(fixture.instrument);
  for (const change of [{exchange:'bybit'}, {market:'spot',settlement:null}, {contractMultiplier:'1000'}]) {
    assert.notEqual(instrumentKey({...fixture.instrument,...change}), baseline);
  }
  assert.equal(instrumentKey({...fixture.instrument,contractMultiplier:'1.0'}), baseline);
  assert.equal(schemas.instrument.safeParse({...fixture.instrument, settlement:null}).success, false);
});
test('D-03: event identity uses a collision-safe source/event tuple', () => {
  assert.notEqual(eventKey('a|b','c'),eventKey('a','b|c'));
  assert.equal(eventKey('a','b'),eventKey('a','b'));
});
test('D-03: signal requires provenance, explicit UTC times and bounded freshness', () => {
  for (const change of [{evidence:undefined},{timeframe:'60'},{observedAt:1700000000},{maxAgeSeconds:0},
    {expiresAt:'2026-11-17T00:00:00Z'},{observedAt:'2026-11-17T00:00:00Z'}]) {
    assert.equal(schemas.signal.safeParse({...fixture.signal,...change}).success,false);
  }
});
test('D-03 R-04: fill decimals and provenance are validated without number coercion', () => {
  for (const change of [{quantity:10},{quantity:'0'},{quantity:'NaN'},{price:'1e4'},{fee:'-1'},
    {provenance:'exchange-confirmed',externalOrderId:undefined}]) {
    assert.equal(schemas.fill.safeParse({...fixture.fill,...change}).success,false);
  }
});
test('D-03 R-06: provider acceptance requires reference and retries require schedule', () => {
  assert.equal(schemas.delivery.safeParse({...fixture.delivery,status:'provider-accepted'}).success,false);
  assert.equal(schemas.delivery.safeParse({...fixture.delivery,status:'retrying'}).success,false);
});
