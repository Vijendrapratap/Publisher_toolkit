import type { LandingTemplateKey, LandingThemeKey } from './options'

export interface RenderLandingPageInput {
  title: string
  subtitle?: string | null
  author: string
  authorBio?: string | null
  synopsis?: string | null
  coverUrl?: string | null
  template: LandingTemplateKey
  theme: LandingThemeKey
  accentColor: string
  ctaText: string
  retailerLinks?: { retailer: string; url: string }[] | null
  reviews?: { quote: string; reviewer: string; outlet?: string }[] | null
  sampleChapterTitle?: string | null
  sampleChapterText?: string | null
}

export function renderLandingPageHtml(input: RenderLandingPageInput): string {
  const isLight = input.theme === 'light'
  const isMatt = input.theme === 'matt'

  const bg = isLight ? '#fcfbf9' : isMatt ? '#121316' : '#090a0f'
  const surface = isLight ? '#ffffff' : isMatt ? '#1c1e24' : '#141722'
  const surface2 = isLight ? '#f3f1ec' : isMatt ? '#242731' : '#1c2030'
  const textPrimary = isLight ? '#171717' : '#f8fafc'
  const textSecondary = isLight ? '#525252' : '#94a3b8'
  const border = isLight ? 'rgba(0,0,0,0.08)' : isMatt ? 'rgba(255,255,255,0.08)' : 'rgba(255,255,255,0.12)'
  const accent = input.accentColor || '#6366f1'

  const defaultRetailers = [
    { retailer: 'Amazon', url: '#' },
    { retailer: 'Barnes & Noble', url: '#' },
    { retailer: 'Apple Books', url: '#' },
    { retailer: 'Audible', url: '#' },
  ]
  const retailers = input.retailerLinks && input.retailerLinks.length > 0 ? input.retailerLinks : defaultRetailers

  const defaultReviews = [
    {
      quote: 'An astonishing achievement. Gripping from the very first page to the unforgettable conclusion.',
      reviewer: 'Literary Chronicle',
      outlet: 'Starred Review',
    },
    {
      quote: 'Breathless pacing, richly drawn characters, and twists you will never see coming.',
      reviewer: 'Book Review Weekly',
      outlet: 'Editor’s Choice',
    },
    {
      quote: 'A masterpiece of contemporary storytelling. Destined to be an instant classic.',
      reviewer: 'Publishers Tribune',
      outlet: 'National Best Pick',
    },
  ]
  const reviews = input.reviews && input.reviews.length > 0 ? input.reviews : defaultReviews

  const cleanTitle = escapeHtml(input.title || 'Untitled Book')
  const cleanAuthor = escapeHtml(input.author || 'Renowned Author')
  const cleanSubtitle = escapeHtml(
    input.subtitle || 'An unforgettable story of ambition, intrigue, and extraordinary discovery.'
  )
  const cleanSynopsis = escapeHtml(
    input.synopsis ||
      'When an unexpected discovery shatters the quiet peace of the realm, one individual must rise to confront forces beyond comprehension. Rich with suspense and vivid imagination, this journey will test loyalties and redefine courage.'
  )
  const cleanBio = escapeHtml(
    input.authorBio ||
      `${cleanAuthor} is an acclaimed author whose novels have resonated with readers globally, known for captivating storytelling and unforgettable characters.`
  )
  const sampleTitle = escapeHtml(input.sampleChapterTitle || 'Chapter 1: The Threshold')
  const sampleText = escapeHtml(
    input.sampleChapterText ||
      'The morning mist lingered over the cobblestone streets as the bells of the old cathedral tolled seven. No one paid attention to the stranger who stepped off the carriage, his coat pulled tight against the damp chill. In his pocket rested the leather-bound journal that would change the fate of the city forever.\n\nHe checked behind him once, twice. Nothing moved except the autumn wind whispering through dry maple leaves. The time had come to break the silence.'
  )

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${cleanTitle} by ${cleanAuthor}</title>
  <meta name="description" content="${cleanSubtitle}">
  <style>
    :root {
      --bg: ${bg};
      --surface: ${surface};
      --surface-2: ${surface2};
      --text: ${textPrimary};
      --text-muted: ${textSecondary};
      --border: ${border};
      --accent: ${accent};
      --font-serif: "Playfair Display", Georgia, "Times New Roman", serif;
      --font-sans: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
    }
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      background-color: var(--bg);
      color: var(--text);
      font-family: var(--font-sans);
      line-height: 1.6;
      -webkit-font-smoothing: antialiased;
      overflow-x: hidden;
    }
    a { color: inherit; text-decoration: none; }
    .container { max-width: 1140px; margin: 0 auto; padding: 0 24px; }

    /* Header Nav */
    header {
      position: sticky; top: 0; z-index: 50;
      background: ${isLight ? 'rgba(252,251,249,0.92)' : isMatt ? 'rgba(18,19,22,0.92)' : 'rgba(9,10,15,0.92)'};
      backdrop-filter: blur(12px);
      border-bottom: 1px solid var(--border);
      padding: 16px 0;
    }
    .nav-inner { display: flex; justify-content: space-between; align-items: center; }
    .nav-brand { font-weight: 700; font-size: 1.125rem; letter-spacing: -0.01em; }
    .nav-cta {
      background: var(--accent); color: #fff;
      padding: 8px 20px; border-radius: 9999px;
      font-size: 0.875rem; font-weight: 600;
      box-shadow: 0 4px 14px rgba(0,0,0,0.15);
      transition: opacity 0.2s;
    }
    .nav-cta:hover { opacity: 0.92; }

    /* Hero Section */
    .hero {
      padding: 70px 0 60px;
      position: relative;
    }
    .hero-grid {
      display: grid;
      grid-template-columns: 1.15fr 0.85fr;
      gap: 60px;
      align-items: center;
    }
    @media (max-width: 860px) {
      .hero-grid { grid-template-columns: 1fr; gap: 40px; text-align: center; }
    }
    .badge {
      display: inline-block;
      padding: 4px 14px;
      background: rgba(255,255,255,0.06);
      border: 1px solid var(--border);
      border-radius: 9999px;
      color: var(--accent);
      font-size: 0.75rem; font-weight: 700;
      letter-spacing: 0.08em; text-transform: uppercase;
      margin-bottom: 16px;
    }
    h1 {
      font-family: var(--font-serif);
      font-size: clamp(2.5rem, 5vw, 4rem);
      font-weight: 800;
      line-height: 1.1;
      margin-bottom: 16px;
      letter-spacing: -0.02em;
    }
    .byline {
      font-size: 1.25rem;
      color: var(--accent);
      font-weight: 600;
      margin-bottom: 20px;
    }
    .subtitle {
      font-size: 1.125rem;
      color: var(--text-muted);
      line-height: 1.6;
      margin-bottom: 32px;
      max-width: 540px;
    }
    @media (max-width: 860px) {
      .subtitle { margin-left: auto; margin-right: auto; }
    }
    .retailers-heading {
      font-size: 0.8rem;
      text-transform: uppercase;
      letter-spacing: 0.08em;
      color: var(--text-muted);
      margin-bottom: 12px;
      font-weight: 600;
    }
    .retailer-btns {
      display: flex;
      flex-wrap: wrap;
      gap: 12px;
    }
    @media (max-width: 860px) {
      .retailer-btns { justify-content: center; }
    }
    .btn-buy {
      display: inline-flex;
      align-items: center;
      gap: 8px;
      background: var(--surface);
      border: 1px solid var(--border);
      padding: 12px 20px;
      border-radius: 12px;
      font-weight: 600;
      font-size: 0.95rem;
      transition: all 0.2s ease;
      box-shadow: 0 4px 12px rgba(0,0,0,0.06);
    }
    .btn-buy:hover {
      border-color: var(--accent);
      transform: translateY(-2px);
    }
    .btn-buy.primary {
      background: var(--accent);
      color: #fff;
      border-color: var(--accent);
    }

    /* 3D Book Presentation */
    .book-stage {
      display: flex;
      justify-content: center;
      perspective: 1200px;
    }
    .book-mockup {
      width: 280px;
      height: 420px;
      position: relative;
      transform: rotateY(-10deg) rotateX(4deg);
      transform-style: preserve-3d;
      box-shadow:
        0 25px 50px -12px rgba(0,0,0,0.75),
        0 0 40px ${accent}25;
      border-radius: 12px;
      overflow: hidden;
      background: var(--surface);
      border: 1px solid var(--border);
      transition: transform 0.4s ease;
    }
    .book-mockup:hover {
      transform: rotateY(0deg) rotateX(0deg) scale(1.03);
    }
    .book-cover-img {
      width: 100%;
      height: 100%;
      object-fit: cover;
      display: block;
    }
    .fallback-cover {
      width: 100%; height: 100%;
      display: flex; flex-direction: column;
      justify-content: center; align-items: center;
      padding: 30px; text-align: center;
      background: linear-gradient(135deg, ${surface}, ${surface2});
      border: 2px solid var(--accent);
    }

    /* Reviews Ticker */
    .reviews-section {
      padding: 50px 0;
      border-top: 1px solid var(--border);
      border-bottom: 1px solid var(--border);
      background: var(--surface);
    }
    .reviews-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
      gap: 28px;
    }
    .review-card {
      padding: 24px;
      border-radius: 16px;
      background: var(--surface-2);
      border: 1px solid var(--border);
    }
    .stars { color: #f59e0b; font-size: 1.1rem; margin-bottom: 8px; }
    .quote { font-style: italic; color: var(--text); margin-bottom: 16px; line-height: 1.5; font-size: 0.95rem; }
    .reviewer { font-weight: 700; font-size: 0.875rem; color: var(--text); }
    .outlet { font-size: 0.75rem; color: var(--text-muted); }

    /* Synopsis Section */
    .synopsis-section {
      padding: 80px 0;
    }
    .section-title {
      font-family: var(--font-serif);
      font-size: 2.25rem;
      margin-bottom: 24px;
      letter-spacing: -0.02em;
    }
    .synopsis-text {
      font-size: 1.125rem;
      color: var(--text-muted);
      line-height: 1.8;
      max-width: 800px;
      white-space: pre-line;
    }

    /* Sample Chapter Reader Drawer */
    .reader-section {
      padding: 60px 0;
      background: var(--surface);
      border-top: 1px solid var(--border);
      border-bottom: 1px solid var(--border);
    }
    .reader-box {
      background: var(--surface-2);
      border: 1px solid var(--border);
      border-radius: 20px;
      padding: 40px;
      max-width: 860px;
      margin: 0 auto;
    }
    .reader-title {
      font-family: var(--font-serif);
      font-size: 1.5rem;
      margin-bottom: 16px;
      color: var(--accent);
    }
    .reader-content {
      font-size: 1.05rem;
      line-height: 1.8;
      color: var(--text);
      white-space: pre-line;
      max-height: 280px;
      overflow: hidden;
      position: relative;
      transition: max-height 0.4s ease;
    }
    .reader-content.expanded { max-height: 4000px; }
    .reader-fade {
      position: absolute; bottom: 0; left: 0; right: 0; height: 120px;
      background: linear-gradient(to top, var(--surface-2), transparent);
      pointer-events: none;
    }
    .reader-content.expanded .reader-fade { display: none; }
    .btn-toggle-sample {
      margin-top: 20px;
      background: var(--surface);
      border: 1px solid var(--border);
      color: var(--text);
      font-weight: 600; font-size: 0.9rem;
      padding: 10px 24px; border-radius: 9999px;
      cursor: pointer;
    }

    /* Author Section */
    .author-section {
      padding: 80px 0;
    }
    .author-card {
      display: flex;
      gap: 40px;
      align-items: center;
      background: var(--surface);
      border: 1px solid var(--border);
      border-radius: 24px;
      padding: 40px;
    }
    @media (max-width: 760px) {
      .author-card { flex-direction: column; text-align: center; }
    }
    .author-avatar {
      width: 120px; height: 120px;
      border-radius: 50%;
      background: var(--accent);
      color: #fff;
      display: flex; align-items: center; justify-content: center;
      font-size: 2.5rem; font-weight: 700;
      flex-shrink: 0;
      box-shadow: 0 10px 25px rgba(0,0,0,0.2);
    }

    /* Footer */
    footer {
      padding: 40px 0;
      border-top: 1px solid var(--border);
      text-align: center;
      color: var(--text-muted);
      font-size: 0.875rem;
    }
  </style>
</head>
<body>
  <header>
    <div class="container nav-inner">
      <div class="nav-brand">${cleanTitle}</div>
      <a href="#buy" class="nav-cta">${escapeHtml(input.ctaText || 'Get The Book')}</a>
    </div>
  </header>

  <main>
    <section class="hero">
      <div class="container hero-grid">
        <div>
          <span class="badge">Official Book Release</span>
          <h1>${cleanTitle}</h1>
          <div class="byline">A Novel by ${cleanAuthor}</div>
          <p class="subtitle">${cleanSubtitle}</p>

          <div id="buy">
            <div class="retailers-heading">Available at major booksellers:</div>
            <div class="retailer-btns">
              ${retailers
                .map(
                  (r, idx) => `
                <a href="${escapeHtml(r.url)}" target="_blank" rel="noopener noreferrer" class="btn-buy ${idx === 0 ? 'primary' : ''}">
                  <span>${escapeHtml(r.retailer)}</span>
                  <span>&rarr;</span>
                </a>
              `
                )
                .join('')}
            </div>
          </div>
        </div>

        <div class="book-stage">
          <div class="book-mockup">
            ${
              input.coverUrl
                ? `<img src="${escapeHtml(input.coverUrl)}" alt="${cleanTitle} Cover" class="book-cover-img" />`
                : `<div class="fallback-cover">
                    <h2 style="font-family: var(--font-serif); font-size: 1.5rem; margin-bottom: 8px;">${cleanTitle}</h2>
                    <p style="color: var(--accent); font-weight: 600;">${cleanAuthor}</p>
                   </div>`
            }
          </div>
        </div>
      </div>
    </section>

    <!-- Praise & Reviews -->
    <section class="reviews-section">
      <div class="container">
        <div class="reviews-grid">
          ${reviews
            .map(
              (rev) => `
            <div class="review-card">
              <div class="stars">★★★★★</div>
              <p class="quote">“${escapeHtml(rev.quote)}”</p>
              <div class="reviewer">${escapeHtml(rev.reviewer)}</div>
              ${rev.outlet ? `<div class="outlet">${escapeHtml(rev.outlet)}</div>` : ''}
            </div>
          `
            )
            .join('')}
        </div>
      </div>
    </section>

    <!-- Synopsis -->
    <section class="synopsis-section">
      <div class="container">
        <h2 class="section-title">The Story</h2>
        <div class="synopsis-text">${cleanSynopsis}</div>
      </div>
    </section>

    <!-- Sample Chapter Reader -->
    <section class="reader-section">
      <div class="container">
        <div class="reader-box">
          <h3 class="reader-title">${sampleTitle}</h3>
          <div id="chapter-content" class="reader-content">
            <p>${sampleText}</p>
            <div class="reader-fade"></div>
          </div>
          <button id="toggle-btn" class="btn-toggle-sample" onclick="toggleChapter()">Read Full Sample Excerpt</button>
        </div>
      </div>
    </section>

    <!-- Author Profile -->
    <section class="author-section">
      <div class="container">
        <div class="author-card">
          <div class="author-avatar">${cleanAuthor.charAt(0)}</div>
          <div>
            <h2 class="section-title" style="margin-bottom: 12px;">About ${cleanAuthor}</h2>
            <p style="color: var(--text-muted); line-height: 1.7; font-size: 1.05rem;">${cleanBio}</p>
          </div>
        </div>
      </div>
    </section>
  </main>

  <footer>
    <div class="container">
      <p>&copy; ${new Date().getFullYear()} ${cleanAuthor}. All rights reserved.</p>
      <p style="margin-top: 6px; font-size: 0.8rem; opacity: 0.75;">Published via Publisher Toolkit</p>
    </div>
  </footer>

  <script>
    function toggleChapter() {
      const el = document.getElementById('chapter-content');
      const btn = document.getElementById('toggle-btn');
      if (el.classList.contains('expanded')) {
        el.classList.remove('expanded');
        btn.textContent = 'Read Full Sample Excerpt';
      } else {
        el.classList.add('expanded');
        btn.textContent = 'Collapse Excerpt';
      }
    }
  </script>
</body>
</html>`
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;')
}
