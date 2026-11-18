import { z } from 'zod';
import { database } from '../src/server/store.js';
import { sampleOwner } from '../src/core/monitor.js';
import { marketSnapshot } from '../src/core/market-provider.js';
const owner=z.uuid().parse(process.env.TERMINAL_MONITOR_OWNER_ID),db=database();
let stopping=false;process.on('SIGINT',()=>{stopping=true;});process.on('SIGTERM',()=>{stopping=true;});
try{
 do{
  const start=Date.now();
  try{const result=await sampleOwner(db,owner,await marketSnapshot());console.log(JSON.stringify(result));}
  catch(e){
   await sampleOwner(db,owner,{instruments:[],quotes:{}});
   console.error('Market sampling unavailable; continuity reset.');
   if(process.argv.includes('--once'))throw e;
  }
  if(process.argv.includes('--once'))break;
  while(!stopping&&Date.now()-start<10000)await new Promise(r=>setTimeout(r,250));
 }while(!stopping);
}finally{await db.end();}
