with open('src/services/api/music.ts', 'r', encoding='utf-8') as f:
    content = f.read()

replacement = '''
      if (isNativeCoreAvailable()) {
        throw new Error("Artist browsing is not yet supported in the Native YouTube Engine.");
      }

      const response = await apiClient.get(/artist/\);
'''

content = content.replace('const response = await apiClient.get(/artist/);', replacement.strip())

with open('src/services/api/music.ts', 'w', encoding='utf-8') as f:
    f.write(content)
