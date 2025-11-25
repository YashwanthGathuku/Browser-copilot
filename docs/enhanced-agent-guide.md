# 🚀 Enhanced Browser Agent - Usage Guide

## Quick Start

```typescript
import { createAgent } from "./enhanced-agent";
import { recorder } from "./action-recorder";

// Create an agent instance
const agent = createAgent();
```

---

## 📚 **API Examples**

### **1. Puppeteer-Style API** (Clean & Simple)

```typescript
// Navigate and interact
await agent.goto("https://example.com").then(async () => {
  await agent.$("#search").type("hello world");
  await agent.$('button[type="submit"]').click();
});

// Take screenshot
const screenshot = await agent.screenshot();

// Get page info
const title = await agent.getTitle();
const url = await agent.getUrl();
```

### **2. Cypress-Style API** (Command Queue & Retries)

```typescript
// Build a command chain
const chain = agent.chain();

chain
  .then(async () => await agent.goto("https://example.com"))
  .then(async () => await agent.$(".product").click())
  .then(async () => await agent.$("input").type("search query"))
  .then(async () => await agent.$("button").click(), {
    retry: true, // Auto-retry on failure
    screenshot: true, // Take screenshot after
  });

// Execute all commands
await chain.execute();

// Export as code
const code = chain.exportAsCode();
console.log(code);

// Time travel: replay from step 2
await chain.replayFrom(2);
```

### **3. Selenium-Style API** (Multi-Strategy Selectors)

```typescript
// Try multiple strategies with automatic fallback
const element = await agent.findElement({
  id: "submit-button",
  "data-testid": "submit",
  "data-cy": "submit-btn",
  "aria-label": "Submit form",
  css: "button.submit",
  text: "Submit", // Find by text content
  xpath: '//button[@type="submit"]',
});

// The agent will try each strategy in order until one works!
```

### **4. WebdriverIO-Style API** (Fluent & Chainable)

```typescript
// Fluent element interactions
await agent
  .$('input[name="email"]')
  .type("user@example.com")
  .waitUntil(async (el) => el.value.length > 0)
  .scrollIntoView();

await agent.$("button.submit").hover().click();

// Get element info
const text = await agent.$(".title").getText();
const isVisible = await agent.$(".modal").isVisible();
const href = await agent.$("a").getAttribute("href");

// Wait for conditions
await agent
  .$(".loading")
  .waitUntil(async (el) => !(await el.classList.contains("visible")));
```

---

## 🎥 **Recording & Replay**

### **Start Recording**

```typescript
// Start recording user actions
recorder.startRecording("My Test Flow");

// User interacts with the page...
// (clicks, types, navigates, etc.)

// Stop and save recording
const recording = recorder.stopRecording();
```

### **Replay Recording**

```typescript
// Get all recordings
const recordings = await ActionRecorder.getRecordings();

// Replay a recording
await ActionRecorder.replay(recordings[0], agent);
```

### **Export as Code**

```typescript
const recording = recordings[0];

// Export as Nano Agent code
const nanoCode = ActionRecorder.exportAsCode(recording);
console.log(nanoCode);
/* Output:
import { createAgent } from "./enhanced-agent";

async function replay() {
  const agent = createAgent();
  
  await agent.goto('https://example.com');
  await agent.$('#email').type('test@example.com');
  await agent.$('button').click();
}
*/

// Export as Cypress test
const cypressTest = ActionRecorder.exportAsCypressTest(recording);

// Export as Puppeteer script
const puppeteerScript = ActionRecorder.exportAsPuppeteerScript(recording);
```

---

## 💡 **Real-World Examples**

### **Example 1: E-commerce Product Purchase**

```typescript
const agent = createAgent();

// Navigate to product page
await agent.goto("https://shop.example.com/products/laptop");

// Wait for page load and find product
await agent.waitForSelector(".product-details", { visible: true });

// Add to cart using multi-strategy finder
await agent
  .findElement({
    "data-testid": "add-to-cart",
    "aria-label": "Add to cart",
    css: "button.add-cart",
  })
  .then((el) => el.click());

// Go to checkout
await agent.$(".cart-icon").click();
await agent.$(".checkout-button").click();

// Fill checkout form
await agent.$('input[name="email"]').type("customer@example.com");
await agent.$('input[name="address"]').type("123 Main St");
await agent.$('input[name="city"]').type("New York");

// Select shipping option
await agent.$('select[name="shipping"]').click();
await agent.executeInPage(`
  document.querySelector('select[name="shipping"]').value = 'express';
  document.querySelector('select[name="shipping"]').dispatchEvent(new Event('change'));
`);

// Submit order
await agent.$('button[type="submit"]').scrollIntoView().click();

// Wait for confirmation
await agent.waitForSelector(".order-confirmation", { timeout: 10000 });

// Take screenshot as proof
const screenshot = await agent.screenshot();
console.log("Order placed!", screenshot);
```

### **Example 2: Form Automation with Retries**

