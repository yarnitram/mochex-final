import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Pool } from 'pg';
import { login, viewerForToken, logout, withOwner } from '../src/server/store.js';
const admin=new Pool({connectionString:process.env.TEST_ADMIN_DATABASE_URL!});
const app=new Pool({connectionString:process.env.DATABASE_URL!});
const a=process.env.FIXTURE_A_ID!,b=process.env.FIXTURE_B_ID!;
test('S1-02/03: database sessions expire, rotate and revoke',async()=>{
  const token=await login(app,'alice@example.test',process.env.FIXTURE_A_PASSWORD!);
  assert.ok(token); assert.equal((await viewerForToken(app,token))?.id,a);
  const stored=await admin.query('SELECT token_hash FROM terminal_sessions WHERE user_id=$1',[a]);
  assert.notEqual(stored.rows[0].token_hash,token);
  assert.equal(stored.rows[0].token_hash.length,64);
  assert.equal(await login(app,'alice@example.test','wrong-password'),null);
  const rotated=await login(app,'alice@example.test',process.env.FIXTURE_A_PASSWORD!,token);
  assert.ok(rotated); assert.equal(await viewerForToken(app,token),null);
  await logout(app,rotated);
  assert.equal(await viewerForToken(app,rotated),null);
  assert.equal(await viewerForToken(app,'forged'),null);
  assert.equal(await viewerForToken(app,'A'.repeat(43)),null);
  const expired=await login(app,'bob@example.test',process.env.FIXTURE_B_PASSWORD!);
  assert.ok(expired);
  await admin.query("update terminal_sessions set expires_at=now()-interval '1 second' where user_id=$1",[b]);
  assert.equal(await viewerForToken(app,expired),null);
});
test('S1-04: actual non-superuser role cannot see, edit or reassign another owner row',async()=>{
  const role=await app.query('select rolsuper,rolbypassrls from pg_roles where rolname=current_user');
  assert.equal(role.rows[0].rolsuper,false);assert.equal(role.rows[0].rolbypassrls,false);
  await withOwner(app,a,async client=>{
    assert.equal((await client.query('select * from workspace_items')).rows.length,1);
    assert.equal((await client.query('select * from workspace_items where owner_id=$1',[b])).rows.length,0);
    assert.equal((await client.query('update workspace_items set title=$1 where owner_id=$2',['stolen',b])).rowCount,0);
  });
  await assert.rejects(()=>withOwner(app,a,client=>client.query('update workspace_items set owner_id=$1 where owner_id=$2',[b,a])));
  // Pool reuse must not leak transaction-local owner settings.
  assert.equal((await app.query('select * from workspace_items')).rows.length,0);
});
test('S1-05: owner transaction rolls back on failure',async()=>{
  await assert.rejects(()=>withOwner(app,a,async client=>{
    await client.query('update workspace_items set title=$1',['rollback']);
    throw Error('synthetic transaction failure');
  }));
  const rows=await withOwner(app,a,c=>c.query('select title from workspace_items'));
  assert.equal(rows.rows[0].title,'Alice private workspace');
});
test('S1-06: shared DB login limiter persists across clients',async()=>{
  for(let i=0;i<5;i++)assert.equal(await login(app,'limited@example.test','wrong-password'),null);
  assert.equal(await login(app,'limited@example.test',process.env.FIXTURE_A_PASSWORD!),null);
  const count=await admin.query("select failures from terminal_login_limits where email='limited@example.test'");
  assert.ok(count.rows[0].failures>=5);
});
test('cleanup connection pools',async()=>{await app.end();await admin.end();});
