const playwright = require('playwright');
const path = require('path');
const fs = require('fs');

async function captureScreenshots() {
  const browser = await playwright.chromium.launch({ 
    headless: false,
    args: ['--start-maximized']
  });
  
  const context = await browser.newContext({
    viewport: { width: 1920, height: 1080 }
  });
  
  const page = await context.newPage();
  
  const screenshotDir = path.join(__dirname, 'screenshots');
  if (!fs.existsSync(screenshotDir)) {
    fs.mkdirSync(screenshotDir, { recursive: true });
  }

  console.log('Navigating to http://localhost:5173/...');
  await page.goto('http://localhost:5173/', { waitUntil: 'networkidle' });
  
  // Wait a bit for any animations to complete
  await page.waitForTimeout(2000);
  
  console.log('Capturing screenshot 1: Main view...');
  await page.screenshot({ 
    path: path.join(screenshotDir, 'screenshot-main.png'),
    fullPage: false
  });

  // Try to find and interact with various UI elements
  console.log('Looking for interactive elements...');
  
  // Try to find split pane buttons or tab controls
  const splitButtons = await page.locator('button, [role="button"]').all();
  console.log(`Found ${splitButtons.length} interactive elements`);

  // Try right-click context menu
  console.log('Capturing screenshot 2: Context menu...');
  await page.mouse.click(960, 540, { button: 'right' });
  await page.waitForTimeout(500);
  await page.screenshot({ 
    path: path.join(screenshotDir, 'screenshot-context-menu.png'),
    fullPage: false
  });
  
  // Click away to close context menu
  await page.mouse.click(100, 100);
  await page.waitForTimeout(500);

  // Try to find and click a split pane button
  const splitPaneSelectors = [
    'button:has-text("Split")',
    '[title*="split"]',
    '[aria-label*="split"]',
    'button:has-text("+")',
    'button:has-text("New")'
  ];

  for (const selector of splitPaneSelectors) {
    try {
      const element = await page.locator(selector).first();
      if (await element.isVisible()) {
        console.log(`Found element with selector: ${selector}`);
        await element.click();
        await page.waitForTimeout(1000);
        console.log('Capturing screenshot 3: Split pane view...');
        await page.screenshot({ 
          path: path.join(screenshotDir, 'screenshot-split-pane.png'),
          fullPage: false
        });
        break;
      }
    } catch (e) {
      // Selector not found, continue
    }
  }

  // Try to type some commands
  console.log('Typing sample commands...');
  await page.keyboard.type('ls -la');
  await page.waitForTimeout(500);
  console.log('Capturing screenshot 4: Terminal with command...');
  await page.screenshot({ 
    path: path.join(screenshotDir, 'screenshot-command.png'),
    fullPage: false
  });

  await page.keyboard.press('Enter');
  await page.waitForTimeout(2000);
  
  console.log('Capturing screenshot 5: Terminal with output...');
  await page.screenshot({ 
    path: path.join(screenshotDir, 'screenshot-output.png'),
    fullPage: false
  });

  // Try to find settings or menu button
  const menuSelectors = [
    'button:has-text("Settings")',
    'button:has-text("Menu")',
    '[title*="settings"]',
    '[aria-label*="menu"]',
    'button[class*="menu"]'
  ];

  for (const selector of menuSelectors) {
    try {
      const element = await page.locator(selector).first();
      if (await element.isVisible()) {
        console.log(`Found menu element with selector: ${selector}`);
        await element.click();
        await page.waitForTimeout(1000);
        console.log('Capturing screenshot 6: Settings/Menu...');
        await page.screenshot({ 
          path: path.join(screenshotDir, 'screenshot-menu.png'),
          fullPage: false
        });
        break;
      }
    } catch (e) {
      // Selector not found, continue
    }
  }

  console.log('Screenshot capture complete!');
  console.log(`Screenshots saved to: ${screenshotDir}`);
  
  await browser.close();
}

captureScreenshots().catch(console.error);
