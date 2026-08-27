import re

with open('android/app/src/main/java/com/auramusic/core/botguard/PoTokenManager.kt', 'r', encoding='utf-8') as f:
    content = f.read()

# I need to revert my `checkObj` hack and instead inject JS that reads the actual source string to find the exact export name, or better yet, I can extract the function name in Kotlin before injecting the WebView!
# Wait, Kotlin has the `jsCode` string!
# Let's see how `initBotGuard` is written.