```typescript
const agent = createAgent();

// Use command chain for automatic retries
const chain = agent.chain();

chain
  .then(async () => await agent.goto("https://forms.example.com"))
  .then(
    async () => {
      // Fill form fields (with retry on failure)
      await agent.$("#name").type("John Doe");
      await agent.$("#email").type("john@example.com");
      await agent.$("#message").type("Hello, this is a test message!");
    },
    { retry: true, timeout: 5000 }
  )
  .then(async () => {
    // Wait for reCAPTCHA (if present)
    const hasCaptcha = await agent.$(".g-recaptcha").isVisible();
    if (hasCaptcha) {
      console.log("Please solve the captcha...");
      await agent.waitForSelector(".g-recaptcha-response", { timeout: 60000 });
    }
  })
  .then(
    async () => {
      // Submit form
      await agent.$('button[type="submit"]').click();
    },
    { retry: true, screenshot: true }
  );

// Execute with automatic retries
await chain.execute();

// If something failed, replay from a specific step
// await chain.replayFrom(2);
```

### **Example 3: Data Scraping**

```typescript
const agent = createAgent();

await agent.goto("https://news.example.com");

// Wait for articles to load
await agent.waitForSelector(".article-list");

// Get all article elements
const articles = await agent.$$(".article-item");

const scrapedData = [];

for (const article of articles) {
  const title = await article.$(".title").getText();
  const author = await article.$(".author").getText();
  const date = await article.$(".date").getText();
  const link = await article.$("a").getAttribute("href");

  scrapedData.push({ title, author, date, link });
}

console.log("Scraped articles:", scrapedData);
```

### **Example 4: Visual Reasoning**

```typescript
const agent = createAgent();

await agent.goto("https://example.com/dashboard");

// Find element by visual description (using Chrome AI!)
const loginButton = await agent.findByDescription(
  "blue button that says login"
);

if (loginButton) {
  await agent.$(loginButton).click();
}

// Take screenshot for analysis
const screenshot = await agent.screenshot({ fullPage: true });
```

### **Example 5: Multi-Tab Workflow**

```typescript
// Tab 1: Research
const tab1Agent = createAgent();
await tab1Agent.goto("https://wikipedia.org");
await tab1Agent.$("#searchInput").type("Artificial Intelligence");
await tab1Agent.$('button[type="submit"]').click();

// Tab 2: Take notes
const tab2 = await chrome.tabs.create({ url: "https://notes.example.com" });
const tab2Agent = createAgent(tab2.id);
await tab2Agent.waitForLoad();
await tab2Agent.$("textarea").type("Notes on AI from Wikipedia...");

// Switch back to tab 1
await chrome.tabs.update(tab1Agent.tabId!, { active: true });

// Continue research
const summary = await tab1Agent.$(".summary").getText();
console.log("Summary:", summary);
```

---

## 🎯 **Advanced Features**

### **Smart Waiting**

```typescript
// Wait for selector with options
await agent.waitForSelector(".modal", {
  timeout: 5000,
  visible: true, // Wait until visible
  enabled: true, // Wait until enabled
});

// Wait for navigation
await agent.waitForNavigation({ timeout: 30000 });

// Custom wait condition
await agent.$(".button").waitUntil(
  async (el) => {
    const classes = await el.classList;
    return !classes.contains("disabled");
  },
  { timeout: 10000 }
);
```

### **Error Handling**

```typescript
try {
  await agent.$(".non-existent").click();
} catch (error) {
  console.error("Element not found, using fallback...");

  // Try alternative selector
  await agent.findElement({
    id: "submit",
    css: "button.submit",
    text: "Submit",
  });
}
```

### **Page Navigation Helpers**

```typescript
// Go back/forward
await agent.goBack();
await agent.goForward();

// Reload page
await agent.reload({ ignoreCache: true });

// Wait before next action
await agent.wait(1000);
```

---

## 📊 **Comparison: Before vs After**

### **Before (Old API)**

```typescript
// Clunky, manual retry logic
let attempts = 0;
while (attempts < 3) {
  try {
    await chrome.tabs.update(tabId, { url: "https://example.com" });
    await waitForLoad();

    await chrome.scripting.executeScript({
      target: { tabId },
      func: () => {
        document.querySelector("#email").value = "test@example.com";
        document.querySelector("button").click();
      },
    });
    break;
  } catch (error) {
    attempts++;
    if (attempts >= 3) throw error;
  }
}
```

### **After (Enhanced API)**

```typescript
// Clean, automated retries, chainable
await agent.goto("https://example.com").then(
  async () => {
    await agent.$("#email").type("test@example.com");
    await agent.$("button").click();
  },
  { retry: true }
);
```

---

## 🎉 **Summary**

The Enhanced Browser Agent gives you:

✅ **Cleaner API** (like Puppeteer)
✅ **Automatic Retries** (like Cypress)
✅ **Smart Selectors** (like Selenium)
✅ **Fluent Chaining** (like WebdriverIO)
✅ **Recording & Replay** (unique to us!)
✅ **Code Generation** (export to any format)
✅ **Visual Reasoning** (Chrome AI integration)
✅ **Chrome Extension Superpowers** (more than any of them!)

**You now have a browser automation system MORE POWERFUL than Puppeteer, Cypress, Selenium, and WebdriverIO combined!** 🚀
