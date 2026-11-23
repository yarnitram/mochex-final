import {test,expect} from '@playwright/test';

test('G-03: Mochex grid keeps pane contexts and guards unsaved drafts',async({page,context})=>{
 await context.route('**/api/core/candles?**',async route=>{
  const u=new URL(route.request().url()),duration=900,now=Math.floor(Date.now()/1000/duration)*duration;
  await route.fulfill({json:{exchange:'mexc',market:'perpetual',symbol:u.searchParams.get('symbol'),timeframe:u.searchParams.get('timeframe'),updatedAt:new Date().toISOString(),stale:false,candles:Array.from({length:60},(_,i)=>({time:now-(59-i)*duration,open:100,high:101,low:99,close:100,volume:10}))}});
 });
 await page.goto('/login');await page.getByLabel('Email',{exact:true}).fill('alice@example.test');await page.getByLabel('Password',{exact:true}).fill(process.env.FIXTURE_A_PASSWORD!);await page.getByRole('button',{name:'Sign in',exact:true}).click();
 await page.getByRole('navigation').getByRole('button',{name:/Charts/}).click();
 await page.getByRole('button',{name:'Chart layout 2x2'}).click();
 await expect(page.getByTestId('price-chart')).toHaveCount(4);
 await page.getByRole('button',{name:/Pane 2 · ETH_USDT/}).click();
 await expect(page.getByLabel('Chart symbol',{exact:true})).toHaveValue('ETH_USDT');
 await page.getByLabel('Chart symbol',{exact:true}).fill('XRP_USDT');await page.getByRole('button',{name:'Load chart'}).click();
 await expect(page.getByRole('button',{name:/Pane 2 · XRP_USDT/})).toBeVisible();
 await expect(page.getByRole('button',{name:/Pane 1 · BTC_USDT/})).toBeVisible();
 await page.getByRole('button',{name:'Sync symbols'}).click();
 await expect(page.getByRole('button',{name:/Pane 1 · XRP_USDT/})).toBeVisible();
 await page.getByRole('button',{name:'Chart layout 1x1'}).click();await expect(page.getByTestId('price-chart')).toHaveCount(1);
 await page.getByRole('button',{name:'RSI 14'}).click();
 page.once('dialog',d=>d.dismiss());await page.getByLabel('Chart symbol',{exact:true}).fill('SOL_USDT');await page.getByRole('button',{name:'Load chart'}).click();
 await expect(page.getByRole('button',{name:/Pane 1 · XRP_USDT/})).toBeVisible();
 await page.getByRole('button',{name:'Save layout'}).click();await expect(page.getByText(/Saved layout · revision/)).toBeVisible();
 await page.getByRole('button',{name:'Load chart'}).click();await expect(page.getByRole('button',{name:/Pane 1 · SOL_USDT/})).toBeVisible();
});
