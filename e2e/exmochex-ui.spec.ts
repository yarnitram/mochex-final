import {test,expect} from '@playwright/test';

test('UX-02: EXMOCHEX navigation, table controls, and modal keyboard flow',async({page})=>{
 await page.goto('/login');await page.getByLabel('Email',{exact:true}).fill('alice@example.test');await page.getByLabel('Password',{exact:true}).fill(process.env.FIXTURE_A_PASSWORD!);await page.getByRole('button',{name:'Sign in',exact:true}).click();
 const nav=page.getByRole('navigation',{name:'Trading workspace'});
 await expect(nav.getByRole('button',{name:/Watchlist/})).toHaveAttribute('aria-current','page');
 await expect(page.locator('.core-sidebar')).toHaveCSS('position','sticky');
 await page.getByRole('button',{name:'+ Add setup'}).click();
 const dialog=page.getByRole('dialog');await expect(dialog).toBeVisible();
 await page.screenshot({path:'test-results/exmochex-modal-desktop.png',fullPage:true});
 await expect(dialog.locator('input').first()).toBeFocused();
 await page.keyboard.press('Escape');await expect(dialog).toHaveCount(0);
 await expect(page.getByRole('button',{name:'+ Add setup'})).toBeFocused();
 await page.getByRole('button',{name:'+ Add setup'}).click();
 await dialog.getByLabel('Symbol',{exact:true}).fill('ETH_USDT');
 await dialog.getByLabel('Entry price').fill('100');await dialog.getByLabel('Stop loss').fill('90');await dialog.getByLabel('Take profit').fill('120');
 await dialog.getByRole('button',{name:'Save setup'}).click();
 await expect(page.getByLabel('Rows per page')).toHaveValue('20');
 await page.getByLabel('Rows per page').selectOption('all');
 await expect(page.locator('.core-pagination')).toContainText('Showing all');
 await page.getByRole('navigation').getByRole('button',{name:/Trades/}).click();
 await expect(page.getByRole('navigation').getByRole('button',{name:/Trades/})).toHaveAttribute('aria-current','page');
 await page.setViewportSize({width:390,height:844});await expect(page.locator('body')).toHaveJSProperty('scrollWidth',390);
});
