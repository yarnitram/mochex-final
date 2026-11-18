import { test,expect } from '@playwright/test';
test('Q-01..08: discovery, live watchlist, account preferences, observed crossing and stale states',async({page,context,baseURL})=>{
 test.setTimeout(60000);
 const control=async(data:unknown)=>{const r=await context.request.post(process.env.TERMINAL_TEST_MARKET_ORIGIN!+'/control',{data});expect(r.ok()).toBeTruthy();};
 await control({prices:{'1000PEPE_USDT':99},age:0,fail:false});
 await page.goto('/login');await page.getByLabel('Email',{exact:true}).fill('alice@example.test');await page.getByLabel('Password',{exact:true}).fill(process.env.FIXTURE_A_PASSWORD!);await page.getByRole('button',{name:'Sign in',exact:true}).click();await expect(page).toHaveURL(/\/workbench$/);
 await page.getByRole('button',{name:'+ Add setup',exact:true}).click();
 const dialog=page.getByRole('dialog');await dialog.getByLabel('Symbol',{exact:true}).fill('1000');
 await dialog.getByRole('button',{name:'1000PEPE_USDT',exact:true}).click();
 for(const [label,value] of [['Entry price','100'],['Stop loss','98'],['Take profit','110'],['Trigger price (optional)','100'],['Trade thesis','Core2 browser fixture']] as const)await dialog.getByLabel(label,{exact:true}).fill(value);
 await dialog.getByLabel('Trigger direction',{exact:true}).selectOption('above');
 await dialog.getByRole('button',{name:'Save setup',exact:true}).click();await expect(dialog).toHaveCount(0);
 const row=page.getByRole('row').filter({hasText:'1000PEPE_USDT'});
 await page.getByRole('button',{name:'Refresh market',exact:true}).click();await expect(row.getByTestId('quote-1000PEPE_USDT')).toContainText('99');
 await page.getByText('Columns',{exact:true}).click();
 const change=page.getByRole('checkbox',{name:'24h change',exact:true});
 if(!await change.isChecked()){await change.check();await expect(change).toBeEnabled();}
 await expect(row).toContainText('+2.50%');
 await change.uncheck();await expect(change).toBeEnabled();await expect(page.getByRole('columnheader',{name:'24h change',exact:true})).toHaveCount(0);
 await page.reload();await page.getByText('Columns',{exact:true}).click();await expect(change).not.toBeChecked();
 await page.getByLabel('Sort watchlist').selectOption('price:desc');await expect(page.getByLabel('Sort watchlist')).toBeEnabled();
 await page.getByRole('button',{name:'Refresh market',exact:true}).click();await expect(page.getByRole('button',{name:'Refresh market',exact:true})).toBeEnabled();
 await control({prices:{'1000PEPE_USDT':101}});
 await expect.poll(async()=>{
  const r=await context.request.post('/api/core/monitor',{headers:{origin:baseURL!},data:{}});return (await r.json()).events?.some((e:any)=>e.data.symbol==='1000PEPE_USDT'&&e.kind==='trigger');
 },{timeout:15000,intervals:[1000]}).toBe(true);
 await page.getByRole('button',{name:'Refresh market',exact:true}).click();await expect(row).toContainText('Trigger crossed');
 await page.screenshot({path:'test-results/core2-watchlist-desktop.png',fullPage:true});
 await control({age:60000});
 await expect.poll(async()=>{
  const r=await context.request.post('/api/core/monitor',{headers:{origin:baseURL!},data:{}});return (await r.json()).quotes?.['1000PEPE_USDT']?.status;
 },{timeout:15000,intervals:[1000]}).toBe('stale');
 await page.getByRole('button',{name:'Refresh market',exact:true}).click();await expect(row.getByTestId('quote-1000PEPE_USDT')).toContainText('stale');
 await control({age:0,fail:true});
 await expect.poll(async()=>{const r=await context.request.post('/api/core/monitor',{headers:{origin:baseURL!},data:{}});return r.status();},{timeout:15000,intervals:[1000]}).toBe(503);
 await page.getByRole('button',{name:'Refresh market',exact:true}).click();await expect(page.getByText('Live quotes unavailable',{exact:true})).toBeVisible();
 await page.setViewportSize({width:390,height:844});await expect(page.locator('body')).toHaveJSProperty('scrollWidth',390);await page.screenshot({path:'test-results/core2-mobile.png',fullPage:true});
 const spoof=await context.request.post('/api/core/monitor',{headers:{origin:baseURL!},data:{quotes:{BTC_USDT:100}}});expect(spoof.status()).toBe(400);
 const wrong=await context.request.post('/api/core/monitor',{headers:{origin:'https://wrong.example.test'},data:{}});expect(wrong.status()).toBe(403);
 await control({age:0,fail:false});
});
