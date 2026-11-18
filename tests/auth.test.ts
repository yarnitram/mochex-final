import { test } from 'node:test';
import assert from 'node:assert/strict';
import { hashPassword, verifyPassword, hashToken, newSessionToken, validOrigin } from '../src/server/auth.js';

test('S1-02: salted scrypt password hashes verify without exposing password',async()=>{
  const password='synthetic-password-for-tests';
  const a=await hashPassword(password),b=await hashPassword(password);
  assert.notEqual(a,b); assert.equal(a.includes(password),false);
  assert.equal(await verifyPassword(password,a),true);
  assert.equal(await verifyPassword('wrong',a),false);
  assert.equal(await verifyPassword(password,'invalid-digest'),false);
  await assert.rejects(()=>hashPassword('short'));
});
test('S1-02: opaque session tokens are random, hashes stable, malformed input rejected',()=>{
  const a=newSessionToken(),b=newSessionToken();
  assert.notEqual(a,b); assert.equal(a.length,43);
  assert.notEqual(hashToken(a),a); assert.equal(hashToken(a),hashToken(a));
  assert.throws(()=>hashToken('arbitrary-user-id'));
});
test('S1-03: mutation origin is exact, with no prefix or missing-origin bypass',()=>{
  assert.equal(validOrigin('http://127.0.0.1:3021','http://127.0.0.1:3021'),true);
  for(const origin of [null,'http://127.0.0.1:3021.evil.test','http://evil.test','null'])
    assert.equal(validOrigin(origin,'http://127.0.0.1:3021'),false);
});
