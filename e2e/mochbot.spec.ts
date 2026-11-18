import { test,expect } from '@playwright/test';
import { observation } from '../fixtures/mochbot-observation';
test('S3-09: MOD-01E HTTP shadows revisions, reads geometry/history and rejects gaps',async({playwright,baseURL})=>{
 const client=await playwright.request.newContext({baseURL});
 try{
  await client.post('/api/auth/login',{headers:{origin:baseURL!},form:{email:'alice@example.test',password:process.env.FIXTURE_A_PASSWORD!}});
  const source=await (await client.post('/api/sources',{headers:{origin:baseURL!},data:{name:'Mochbot HTTP'}})).json();
  const raw=observation(source.id),headers={authorization:'Bearer '+source.credential};
  expect((await client.post('/api/ingest/mochbot',{data:raw})).status()).toBe(401);
  expect((await client.post('/api/ingest/mochbot',{headers,data:{...raw,ownerId:process.env.FIXTURE_B_ID}})).status()).toBe(400);
  const created=await client.post('/api/ingest/mochbot',{headers,data:raw});expect(created.status()).toBe(202);
  const ids=await created.json();
  const gap=await client.post('/api/ingest/mochbot',{headers,data:observation(source.id,2,'entry-ready')});
  expect(gap.status()).toBe(409);expect((await gap.json()).reason).toBe('revision-gap');
  expect((await client.post('/api/ingest/mochbot',{headers,data:observation(source.id,1,'entry-ready')})).status()).toBe(202);
  expect((await client.post('/api/ingest/mochbot',{headers,data:raw})).status()).toBe(200);
  const setup=await (await client.get('/api/setups/'+ids.setupId)).json();
  expect(setup.state).toBe('entry-ready');expect(setup.revision).toBe(1);
  expect(setup.geometry.fillStatus).toBe('unconfirmed');expect(setup.history).toHaveLength(2);
  expect(setup.reconciliation.some((r:any)=>r.reason==='revision-gap')).toBe(true);
  const rows=await (await client.get('/api/signals')).json();
  expect(rows.filter((r:any)=>r.setup_id===ids.setupId)).toHaveLength(2);
 }finally{await client.dispose();}
});
