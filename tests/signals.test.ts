import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { scannerCredential,credentialHash,fingerprint,normalizedSignal,assertFresh } from '../src/server/signal-contracts.js';
import { readJson } from '../src/server/http.js';
const fixture=JSON.parse(readFileSync(new URL('../fixtures/contracts-v1.json',import.meta.url),'utf8'));
test('S2-02: scanner secrets are random, fixed-format and hashed',()=>{
 const a=scannerCredential(),b=scannerCredential();assert.notEqual(a,b);assert.equal(a.length,47);
 assert.equal(credentialHash(a).length,64);assert.notEqual(credentialHash(a),a);assert.throws(()=>credentialHash('invalid'));
});
test('S2-05: fingerprints are object-order invariant and normalize instrument multiplier',()=>{
 const event=normalizedSignal(fixture.signal),other=normalizedSignal({...fixture.signal,instrument:{...fixture.instrument,contractMultiplier:'1.0'}});
 assert.equal(fingerprint(event),fingerprint(other));assert.equal(fingerprint({a:1,b:2}),fingerprint({b:2,a:1}));
 assert.notEqual(fingerprint(event),fingerprint({...event,strategyVersion:'other'}));
});
test('S2-04: deterministic freshness rejects stale, expired and future observations',()=>{
 const event=fixture.signal,now=Date.parse(event.emittedAt);
 assert.doesNotThrow(()=>assertFresh(event,now));
 assert.throws(()=>assertFresh(event,now+121000),/stale/i);
 assert.throws(()=>assertFresh(event,now+1000000),/expired/i);
 assert.throws(()=>assertFresh(event,now-10000),/future/i);
});
test('S2-10: JSON reader enforces actual streaming bytes and valid media/body',async()=>{
 const url='http://127.0.0.1/test',headers={'content-type':'application/json'};
 assert.deepEqual(await readJson(new Request(url,{method:'POST',headers,body:'{"name":"fixture"}'})),{name:'fixture'});
 await assert.rejects(()=>readJson(new Request(url,{method:'POST',headers,body:'{'})),/invalid json/i);
 await assert.rejects(()=>readJson(new Request(url,{method:'POST',body:'{}'})),/content type/i);
 const body=new ReadableStream({start(c){c.enqueue(new TextEncoder().encode('x'.repeat(65537)));c.close();}});
 await assert.rejects(()=>readJson(new Request(url,{method:'POST',headers,body,duplex:'half'} as RequestInit)),/too large/i);
});
