import { test,expect } from '@playwright/test';
import { signal } from '../integration/signal-fixture';
test('S2-02/03/05/07/10: real account/scanner API boundaries',async({playwright,baseURL})=>{
 const a=await playwright.request.newContext({baseURL}),b=await playwright.request.newContext({baseURL});
 try{
  for(const [client,email,password] of [[a,'alice@example.test',process.env.FIXTURE_A_PASSWORD!],[b,'bob@example.test',process.env.FIXTURE_B_PASSWORD!]] as const){
   await client.post('/api/auth/login',{headers:{origin:baseURL!},form:{email,password}});
   expect((await client.get('/api/auth/me')).status()).toBe(200);
  }
  expect((await a.post('/api/sources',{headers:{origin:'https://wrong.example.test'},data:{name:'Cross origin'}})).status()).toBe(403);
  expect((await a.post('/api/sources',{headers:{origin:baseURL!},data:{name:'Spoof',ownerId:process.env.FIXTURE_B_ID}})).status()).toBe(400);
  const sourceResponse=await a.post('/api/sources',{headers:{origin:baseURL!},data:{name:'HTTP fixture'}});
  expect(sourceResponse.status()).toBe(201);const source=await sourceResponse.json();
  expect(source.credential).toMatch(/^mts_/);
  const listing=await (await a.get('/api/sources')).json();
  expect(JSON.stringify(listing)).not.toContain(source.credential);expect(JSON.stringify(listing)).not.toContain('token_hash');
  expect((await b.patch('/api/sources/'+source.id,{headers:{origin:baseURL!},data:{enabled:false}})).status()).toBe(404);
  const event=signal(source.id,'http-event');
  expect((await a.post('/api/ingest/signals',{data:event})).status()).toBe(401);
  const headers={authorization:'Bearer '+source.credential};
  const accepted=await a.post('/api/ingest/signals',{headers,data:event});
  expect(accepted.status()).toBe(202);const ids=await accepted.json();
  const duplicate=await a.post('/api/ingest/signals',{headers,data:event});
  expect(duplicate.status()).toBe(200);expect((await duplicate.json()).signalId).toBe(ids.signalId);
  expect((await a.post('/api/ingest/signals',{headers,data:{...event,strategyVersion:'changed'}})).status()).toBe(409);
  expect((await a.post('/api/ingest/signals',{headers,data:{...event,sourceEventId:'spoof',ownerId:process.env.FIXTURE_B_ID}})).status()).toBe(400);
  expect((await a.post('/api/ingest/signals',{headers,data:{...event,sourceEventId:'invalid-version',schemaVersion:2}})).status()).toBe(400);
  expect((await a.post('/api/ingest/signals',{headers:{...headers,'content-type':'application/json'},data:'{'})).status()).toBe(400);
  expect((await a.post('/api/ingest/signals',{headers:{...headers,'content-type':'application/json'},data:'x'.repeat(65537)})).status()).toBe(413);
  expect((await a.get('/api/setups/'+ids.setupId)).status()).toBe(200);
  expect((await b.get('/api/setups/'+ids.setupId)).status()).toBe(404);
  const bSignals=await (await b.get('/api/signals')).json();expect(JSON.stringify(bSignals)).not.toContain(ids.signalId);
  await a.patch('/api/sources/'+source.id,{headers:{origin:baseURL!},data:{enabled:false}});
  expect((await a.post('/api/ingest/signals',{headers,data:{...event,sourceEventId:'disabled'}})).status()).toBe(401);
  await a.patch('/api/sources/'+source.id,{headers:{origin:baseURL!},data:{enabled:true}});
  const rotation=await a.post('/api/sources/'+source.id+'/credentials',{headers:{origin:baseURL!}});
  expect(rotation.status()).toBe(200);const replacement=await rotation.json();
  expect((await a.post('/api/ingest/signals',{headers,data:{...event,sourceEventId:'old-key'}})).status()).toBe(401);
  expect((await a.post('/api/ingest/signals',{headers:{authorization:'Bearer '+replacement.credential},data:{...event,sourceEventId:'rotated'}})).status()).toBe(202);
  expect((await a.delete('/api/sources/'+source.id+'/credentials',{headers:{origin:baseURL!}})).status()).toBe(200);
  expect((await a.post('/api/ingest/signals',{headers:{authorization:'Bearer '+replacement.credential},data:{...event,sourceEventId:'revoked'}})).status()).toBe(401);
 }finally{await a.dispose();await b.dispose();}
});
