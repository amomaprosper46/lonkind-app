import { chromium } from 'playwright';

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage();
  
  page.on('console', msg => {
      if (msg.type() === 'error') {
          console.log('BROWSER ERROR CONSOLE:', msg.text());
      } else {
          console.log('BROWSER LOG:', msg.text());
      }
  });
  
  page.on('pageerror', error => {
      console.log('BROWSER PAGE EXCEPTION:', error.message);
  });

  console.log('Navigating to http://localhost:3000 ...');
  await page.goto('http://localhost:3000', { waitUntil: 'networkidle' });
  
  // Wait a bit to ensure client-side hydration happens
  await page.waitForTimeout(5000);
  
  console.log('Done.');
  await browser.close();
})();
