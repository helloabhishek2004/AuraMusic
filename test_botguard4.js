
const https = require("https");
const { JSDOM } = require("jsdom");

(async () => {
    const res1 = await new Promise((resolve) => {
        const req = https.request("https://www.youtube.com/youtubei/v1/att/get?key=", { method: "POST", headers: { "Content-Type": "application/json" } }, res => {
            let data = ""; res.on("data", chunk => data += chunk); res.on("end", () => resolve({ data }));
        });
        req.write(JSON.stringify({ context: { client: { clientName: "WEB", clientVersion: "2.20230526.01.00" } } })); req.end();
    });
    const data1 = JSON.parse(res1.data);
    const bgData = data1.botguardData;
    const program = bgData.program;
    const attVisitorData = data1.responseContext.visitorData || "";
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
    console.log("attVisitorData length:", attVisitorData.length);
    console.log("Calling with attVisitorData...");
    let res = generator[0](attVisitorData);
    console.log("Result length/value:", res?.length || res);
    
    console.log("Calling with videoId...");
    let res2_ = generator[0]("fdngrJr4wIA");
    console.log("Result length/value:", res2_?.length || res2_);
})();

