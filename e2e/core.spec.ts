import { test,expect } from '@playwright/test';
test('C-01..09: core watchlist/trade/journal flow and Mochex chart',async({page,context,baseURL})=>{
 await page.route('**/api/core/candles?**',async route=>{
  const u=new URL(route.request().url()),duration=({'1m':60,'5m':300,'15m':900,'1h':3600,'4h':14400,'1d':86400} as Record<string,number>)[u.searchParams.get('timeframe')??'15m']!,now=Math.floor(Date.now()/1000/duration)*duration;
  const candles=Array.from({length:300},(_,i)=>{const c=100+Math.sin(i/8)*2;return {time:now-(299-i)*duration,open:c+Math.sin(i)*.4,high:c+1,low:c-1,close:c,volume:100+i};});
  await route.fulfill({json:{exchange:'mexc',market:'perpetual',symbol:u.searchParams.get('symbol'),timeframe:u.searchParams.get('timeframe'),updatedAt:new Date().toISOString(),candles}});
 });
 await page.goto('/workbench');await expect(page).toHaveURL(/\/login$/);
 await page.getByLabel('Email').fill('alice@example.test');await page.getByLabel('Password').fill(process.env.FIXTURE_A_PASSWORD!);
 await page.getByRole('button',{name:'Sign in',exact:true}).click();await expect(page).toHaveURL(/\/workbench$/);
 for(const name of ['Watchlist','Trades','Journal','Charts'])await expect(page.getByRole('navigation',{name:'Trading workspace'}).getByRole('button',{name:new RegExp(name)})).toBeVisible();
 await page.getByRole('button',{name:'+ Add setup',exact:true}).click();
 const dialog=page.getByRole('dialog');
 for(const [name,value] of [['Symbol','ETH_USDT'],['Entry price','100'],['Stop loss','98'],['Take profit','110'],['Trigger price (optional)','100'],['Strategy (optional)','Browser pullback'],['Trade thesis','Synthetic browser workflow']] as const){
  await dialog.getByLabel(name,{exact:true}).fill(value);
 }
 await dialog.getByRole('button',{name:'Save setup',exact:true}).click();await expect(dialog).toHaveCount(0);
 await expect(page.getByRole('row').filter({hasText:'ETH_USDT'})).toContainText('Browser pullback');
 await page.screenshot({path:'test-results/core-watchlist-desktop.png',fullPage:true});
 await page.getByRole('button',{name:'Chart ETH_USDT',exact:true}).click();
 await expect(page.getByTestId('price-chart').locator('canvas').first()).toBeVisible();
 await expect(page.getByText('MEXC · USDT PERPETUAL',{exact:true})).toBeVisible();
 await page.getByLabel('Chart timeframe').selectOption('1h');
 await expect(page.getByTestId('price-chart').locator('canvas').first()).toBeVisible();
 await page.screenshot({path:'test-results/core-chart-desktop.png',fullPage:true});
 await page.getByRole('navigation').getByRole('button',{name:/Watchlist/}).click();
 await page.getByRole('button',{name:'Record trade ETH_USDT',exact:true}).click();
 await dialog.getByLabel('Margin (USDT)',{exact:true}).fill('100');
 await dialog.getByLabel('Leverage',{exact:true}).fill('10');
 await dialog.getByLabel('Entry fee (USDT)',{exact:true}).fill('1');
 await dialog.getByRole('button',{name:'Record trade',exact:true}).click();await expect(dialog).toHaveCount(0);
 for(const price of ['106','100']){
  await page.getByRole('button',{name:'Record exit ETH_USDT',exact:true}).click();
  await dialog.getByLabel('Exit quantity (base units)',{exact:true}).fill('5');
  await dialog.getByLabel('Exit price',{exact:true}).fill(price);
  await dialog.getByLabel('Exit fee (USDT)',{exact:true}).fill('0.5');
  await dialog.getByRole('button',{name:'Save exit',exact:true}).click();await expect(dialog).toHaveCount(0);
 }
 await page.getByRole('navigation').getByRole('button',{name:/Journal/}).click();
 await expect(page.getByRole('row').filter({hasText:'ETH_USDT'})).toContainText('+28.00');
 await page.getByRole('button',{name:'Review ETH_USDT',exact:true}).click();
 await expect(dialog).toContainText('Exit 5 @ 106');await expect(dialog).toContainText('Exit 5 @ 100');
 await dialog.getByLabel('Post-trade review').fill('Followed the plan, kept the partial exits.');
 await dialog.getByRole('button',{name:'Save review',exact:true}).click();await expect(dialog).toHaveCount(0);
 await page.getByRole('button',{name:'Review ETH_USDT',exact:true}).click();
 await expect(dialog.getByLabel('Post-trade review')).toHaveValue('Followed the plan, kept the partial exits.');
 await dialog.getByRole('button',{name:'Close dialog'}).click();
 await page.screenshot({path:'test-results/core-journal-desktop.png',fullPage:true});
 await page.setViewportSize({width:390,height:844});await expect(page.locator('body')).toHaveJSProperty('scrollWidth',390);
 await page.screenshot({path:'test-results/core-mobile.png',fullPage:true});
 const forbidden=await context.request.post('/api/core/workspace',{headers:{origin:'https://wrong.example.test'},data:{action:'watch-create',data:{}}});
 expect(forbidden.status()).toBe(403);
 const malformed=await context.request.post('/api/core/workspace',{headers:{origin:baseURL!},data:{action:'watch-create',ownerId:process.env.FIXTURE_B_ID,data:{}}});
 expect(malformed.status()).toBe(400);
});
