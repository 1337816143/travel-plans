import {defineConfig,devices} from '@playwright/test';

export default defineConfig({
  testDir:'./tests',
  timeout:45_000,
  expect:{timeout:10_000},
  fullyParallel:false,
  retries:1,
  reporter:[['list'],['html',{outputFolder:'playwright-report',open:'never'}]],
  use:{
    baseURL:'http://127.0.0.1:4173',
    trace:'retain-on-failure',
    screenshot:'only-on-failure'
  },
  webServer:{
    command:'node scripts/build-v2.mjs && python3 -m http.server 4173 --bind 127.0.0.1',
    url:'http://127.0.0.1:4173/index.html',
    reuseExistingServer:false,
    timeout:60_000
  },
  projects:[
    {name:'desktop-chromium',use:{...devices['Desktop Chrome'],viewport:{width:1366,height:768}}},
    {name:'mobile-chromium',use:{...devices['Pixel 7'],viewport:{width:430,height:932}}}
  ]
});
