/* ================================================================
   Trusty AI — Narrative reference + classifier

   Pulls the 7 narrative buckets from the website's Degen Academy so
   the extension can match a scanned token to its narrative and
   surface the risk matrix + playbook inline.

   Token list comes from each narrative's coin chips on trustyai.tech.
   Keyword fallback handles new tokens that aren't in the seed list
   but share an obvious naming pattern (dog/inu, cat, ai/agent, etc.).
   ================================================================ */

(function () {
  "use strict";

  const NARRATIVES = {
    dogs: {
      id: "dogs",
      name: "Dog Meta",
      subtitle: "The OG",
      emoji: "🐶",
      risk: "LOW",
      riskColor: "green",
      avgReturn: "300–1,000%",
      rugRate: "Low (~15%)",
      lifespan: "Months–Years",
      bestEntry: "Early bull cycle",
      tokens: ["DOGE","SHIB","WIF","BONK","FLOKI","NEIRO"],
      whenToApe: "Early in a bull cycle, before DOGE 3x's. When Elon tweets. New Solana dogs with LP burned and active community.",
      whenToAvoid: "After DOGE pumped 3x+. Bear markets. Copy-cat dogs with no identity.",
      keySignal: "DOGE volume spikes 10x+. Small dogs outperform first — BONK and WIF both ran while DOGE was flat."
    },
    cats: {
      id: "cats",
      name: "Cat Meta",
      subtitle: "The Challenger",
      emoji: "🐱",
      risk: "MED",
      riskColor: "yellow",
      avgReturn: "500–5,000%",
      rugRate: "Med (~30%)",
      lifespan: "Weeks–Months",
      bestEntry: "After dogs pump",
      tokens: ["POPCAT","MOG","MEW","MICHI"],
      whenToApe: "After the dog meta has run 2-4 weeks. Cat coins lagging while dogs pump = your entry.",
      whenToAvoid: "First mover in a new cat launch. Cats with no cultural origin (just 'cat coin' with no meme backing).",
      keySignal: "POPCAT/DOGE ratio. Cats lagging dogs by 2+ weeks in a bull run = rotation incoming."
    },
    tiktok: {
      id: "tiktok",
      name: "TikTok Meta",
      subtitle: "The Normie Pipeline",
      emoji: "📱",
      risk: "HIGH",
      riskColor: "red",
      avgReturn: "5,000–80,000%",
      rugRate: "High (~60%)",
      lifespan: "Hours–Days",
      bestEntry: "Before crypto press",
      tokens: ["CHILLGUY","PENGU","PENGUIN","PUNCH","MOODENG","PNUT"],
      whenToApe: "After social explosion but BEFORE crypto press coverage. If it's everywhere on TikTok but hasn't hit CoinDesk yet — that's the window.",
      whenToAvoid: "After Binance or Coinbase announces listing. Tiny LP ($5M) on a $500M mcap = brutal exits.",
      keySignal: "Cross-platform momentum: same meme trending on TikTok + X + Reddit simultaneously."
    },
    ai: {
      id: "ai",
      name: "AI Agents",
      subtitle: "The 2024/25 Wave",
      emoji: "🤖",
      risk: "MED",
      riskColor: "yellow",
      avgReturn: "1,000–10,000%",
      rugRate: "Med (~35%)",
      lifespan: "Weeks–Months",
      bestEntry: "New AI product launch",
      tokens: ["GOAT","AI16Z","ZEREBRO","GRIFFAIN","FARTCOIN","MOLT","VIRTUAL"],
      whenToApe: "AI projects with verifiable autonomous activity — actual posts, content, on-chain txs from the agent itself. Early discovery before Binance lists.",
      whenToAvoid: "Generic memes with 'AI' tacked on the name. After the first wave — GOAT lost 70%+ from ATH.",
      keySignal: "Is the AI actually doing things? Real posts / real trades / real product = narrative has legs."
    },
    mascot: {
      id: "mascot",
      name: "Mascot Meta",
      subtitle: "The Stickiest",
      emoji: "🎭",
      risk: "LOW",
      riskColor: "green",
      avgReturn: "200–2,000%",
      rugRate: "Low (~20%)",
      lifespan: "Months–Years",
      bestEntry: "When meme goes viral",
      tokens: ["PEPE","BRETT","WIF","PENGU","ANDY","TRUSTY"],
      whenToApe: "Character existed BEFORE the coin. Organic fan art and merch appearing without the team pushing.",
      whenToAvoid: "AI-generated mascots with no history. PEPE clones. Just a logo with no lore.",
      keySignal: "Search the character on Google Images / TikTok outside crypto. Real-world merch = real cultural weight."
    },
    cz: {
      id: "cz",
      name: "CZ Meta",
      subtitle: "The BNB Season",
      emoji: "🟡",
      risk: "MED-HIGH",
      riskColor: "orange",
      avgReturn: "200–5,000%",
      rugRate: "Med-High (~45%)",
      lifespan: "Days–Weeks",
      bestEntry: "CZ tweet/post",
      tokens: ["GIGGLE","4","PAUL","SZN","PUP"],
      whenToApe: "CZ mentions a new project / cause / number. Find the BNB token connected to it before Binance makes it official. Speed is everything.",
      whenToAvoid: "Coins claiming to be 'official CZ' or 'official Binance' — they never are. The Binance clarification post is often a sell signal.",
      keySignal: "Follow @cz_binance. BNB Chain DEX volume spikes without obvious cause = CZ season starting."
    },
    political: {
      id: "political",
      name: "Political Meta",
      subtitle: "The Event Trader",
      emoji: "🇺🇸",
      risk: "EXTREME",
      riskColor: "red",
      avgReturn: "1,000–50,000%",
      rugRate: "Very High (~70%)",
      lifespan: "Hours",
      bestEntry: "Before event peaks",
      tokens: ["TRUMP","MELANIA","BODEN","MAGA"],
      whenToApe: "Only BEFORE the political event. Hours before mainstream coverage, very small position size.",
      whenToAvoid: "After the event peaks. Any coin claiming 'official endorsement' is lying.",
      keySignal: "Google Trends spikes for political terms. Polymarket activity on related events."
    }
  };

  // Token (symbol) → narrative, by exact-match in the seed list above.
  // Returns null if no match — the caller should treat that as
  // "unclassified" rather than picking a fallback bucket.
  function matchByToken(sym) {
    if (!sym) return null;
    const s = String(sym).toUpperCase().replace(/^\$/, "").trim();
    for (const key in NARRATIVES) {
      if (NARRATIVES[key].tokens.includes(s)) return NARRATIVES[key];
    }
    return null;
  }

  // Keyword heuristic against name+symbol. Conservative — only fires
  // on obvious patterns. Anything not matched stays unclassified.
  function matchByKeyword(sym, name) {
    const haystack = ((sym || "") + " " + (name || "")).toLowerCase();
    if (/\b(trump|biden|maga|melania|kamala|harris|election)\b/.test(haystack)) return NARRATIVES.political;
    if (/\b(ai\d?|agent|gpt|llm|neural|robot)\b/.test(haystack)) return NARRATIVES.ai;
    if (/\b(cz|binance.?coin|bnb.?season|giggle)\b/.test(haystack)) return NARRATIVES.cz;
    if (/\b(cat|kitty|popcat|michi)\b/.test(haystack)) return NARRATIVES.cats;
    if (/\b(dog|doge|inu|shib|puppy|woof)\b/.test(haystack)) return NARRATIVES.dogs;
    if (/\b(pepe|frog|brett|wojak|chad|andy|trusty)\b/.test(haystack)) return NARRATIVES.mascot;
    if (/\b(chill|tiktok|viral|penguin|moodeng|pnut|punch)\b/.test(haystack)) return NARRATIVES.tiktok;
    return null;
  }

  function classify(symbol, name) {
    return matchByToken(symbol) || matchByKeyword(symbol, name) || null;
  }

  window.TrustyNarratives = {
    NARRATIVES: NARRATIVES,
    classify: classify
  };
})();
