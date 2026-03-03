from playwright.sync_api import sync_playwright
import sys

def check_article_detail():
    with sync_playwright() as p:
        browser = p.chromium.launch()
        page = browser.new_page()
        
        # Navigate to article detail page
        print("Checking article detail page...")
        page.goto("http://localhost:5175/article/react-hooks-deep-dive")
        page.wait_for_timeout(2000)
        
        # Take screenshot
        page.screenshot(path="article-detail-check.png", full_page=True)
        
        # Check 1: Is page blank or showing loading?
        body_text = page.locator("body").inner_text()
        is_loading = "文章加载中..." in body_text
        is_blank = len(body_text.strip()) < 100
        
        # Check 2: Check for code blocks with macOS-style dots
        code_blocks = page.locator("pre").count()
        macos_dots = page.locator(".code-block-header").count()
        
        # Check 3: Check for TOC sidebar
        toc_visible = page.locator("text=目录").is_visible()
        
        # Check 4: Console errors
        console_errors = []
        page.on("console", lambda msg: console_errors.append(msg.text) if msg.type == "error" else None)
        page.reload()
        page.wait_for_timeout(1000)
        
        print("\n=== Article Detail Page Results ===")
        print(f"1. Page renders correctly: {not is_blank and not is_loading}")
        print(f"   - Is blank: {is_blank}")
        print(f"   - Shows loading: {is_loading}")
        print(f"2. Code blocks found: {code_blocks}")
        print(f"   - macOS-style headers: {macos_dots}")
        print(f"3. TOC sidebar visible: {toc_visible}")
        print(f"4. Console errors: {len(console_errors)}")
        if console_errors:
            for err in console_errors[:5]:
                print(f"   - {err}")
        
        # Check articles list page
        print("\n\nChecking articles list page...")
        page.goto("http://localhost:5175/articles")
        page.wait_for_timeout(2000)
        page.screenshot(path="articles-list-check.png", full_page=True)
        
        # Count article cards
        article_cards = page.locator(".article-card, [class*='article']").count()
        article_titles = page.locator("h2, h3").count()
        
        print("\n=== Articles List Page Results ===")
        print(f"Article elements found: {article_cards}")
        print(f"Title elements found: {article_titles}")
        
        browser.close()

if __name__ == "__main__":
    check_article_detail()
