import { defineConfig } from '@playwright/test';
export default defineConfig({
 testDir:'./e2e',workers:1,retries:0,timeout:30000,
 use:{baseURL:process.env.APP_ORIGIN,headless:true,viewport:{width:1440,height:1000}},
 reporter:'list',
});
