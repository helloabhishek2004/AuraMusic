import re

with open('android/app/src/main/java/com/auramusic/core/botguard/PoTokenManager.kt', 'r', encoding='utf-8') as f:
    content = f.read()

old_js = """                        let minterFunc = null;
                        if (window.trayride) {
                            for (let key in window.trayride) {
                                if (typeof window.trayride[key] === 'function') {
                                    minterFunc = window.trayride[key];
                                    break;
                                }
                            }
                        }
                        if (!minterFunc && window.${'$'}_) {
                            for (let key in window.${'$'}_) {
                                if (typeof window.${'$'}_[key] === 'function') {
                                    minterFunc = window.${'$'}_[key];
                                    break;
                                }
                            }
                        }
                        
                        if (minterFunc) {
                            const minterFuncs = minterFunc('$botguardProgram');
                            if (minterFuncs && minterFuncs.length > 0) {
                                window.minter = minterFuncs[0];
                                window.PoTokenWebView.onInitSuccess();
                            } else {
                                window.PoTokenWebView.onInitError('BotGuard minter function returned empty');
                            }
                        } else {
                            window.PoTokenWebView.onInitError('BotGuard minter function not found in trayride or ${'$'}_');
                        }"""

new_js = """                        let foundMinter = false;
                        
                        function checkObj(obj) {
                            if (!obj) return false;
                            for (let key in obj) {
                                if (typeof obj[key] === 'function') {
                                    try {
                                        const res = obj[key]('$botguardProgram');
                                        if (res && res.length > 0 && typeof res[0] === 'function') {
                                            window.minter = res[0];
                                            return true;
                                        }
                                    } catch(e) { }
                                }
                            }
                            return false;
                        }
                        
                        foundMinter = checkObj(window.trayride) || checkObj(window.${'$'}_);
                        
                        if (foundMinter) {
                            window.PoTokenWebView.onInitSuccess();
                        } else {
                            window.PoTokenWebView.onInitError('BotGuard minter function not found or did not return array in trayride or ${'$'}_');
                        }"""

content = content.replace(old_js, new_js)

with open('android/app/src/main/java/com/auramusic/core/botguard/PoTokenManager.kt', 'w', encoding='utf-8') as f:
    f.write(content)
