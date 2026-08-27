import re
with open('android/app/src/main/java/com/auramusic/core/botguard/PoTokenManager.kt', 'r', encoding='utf-8') as f:
    content = f.read()

content = content.replace('    private val REQUEST_KEY = "O43z0dpjhgX20SCx4KAo"', '', 1)

with open('android/app/src/main/java/com/auramusic/core/botguard/PoTokenManager.kt', 'w', encoding='utf-8') as f:
    f.write(content)
