// Preloaded by the disposable browser verifier, never by normal app startup.
const original=globalThis.fetch;
globalThis.fetch=function(input,init){
 const url=typeof input==='string'?input:input instanceof URL?input.href:input?.url;
 if(process.env.TERMINAL_TEST_MARKET_ORIGIN&&/^https:\/\/contract\.mexc\.com\/api\/v1\/contract\/(detail|ticker)$/.test(url)){
  return original(process.env.TERMINAL_TEST_MARKET_ORIGIN+'/'+url.split('/').at(-1),init);
 }
 return original(input,init);
};
