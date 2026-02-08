const { Client, LocalAuth } = require('whatsapp-web.js');
const qrcode = require('qrcode-terminal');
const cron = require('node-cron');
const { getEpicDeals } = require('./scraper');

const client = new Client({
    authStrategy: new LocalAuth({ clientId: "bot-1" }),
    puppeteer: {
        args: ['--no-sandbox', '--disable-setuid-sandbox']
    }
});

// Store subscribed users (In memory for now)
let subscribers = new Set();

client.on('qr', (qr) => {
    console.log('Scan this QR code:');
    qrcode.generate(qr, { small: true });
});

client.on('ready', () => {
    console.log('✅ Bot is online!');
    
    //  DAILY SCHEDULE 
    // This runs every day at 09:00 AM
    cron.schedule('0 9 * * *', async () => {
        console.log("⏰ It's 9AM! Time to hunt for deals.");
        if (subscribers.size > 0) {
            const report = await getEpicDeals();
            subscribers.forEach(chatId => {
                client.sendMessage(chatId, report);
            });
        }
    });
});

client.on('message_create', async (message) => {
    
    // Command: !epic (Manual Check)
    if (message.body === '!epic') {
        await message.reply("🕵️‍♀️ Give me a moment, I'm checking the store...");
        const report = await getEpicDeals();
        await message.reply(report);
    }

    // Command: !subscribe (Sign up for daily updates)
    if (message.body === '!subscribe') {
        const chat = await message.getChat();
        subscribers.add(chat.id._serialized);
        await message.reply("✅ You are subscribed! I will send you the Epic Games Report every day at 9:00 AM.");
        console.log(`New subscriber: ${chat.id._serialized}`);
    }

    // Command: !ping (Status Check)
    if (message.body === '!ping') {
        await message.reply('pong');
    }
});

//  SINGLE START POINT 
client.initialize();

// SAFETY SHUTDOWN 
process.on('SIGINT', async () => {
    console.log('(Ctrl+C) Closing browser safely...');
    await client.destroy();
    console.log('✅ Client closed. Exiting.');
    process.exit(0);
});