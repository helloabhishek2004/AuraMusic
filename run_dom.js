const fs = require('fs');
const jsdom = require("jsdom");
const { JSDOM } = jsdom;

const html = fs.readFileSync('test_bg.html', 'utf8');

const virtualConsole = new jsdom.VirtualConsole();
virtualConsole.on("log", (m) => { console.log("LOG:", m); });
virtualConsole.on("error", (m) => { console.log("ERR:", m); });

const dom = new JSDOM(html, { runScripts: "dangerously", virtualConsole });
