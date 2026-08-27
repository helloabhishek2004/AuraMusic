
const https = require("https");
const { JSDOM } = require("jsdom");

(async () => {
    const res1 = await new Promise((resolve) => {
        const req = https.request("https://www.youtube.com/youtubei/v1/att/get?key=", { method: "POST", headers: { "Content-Type": "application/json" } }, res => {
            let data = ""; res.on("data", chunk => data += chunk); res.on("end", () => resolve({ data }));
        });
        req.write(JSON.stringify({ context: { client: { clientName: "WEB", clientVersion: "2.20230526.01.00" } } })); req.end();
    });
    const bgData = JSON.parse(res1.data).botguardData;
    const program = bgData.program;
    const scriptUrl = "https:" + bgData.interpreterSafeUrl.privateDoNotAccessOrElseTrustedResourceUrlWrappedValue;

    const res2 = await new Promise((resolve) => {
        https.get(scriptUrl, res => { let data = ""; res.on("data", chunk => data += chunk); res.on("end", () => resolve({ data })); });
    });
    const script = res2.data;

    const match = script.match(/\.([a-zA-Z0-9_]+)\s*=\s*function\([a-zA-Z0-9_,]+\)\s*\{\s*return\s*\[/);
    const minterName = match[1];
    
    const dom = new JSDOM("", { runScripts: "dangerously", url: "https://www.youtube.com" });
    const window = dom.window;
    window.eval("window.$_ = window; " + script);
    
    const exportObj = window.trayride || window.$_;
    const generator = exportObj[minterName](program);
    console.log("Generator returned array of length:", generator.length);
    for(let i=0; i<generator.length; i++) {
        console.log(`Index ${i} type:`, typeof generator[i]);
        if(typeof generator[i] === "function") {
            try {
                console.log(`  Calling index ${i} with no args...`);
                let res = generator[i]();
                console.log(`  Result type: ${typeof res}, length/value: ${res?.length || res}`);
            } catch(e) { console.log(`  Error: ${e.message}`); }
            try {
                console.log(`  Calling index ${i} with identifier...`);
                let res = generator[i]("TEST_IDENTIFIER");
                console.log(`  Result type: ${typeof res}, length/value: ${res?.length || res}`);
            } catch(e) { console.log(`  Error: ${e.message}`); }
        }
    }
})();

