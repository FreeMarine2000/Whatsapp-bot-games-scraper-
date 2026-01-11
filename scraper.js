const puppeteer = require('puppeteer');

async function getEpicDeals() {
    console.log("🕵️‍♀️ Launching browser to hunt for deals...");
    
    // Launch browser (Visible for debugging)
    const browser = await puppeteer.launch({
        headless: "new", // Change to false if you want to watch it work
        args: ['--no-sandbox', '--disable-setuid-sandbox']
    });

    try {
        const page = await browser.newPage();
        
        // --- PART 1: GET FREE GAMES (Active & Upcoming) ---
        console.log("🎁 Checking Free Games...");
        await page.goto('https://store-site-backend-static.ak.epicgames.com/freeGamesPromotions', { waitUntil: 'networkidle0' });
        
        const freeGamesData = await page.evaluate(() => JSON.parse(document.body.innerText));
        const games = freeGamesData.data.Catalog.searchStore.elements;
        
        let report = "🔥 *EPIC GAMES REPORT* 🔥\n\n";
        
        // A. Active Now
        report += "*🎁 FREE RIGHT NOW:*\n";
        let activeCount = 0;
        for (const game of games) {
            const promo = game.promotions?.promotionalOffers?.[0]?.promotionalOffers?.[0];
            if (promo) {
                activeCount++;
                report += `• *${game.title}*\n  (Ends: ${new Date(promo.endDate).toLocaleDateString()})\n  🔗 https://store.epicgames.com/p/${game.urlSlug}\n\n`;
            }
        }
        if (activeCount === 0) report += "(No active free games right now)\n\n";

        // B. Coming Soon
        report += "*🔜 COMING SOON:*\n";
        let upcomingCount = 0;
        for (const game of games) {
            const upcoming = game.promotions?.upcomingPromotionalOffers?.[0]?.promotionalOffers?.[0];
            if (upcoming) {
                upcomingCount++;
                report += `• ${game.title} (Free on ${new Date(upcoming.startDate).toLocaleDateString()})\n`;
            }
        }
        if (upcomingCount === 0) report += "(No upcoming games found)\n";

        // --- PART 2: GET TOP DISCOUNTS ---
        console.log("📉 Checking Discounts (This might take a moment)...");
        report += "\n--------------------\n*📉 TOP DISCOUNTS:*\n";

        // Go to the browse page and wait longer
        await page.goto('https://store.epicgames.com/en-US/browse?sortBy=releaseDate&sortDir=desc&priceTier=tierDiscounts&count=40', { waitUntil: 'domcontentloaded' });
        
        // Wait specifically for the price badges to appear (up to 10 seconds)
        try {
            await page.waitForSelector('div[class*="css-"]', { timeout: 10000 });
            // scroll down slightly to trigger lazy loading
            await page.evaluate(() => window.scrollBy(0, 500));
            await new Promise(r => setTimeout(r, 2000)); // Hard wait for 2 seconds
        } catch(e) {
            console.log("Timeout waiting for discounts to load.");
        }

        const discounts = await page.evaluate(() => {
            // Find all elements that look like game cards
            const cards = Array.from(document.querySelectorAll('a[role="link"]'));
            const results = [];
            
            for (const card of cards) {
                if (results.length >= 8) break; // Limit to 8 results

                const titleElement = card.querySelector('div[data-testid="offer-title"]');
                const badgeElement = card.querySelector('span[class*="Badge"]'); // Look for discount badge
                
                // Only keep it if it has a discount badge (e.g. "-50%")
                if (titleElement && badgeElement && badgeElement.innerText.includes('-')) {
                    results.push({
                        title: titleElement.innerText,
                        discount: badgeElement.innerText,
                        link: card.href
                    });
                }
            }
            return results;
        });

        if (discounts.length > 0) {
            discounts.forEach(d => {
                report += `• *${d.title}* [${d.discount}]\n`;
            });
        } else {
            report += "(Could not load discounts list. Epic is being slow!)\n";
        }
        
        report += "\n--------------------\nSee you tomorrow! 🫡";
        console.log("✅ Report generated!");
        return report;

    } catch (error) {
        console.error("❌ Scrape failed:", error);
        return "❌ I tried to scrape Epic Games but something went wrong. Try again later!";
    } finally {
        await browser.close();
    }
}

module.exports = { getEpicDeals };