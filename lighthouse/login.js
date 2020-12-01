const chromeLauncher = require('chrome-launcher');
const puppeteer = require('puppeteer');
const lighthouse = require('lighthouse');
const config = require('lighthouse/lighthouse-core/config/lr-desktop-config.js');
const reportGenerator = require('lighthouse/lighthouse-core/report/report-generator');
const request = require('request');
const util = require('util');
const fs = require('fs');

const args = require('minimist')(process.argv.slice(2));

if (!args.username || !args.password || !args.port) {
    console.log('Usage: node login.js --username USERNAME --password PASSWORD --port PORT');
    return;
}

(async() => {
    let loginURL = `http://kubernetes.docker.internal`;
    let logoutURL = `http://kubernetes.docker.internal/logout`;

    if (args.port !== 80) {
        loginURL = `http://kubernetes.docker.internal:${args.port}`;
        logoutURL = `http://kubernetes.docker.internal:${args.port}/logout`;
    }

    const opts = {
        // chromeFlags: ['--headless'],
        logLevel: 'info',
        output: 'json',
        disableDeviceEmulation: true,
        defaultViewport: {
            width: 1200,
            height: 900
        },
        chromeFlags: ['--disable-mobile-emulation']
    };

    // Launch chrome using chrome-launcher
    const chrome = await chromeLauncher.launch(opts);
    opts.port = chrome.port;

    // Connect to chrome using puppeteer.connect().
    const resp = await util.promisify(request)(`http://localhost:${opts.port}/json/version`);
    const {webSocketDebuggerUrl} = JSON.parse(resp.body);
    const browser = await puppeteer.connect({browserWSEndpoint: webSocketDebuggerUrl});

    //Puppeteer
    const page = (await browser.pages())[0];
    await page.setViewport({ width: 1200, height: 900});
    await page.goto(loginURL, {waitUntil: 'networkidle0'}).catch(async e => {
        console.log(e);
        await browser.disconnect();
        await chrome.kill();

        return void(0);
    });

    // await page.waitForNavigation({ waitUntil: 'networkidle0' });
    await page.type('[id="login"]', args.username);
    await page.type('[id="password"]', args.password);
    await page.evaluate(() => {
        document.querySelector('[id="submit-login"]').click();
    });

    await page.waitForNavigation({ waitUntil: 'networkidle2' });
    await page.click('body > div.dex-container > div > div:nth-child(5) > div:nth-child(1) > form > button');
    await page.waitForNavigation({waitUntil: 'networkidle2'});
    await page.waitForSelector('#cf-app-wrapper', {
        visible: true,
        });

    console.log('PAGE URL: ', page.url(), opts, config);

    // Run Lighthouse.
    const report = await lighthouse(page.url(), opts, config).then(results => {
        return results;
    });

    const html = reportGenerator.generateReport(report.lhr, 'html');
    const json = reportGenerator.generateReport(report.lhr, 'json');

    await page.goto(logoutURL, {waitUntil: 'networkidle2'});

    await browser.disconnect();
    await chrome.kill();


    //Write report html to the file
    fs.writeFile('LighthouseReport.html', html, (err) => {
        if (err) {
            console.error(err);
        }
    });

    //Write report json to the file
    fs.writeFile('LighthouseReport.json', json, (err) => {
        if (err) {
            console.error(err);
        }
    });
})();
