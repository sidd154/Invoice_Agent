const puppeteer = require('puppeteer');
(async () => {
  const browser = await puppeteer.launch({ args: ['--no-sandbox'] });
  const page = await browser.newPage();
  
  page.on('console', msg => console.log('PAGE LOG:', msg.text()));
  page.on('response', response => {
    if (response.status() >= 400) {
      console.log('HTTP ERROR:', response.status(), response.url());
    }
  });
  page.on('pageerror', error => {
    console.log('PAGE ERROR:', error.message);
  });

  await page.goto('http://localhost:3000', { waitUntil: 'networkidle0', timeout: 30000 });
  console.log('Page loaded completely');
  
  const content = await page.content();
  console.log(content.includes('Loading Workspace') ? 'STUCK IN LOADING' : 'LOADED FINE');
  
  await browser.close();
})().catch(err => {
  console.error(err);
  process.exit(1);
});
