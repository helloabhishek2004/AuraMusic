
const https = require("https");
const { JSDOM } = require("jsdom");

function fetch(url, options = {}) {
    return new Promise((resolve, reject) => {
        const req = https.request(url, options, res => {
            let data = "";
            res.on("data", chunk => data += chunk);
            res.on("end", () => resolve({ status: res.statusCode, data }));
        });
        if (options.body) req.write(options.body);
        req.end();
        req.on("error", reject);
    });
}

(async () => {
    const res1 = await fetch("https://www.youtube.com/youtubei/v1/att/get?key=", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ context: { client: { clientName: "WEB", clientVersion: "2.20230526.01.00" } } })
    });
    const data1 = JSON.parse(res1.data);
    const bgData = data1.botguardData;
    const program = bgData.program;
    const attVisitorData = data1.responseContext.visitorData || "";
    const scriptUrl = "https:" + bgData.interpreterSafeUrl.privateDoNotAccessOrElseTrustedResourceUrlWrappedValue;

    const res2 = await fetch(scriptUrl);
    const script = res2.data;

    const match = script.match(/\.([a-zA-Z0-9_]+)\s*=\s*function\([a-zA-Z0-9_,]+\)\s*\{\s*return\s*\[/);
    const minterName = match[1];
    
    const dom = new JSDOM("", { runScripts: "dangerously", url: "https://www.youtube.com" });
    const window = dom.window;
    
    window.eval("window.$_ = window; " + script);
    
    const exportObj = window.trayride || window.$_;
    const generator = exportObj[minterName](program);
    const minter = generator[0];
    
    try {
        const tokenResult = minter(attVisitorData);
        console.log("Result type:", typeof tokenResult);
        if (Array.isArray(tokenResult)) {
            console.log("Array length:", tokenResult.length);
        } else if (tokenResult instanceof Uint8Array) {
            console.log("Uint8Array length:", tokenResult.length);
        } else if (typeof tokenResult === "string") {
            console.log("String value:", tokenResult.substring(0, 50));
        } else {
            console.log("Object type constructor:", tokenResult.constructor.name);
        }
    } catch (e) {
        console.log("Error caught:", e.message);
    }
})();

