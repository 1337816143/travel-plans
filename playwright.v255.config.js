import {defineConfig,devices} from '@playwright/test';

export default defineConfig({
  testDir:'./tests-v255',
  timeout:30000,
  expect:{timeout:8000},
  retries:1,
  workers:2,
  reporter:[['line'],['html',{outputFolder:'playwright-report-v255',open:'never'}]],
  use:{baseURL:'http://127.0.0.1:4175',trace:'retain-on-failure',screenshot:'only-on-failure'},
  webServer:{command:'python3 -m http.server 4175 --bind 127.0.0.1',url:'http://127.0.0.1:4175/index.html',reuseExistingServer:false},
  projects:[
    {name:'desktop-chromium',use:{...devices['Desktop Chrome'],viewport:{width:1440,height:900}}},
    {name:'mobile-chromium',use:{...devices['Pixel 7'],viewport:{width:430,height:932}}},
    {name:'mobile-webkit',use:{...devices['iPhone 15 Pro Max'],viewport:{width:430,height:932}}}
  ]
});
