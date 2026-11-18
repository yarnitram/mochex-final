// Synthetic public-market fixture. Started only by verify-workspace.ts.
const http=require('node:http');
const symbols=['BTC_USDT','ETH_USDT','1000PEPE_USDT','QTEST_USDT','FAULT_USDT'];
let state={prices:{},age:0,fail:false};
const server=http.createServer(async(req,res)=>{
 res.setHeader('content-type','application/json');
 if(req.url==='/control'&&req.method==='POST'){
  let text='';for await(const chunk of req){text+=chunk;if(text.length>4096){res.writeHead(413);return res.end('{}');}}
  try{const data=JSON.parse(text);state={prices:{...state.prices,...data.prices},age:data.age??state.age,fail:data.fail??state.fail};return res.end('{"ok":true}');}catch{res.writeHead(400);return res.end('{}');}
 }
 if(req.url==='/detail')return res.end(JSON.stringify({success:true,data:symbols.map(symbol=>({symbol,baseCoin:symbol.slice(0,-5),quoteCoin:'USDT',settleCoin:'USDT',state:0,isHidden:false,futureType:1}))}));
 if(req.url==='/ticker'){
  if(state.fail){res.writeHead(503);return res.end('{"success":false}');}
  return res.end(JSON.stringify({success:true,data:symbols.map(symbol=>({symbol,lastPrice:state.prices[symbol]??99,riseFallRate:.025,amount24:25000000,timestamp:Date.now()-state.age}))}));
 }
 res.writeHead(404);res.end('{}');
});
server.listen(0,'127.0.0.1',()=>console.log('http://127.0.0.1:'+server.address().port));
process.on('SIGTERM',()=>server.close(()=>process.exit(0)));
