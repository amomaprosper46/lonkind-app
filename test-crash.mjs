import { chromium } from 'playwright';

(async () => {
  // Launch browser with explicit flags to prevent headless sandbox collisions
  const browser = await chromium.launch({
    args: ['--disable-dev-shm-usage', '--no-sandbox']
  });
  
  const page = await browser.newPage();
  
  // Track if any severe errors occurred during the session lifecycle
  let hasCrashed = false;
  
  // 1. Capture standard browser window console messages
  page.on('console', msg => {
    const type = msg.type();
    const text = msg.text();
    
    if (type === 'error') {
      console.error(`❌ BROWSER ERROR CONSOLE: ${text}`);
      // Optional: Treat severe console errors as hydration/runtime failures
      if (text.includes('Hydration') || text.includes('Minified React error')) {
        hasCrashed = true;
      }
    } else if (type === 'warning') {
      console.warn(`⚠️ BROWSER WARN CONSOLE: ${text}`);
    } else {
      console.log(`💬 BROWSER LOG: ${text}`);
    }
  });
  
  // 2. FIXED: Capture uncaught exceptions WITH full stack traces
  page.on('pageerror', error => {
    console.error('💥 BROWSER PAGE EXCEPTION CRASHED:');
    console.error(error.stack || error.message); // Prioritizes the stack trace trace tree
    hasCrashed = true;
  });

  // 3. Capture hard browser frame crashes (e.g., out of memory errors)
  page.on('crash', () => {
    console.error('💀 BROWSER PROCESS CRASHED ENTIRELY.');
    hasCrashed = true;
  });

  try {
    console.log('🚀 Navigating to http://localhost:3000 ...');
    
    // FIXED: Changed to 'commit' or 'domcontentloaded' to make navigation resilient,
    // then manually controlled targeted content state waits.
    await page.goto('http://localhost:3000', { waitUntil: 'domcontentloaded' });
    
    console.log('⏳ Waiting for hydration window indicators...');
    
    // Better alternative to raw waitForTimeout: Wait for a core layout wrapper or element to mount
    // await page.waitForSelector('#root', { state: 'attached', timeout: 10000 });
    
    // Safe-buffer fallback for client-side evaluation activity
    await page.waitForTimeout(3000);
    
  } catch (navigationError) {
    console.error('🚨 NAVIGATION ROUTE TIMEOUT FAILURE:', navigationError.message);
    hasCrashed = true;
  } finally {
    console.log('🏁 Diagnostic run completed. Cleaning up connections...');
    await browser.close();
    
    // Enforce clean exit codes so CI/CD deployment pipelines know if compilation tests failed
    if (hasCrashed) {
      console.error('❌ Check logs above. Critical errors were detected during page validation runs.');
      process.exit(1);
    } else {
      console.log('✅ Page run successfully completed with zero runtime exceptions!');
      process.exit(0);
    }
  }
})();