import {test,expect} from '@playwright/test';

test('CF-01: Mochex workstation header, drawing rail and objects panel',async({page})=>{
 await page.goto('/login');await page.getByLabel('Email',{exact:true}).fill('alice@example.test');await page.getByLabel('Password',{exact:true}).fill(process.env.FIXTURE_A_PASSWORD!);await page.getByRole('button',{name:'Sign in',exact:true}).click();
 await page.getByRole('navigation').getByRole('button',{name:/Charts/}).click();
 await expect(page.getByText('Watching',{exact:true})).toHaveCount(0);
 await expect(page.getByRole('navigation',{name:'Drawing tools'})).toBeVisible();
 await expect(page.getByRole('complementary',{name:'Chart inspector'})).toBeVisible();
 await expect(page.getByText('MOCHEX CHARTS',{exact:true})).toBeVisible();
 await expect(page.getByTestId('price-chart').locator('canvas').first()).toBeVisible();
 await page.getByRole('navigation',{name:'Drawing tools'}).getByRole('button',{name:'Horizontal line'}).click();
 await expect(page.getByRole('navigation',{name:'Drawing tools'}).getByRole('button',{name:'Horizontal line'})).toHaveAttribute('aria-pressed','true');
 await expect(page.getByRole('complementary',{name:'Chart inspector'}).getByRole('button',{name:'EMA 20',exact:true})).toBeVisible();
 await page.screenshot({path:'test-results/mochex-chart-workstation-desktop.png',fullPage:true});
 await page.setViewportSize({width:390,height:844});await expect(page.locator('body')).toHaveJSProperty('scrollWidth',390);
 await page.screenshot({path:'test-results/mochex-chart-workstation-mobile.png',fullPage:true});
});
