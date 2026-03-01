from playwright.sync_api import sync_playwright
import time

def take_screenshots():
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=False)
        page = browser.new_page()
        
        pages = [
            ("http://localhost:5173/", "homepage.png"),
            ("http://localhost:5173/articles", "articles.png"),
            ("http://localhost:5173/about", "about.png"),
            ("http://localhost:5173/projects", "projects.png")
        ]
        
        for url, filename in pages:
            print(f"Navigating to {url}...")
            page.goto(url, wait_until="networkidle")
            time.sleep(1)  # Extra wait for any animations
            page.screenshot(path=filename, full_page=True)
            print(f"Screenshot saved to {filename}")
        
        browser.close()

if __name__ == "__main__":
    take_screenshots()
