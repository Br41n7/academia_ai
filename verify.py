from playwright.sync_api import sync_playwright
import os

def run():
    os.makedirs('/app/screenshots', exist_ok=True)
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        page = browser.new_page()

        print("Navigating to http://localhost:3000...")
        page.goto("http://localhost:3000")
        page.wait_for_selector("text=Academic AI", timeout=10000)

        # Fill custom sign-in form
        print("Submitting login form...")
        page.fill("input[type='email']", "researcher@example.com")
        page.fill("input[type='text']", "Dr. Scholar")
        page.click("button[type='submit']")

        # Wait for My Projects screen header
        print("Waiting for My Projects screen...")
        page.wait_for_selector("text=My Projects", timeout=10000)

        # Check if project exists or create one
        if not page.is_visible("h3:has-text('Medical Neural Networks')"):
            print("Clicking New Project...")
            page.click("button:has-text('New Project')")
            page.fill("input[placeholder*='Quantum Physics']", "Medical Neural Networks")
            page.fill("textarea", "Research into brain image segmentation using deep learning.")
            page.click("button[type='submit']:has-text('Create Project')")
            page.click("button:has-text('Cancel')")
            page.wait_for_timeout(1000)

        # Select the project
        print("Selecting project...")
        if page.is_visible("h3:has-text('Medical Neural Networks')"):
            page.click("h3:has-text('Medical Neural Networks')")
        else:
            page.click("button.group")

        # Wait for main project layout dashboard
        print("Waiting for main layout...")
        page.wait_for_selector("text=Overview", timeout=10000)

        # Click Settings icon button in header
        print("Navigating to Settings view...")
        page.click("button[aria-label='Settings']")

        # Wait for Settings view heading
        page.wait_for_selector("h2:has-text('Settings')", timeout=10000)

        page.screenshot(path="/app/screenshots/verification.png")
        print("Screenshot successfully saved to /app/screenshots/verification.png")

        browser.close()

if __name__ == "__main__":
    run()
