# Trusty Content Guide

How to add content to trustyai.tech without touching code.

## 📰 Add a New Week in Meme Article

1. Go to: https://github.com/SimeonNBA/Trusty/edit/main/data/articles.json
2. Add a new article object to the `articles` array (at the TOP, so newest shows first)
3. Copy this template and fill it in:

```json
{
  "id": "unique-slug-here",
  "title": "Your headline here",
  "date": "April 20, 2026",
  "cover": "https://image-url-here.com/image.png",
  "tags": ["CZ", "BNB", "Narrative"],
  "body": "<p>Your paragraph here.</p><p>Another paragraph.</p><p>You can include <strong>bold</strong>, <em>italic</em>, <a href='https://...' target='_blank'>links</a>, and <img src='https://...' /> inline images.</p>",
  "takeaway": "The key lesson from this week."
}
```

4. Click **"Commit changes..."** → **Commit**
5. Site auto-updates in ~1 minute

### Tips for articles
- **Cover image:** Upload to imgur.com, or use a Tweet's image URL (right-click tweet → copy image address)
- **Body:** Use simple HTML. Wrap paragraphs in `<p>...</p>`. For images use `<img src='URL' style='max-width:100%;border-radius:8px;' />`
- **Tags:** Short labels like "CZ", "Rug Pulls", "BNB Narratives" — show as pills at the top
- **Takeaway:** One-line lesson. Shows in gold highlight box at the bottom
- **Commas:** Use double quotes inside HTML, not single quotes — or escape them

---

## ⭐ Add a Featured Token

1. Go to: https://github.com/SimeonNBA/Trusty/edit/main/data/featured.json
2. Add a token to the `tokens` array:

```json
{
  "name": "$NEWTOKEN",
  "symbol": "NEW",
  "ca": "0x...contract-address...",
  "reason": "Short reason why it's featured (max ~40 chars)",
  "emoji": "🔥"
}
```

3. Commit

### Tips for featured tokens
- **ca** must be the exact contract address (with 0x prefix for EVM, or Solana mint address for SOL)
- **emoji** is the visual identifier in the card
- **reason** is the one-line description shown to users
- Keep the list short (3-5 tokens max, they're a scrolling strip)

---

## 🐦 Add an Alpha Thread

Alpha Threads live in `index.html` (they include HTML rendering), so you edit them there.

1. Go to: https://github.com/SimeonNBA/Trusty/edit/main/index.html
2. Press `Ctrl+F` (or Cmd+F) and search for: `threadsData = [`
3. Add a new object at the END of the array:

```js
{ author: 'Display Name', handle: '@handle', avatar: '🐋', tag: 'alpha', tagLabel: 'ALPHA',
  date: 'Dec 2025',
  quote: 'The exact quote from the tweet',
  takeaway: 'What Trusty thinks of this thread',
  url: 'https://x.com/handle/status/123456' },
```

4. Valid `tag` values: `mindset`, `alpha`, `strategy`, `risk`, `guide`
5. Commit

---

## 🚨 Important

- **Never commit private keys, emails, passwords, or personal info.** Repo is public.
- **Use double quotes** `"..."` in JSON, not single quotes `'...'`
- **Escape quotes in body HTML** by using single quotes inside: `"body": "<p>He said 'hi'</p>"`
- **Keep JSON valid** — if you break the syntax, the site won't load articles. Use https://jsonlint.com to validate before committing.

---

## 🎯 Content ideas

- Weekly meme recap (every Monday)
- "What Trusty caught this week" (rugs detected)
- Narrative breakdowns (Dog meta, AI agents, political)
- Interview with a KOL
- "This token looked like X → it did Y" case studies
- Community spotlights (featured projects)

Keep it punchy. Degens don't read 2000-word essays.
