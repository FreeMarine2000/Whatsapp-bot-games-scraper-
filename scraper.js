const puppeteer = require('puppeteer');
function formatDate(isoString) {
    const d = new Date(isoString);
    const day = String(d.getDate()).padStart(2, '0');
    const month = String(d.getMonth() + 1).padStart(2, '0'); // Months are 0-indexed
    const year = d.getFullYear();
    return `${day}/${month}/${year}`;
}

async function getEpicDeals() {
    console.log("🕵️‍♀️ Launching browser to hunt for deals...");
    
    const browser = await puppeteer.launch({
        headless: "new", 
        args: ['--no-sandbox', '--disable-setuid-sandbox']
    });

    try {
        const page = await browser.newPage();
        
        //  Pretends to be a real Windows user
        await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');
        await page.setViewport({ width: 1366, height: 768 });

        // GET FREE GAMES
        console.log("🎁 Checking Free Games...");
        await page.goto('https://store-site-backend-static.ak.epicgames.com/freeGamesPromotions', { waitUntil: 'networkidle0' });
        
        const freeGamesData = await page.evaluate(() => JSON.parse(document.body.innerText));
        const games = freeGamesData.data.Catalog.searchStore.elements;
        
        let report = "🔥 *EPIC GAMES DAILY REPORT* 🔥\n\n";
        
        report += "*🎁 FREE RIGHT NOW:*\n";
        let activeCount = 0;
        for (const game of games) {
            const promo = game.promotions?.promotionalOffers?.[0]?.promotionalOffers?.[0];
            if (promo) {
                activeCount++;
                // DATE FIX: en-GB forces DD/MM/YYYY
                const date = new Date(promo.endDate).toLocaleDateString('en-GB');
                report += `• *${game.title}*\n  (Ends: ${date})\n  🔗 https://store.epicgames.com/p/${game.urlSlug}\n\n`;
            }
        }
        if (activeCount === 0) report += "(No active free games right now)\n\n";

        report += "*🔜 COMING SOON:*\n";
        let upcomingCount = 0;
        for (const game of games) {
            const upcoming = game.promotions?.upcomingPromotionalOffers?.[0]?.promotionalOffers?.[0];
            if (upcoming) {
                upcomingCount++;
                //  DATE FIX: en-GB forces DD/MM/YYYY
                const date = new Date(upcoming.startDate).toLocaleDateString('en-GB');
                report += `• ${game.title} (Free on ${date})\n`;
            }
        }
        if (upcomingCount === 0) report += "(No upcoming games found)\n";

        // GET DISCOUNTS
        console.log("📉 Finding 'Featured Discounts'...");
        report += "\n--------------------\n*📉 FEATURED DISCOUNTS:*\n";

        await page.goto('https://store.epicgames.com/en-US/', { waitUntil: 'domcontentloaded' });
        await new Promise(r => setTimeout(r, 4000));

        // Scroll to find the section
        const foundSection = await page.evaluate(async () => {
            const headings = Array.from(document.querySelectorAll('h2, span, div'));
            const target = headings.find(el => el.innerText.trim() === "Featured Discounts");
            if (target) {
                target.scrollIntoView({ behavior: 'smooth', block: 'center' });
                return true;
            }
            return false;
        });

        if (foundSection) {
            await new Promise(r => setTimeout(r, 2000));
        } else {
            console.log("⚠️ Header not found, blind scroll...");
            await page.evaluate(() => window.scrollBy(0, 1500));
            await new Promise(r => setTimeout(r, 2000));
        }

        //  CLEAN UP TITLES
        const discounts = await page.evaluate(() => {
            const results = [];
            const allBadges = Array.from(document.querySelectorAll('span, div'));
            const discountBadges = allBadges.filter(el => /^-\d{1,2}%$/.test(el.innerText.trim()));

            discountBadges.forEach(badge => {
                if (results.length >= 8) return;

                const cardLink = badge.closest('a');
                if (cardLink) {
                    const lines = cardLink.innerText.split('\n').map(l => l.trim()).filter(l => l.length > 0);
                    
                    // Filter out garbage lines to find the real Title
                    const cleanLines = lines.filter(line => {
                        const l = line.toLowerCase();
                        return !l.includes('%') && 
                               !l.includes('₹') && 
                               !l.includes('$') &&
                               l !== "base game" && 
                               l !== "edition" && 
                               l !== "add-on" &&
                               l !== "now on epic";
                    });

                    const title = cleanLines[0] || "Unknown Game";

                    if (!results.find(r => r.title === title)) {
                        results.push({
                            title: title,
                            discount: badge.innerText,
                            link: cardLink.href
                        });
                    }
                }
            });
            return results;
        });

        if (discounts.length > 0) {
            discounts.forEach(d => {
                report += `• *${d.title}* [${d.discount}]\n`;
            });
        } else {
            report += "(Could not load Featured Discounts today.)\n";
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