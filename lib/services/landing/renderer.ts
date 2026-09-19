import type { LandingTemplateKey, LandingThemeKey } from './options'

export interface RenderLandingPageInput {
  title: string
  subtitle?: string | null
  author: string
  authorBio?: string | null
  authorOriginStory?: string | null
  authorQuote?: string | null
  authorPhotoUrl?: string | null
  newsletterHeading?: string | null
  newsletterIncentive?: string | null
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
  const cleanAuthorQuote = escapeHtml(
    input.authorQuote ||
      'Stories are the only compass we have to navigate the uncharted corners of human nature.'
  )
  const cleanNewsletterHeading = escapeHtml(
    input.newsletterHeading || `Join ${cleanAuthor}’s Reader Inner Circle`
  )
  const cleanNewsletterIncentive = escapeHtml(
    input.newsletterIncentive ||
      'Be the first to read exclusive bonus chapters, receive author annotated commentary, and get insider updates before anyone else.'
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
    html { scroll-behavior: smooth; }
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
      padding: 14px 0;
    }
    .nav-inner { display: flex; justify-content: space-between; align-items: center; }
    .nav-brand { font-weight: 700; font-size: 1.125rem; letter-spacing: -0.01em; display: flex; align-items: center; gap: 8px; }
    .nav-links { display: flex; align-items: center; gap: 24px; font-size: 0.875rem; font-weight: 500; color: var(--text-muted); }
    @media (max-width: 800px) { .nav-links { display: none; } }
    .nav-links a:hover { color: var(--text); }
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

    /* Author Section - Centered on the Author */
    .author-section {
      padding: 90px 0;
      background: var(--surface);
      border-top: 1px solid var(--border);
      border-bottom: 1px solid var(--border);
      position: relative;
    }
    .author-card {
      display: grid;
      grid-template-columns: 240px 1fr;
      gap: 48px;
      align-items: start;
      background: var(--surface-2);
      border: 1px solid var(--border);
      border-radius: 28px;
      padding: 48px;
      box-shadow: 0 20px 40px rgba(0,0,0,0.06);
    }
    @media (max-width: 800px) {
      .author-card { grid-template-columns: 1fr; text-align: center; gap: 32px; padding: 32px 24px; }
    }
    .author-profile-col {
      display: flex;
      flex-direction: column;
      align-items: center;
      text-align: center;
    }
    .author-avatar {
      width: 160px; height: 160px;
      border-radius: 28px;
      background: linear-gradient(135deg, var(--accent), #4338ca);
      color: #fff;
      display: flex; align-items: center; justify-content: center;
      font-size: 3.5rem; font-weight: 800; font-family: var(--font-serif);
      box-shadow: 0 16px 32px rgba(0,0,0,0.2), 0 0 0 4px var(--surface-2), 0 0 0 6px var(--accent);
      margin-bottom: 16px;
      overflow: hidden;
    }
    .author-avatar img { width: 100%; height: 100%; object-fit: cover; }
    .author-role-badge {
      font-size: 0.75rem;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.08em;
      color: var(--accent);
      background: rgba(255,255,255,0.06);
      padding: 4px 12px;
      border-radius: 9999px;
      border: 1px solid var(--border);
    }
    .author-quote {
      font-family: var(--font-serif);
      font-style: italic;
      font-size: 1.25rem;
      color: var(--text);
      line-height: 1.6;
      margin-bottom: 20px;
      padding-left: 20px;
      border-left: 3px solid var(--accent);
    }
    @media (max-width: 800px) {
      .author-quote { padding-left: 0; border-left: none; }
    }
    .author-bio-text {
      color: var(--text-muted);
      line-height: 1.8;
      font-size: 1.05rem;
      white-space: pre-line;
    }

    /* Praise & Reviews */
    .reviews-section {
      padding: 70px 0;
    }
    .reviews-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
      gap: 28px;
      margin-top: 32px;
    }
    .review-card {
      padding: 28px;
      border-radius: 20px;
      background: var(--surface);
      border: 1px solid var(--border);
      box-shadow: 0 4px 16px rgba(0,0,0,0.03);
    }
    .stars { color: #f59e0b; font-size: 1.1rem; margin-bottom: 8px; }
    .quote { font-style: italic; color: var(--text); margin-bottom: 16px; line-height: 1.5; font-size: 0.95rem; }
    .reviewer { font-weight: 700; font-size: 0.875rem; color: var(--text); }
    .outlet { font-size: 0.75rem; color: var(--text-muted); }

    /* Synopsis Section */
    .synopsis-section {
      padding: 80px 0;
      background: var(--surface-2);
      border-top: 1px solid var(--border);
      border-bottom: 1px solid var(--border);
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
      max-width: 840px;
      white-space: pre-line;
    }

    /* Sample Chapter Reader */
    .reader-section {
      padding: 70px 0;
      background: var(--surface);
      border-bottom: 1px solid var(--border);
    }
    .reader-box {
      background: var(--surface-2);
      border: 1px solid var(--border);
      border-radius: 24px;
      padding: 44px;
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

    /* Author Newsletter / Inner Circle Club */
    .newsletter-section {
      padding: 80px 0;
      position: relative;
    }
    .newsletter-card {
      max-width: 760px;
      margin: 0 auto;
      text-align: center;
      background: linear-gradient(135deg, var(--surface), var(--surface-2));
      border: 2px solid var(--accent);
      border-radius: 28px;
      padding: 56px 40px;
      box-shadow: 0 20px 50px -10px ${accent}25;
    }
    .newsletter-badge {
      display: inline-block;
      padding: 4px 14px;
      background: var(--accent);
      color: #fff;
      font-size: 0.75rem; font-weight: 700;
      letter-spacing: 0.08em; text-transform: uppercase;
      border-radius: 9999px;
      margin-bottom: 16px;
    }
    .newsletter-title {
      font-family: var(--font-serif);
      font-size: 2rem;
      margin-bottom: 12px;
      letter-spacing: -0.01em;
    }
    .newsletter-desc {
      color: var(--text-muted);
      font-size: 1.05rem;
      max-width: 580px;
      margin: 0 auto 32px;
      line-height: 1.6;
    }
    .newsletter-form {
      display: flex;
      gap: 12px;
      max-width: 520px;
      margin: 0 auto;
    }
    @media (max-width: 600px) {
      .newsletter-form { flex-direction: column; }
    }
    .newsletter-input {
      flex: 1;
      background: var(--surface);
      border: 1px solid var(--border);
      border-radius: 12px;
      padding: 14px 20px;
      font-size: 1rem;
      color: var(--text);
      outline: none;
    }
    .newsletter-btn {
      background: var(--accent);
      color: #fff;
      border: none;
      padding: 14px 24px;
      border-radius: 12px;
      font-weight: 600;
      font-size: 1rem;
      cursor: pointer;
      white-space: nowrap;
      transition: opacity 0.2s;
    }
    .newsletter-btn:hover { opacity: 0.92; }

    /* Footer */
    footer {
      padding: 50px 0;
      border-top: 1px solid var(--border);
      text-align: center;
      color: var(--text-muted);
      font-size: 0.875rem;
      background: var(--surface);
    }
  </style>
</head>
<body>
  <header>
    <div class="container nav-inner">
      <div class="nav-brand">
        <span>${cleanAuthor}</span>
      </div>
      <nav class="nav-links">
        <a href="#book">The Book</a>
        <a href="#author">About the Author</a>
        <a href="#reviews">Praise</a>
        <a href="#excerpt">Excerpt</a>
        <a href="#newsletter">Inner Circle</a>
      </nav>
      <a href="#buy" class="nav-cta">${escapeHtml(input.ctaText || 'Get The Book')}</a>
    </div>
  </header>

  <main>
    <section id="book" class="hero">
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
    <section id="reviews" class="reviews-section">
      <div class="container">
        <h2 class="section-title" style="text-align: center; margin-bottom: 8px;">Praise &amp; Acclaim</h2>
        <p style="text-align: center; color: var(--text-muted); font-size: 0.95rem;">What critics and fellow authors are saying</p>
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

    <!-- Author Profile - Prominent Author Focus -->
    <section id="author" class="author-section">
      <div class="container">
        <div class="author-card">
          <div class="author-profile-col">
            <div class="author-avatar">
              ${
                input.authorPhotoUrl
                  ? `<img src="${escapeHtml(input.authorPhotoUrl)}" alt="${cleanAuthor}" />`
                  : cleanAuthor.charAt(0)
              }
            </div>
            <span class="author-role-badge">Featured Author</span>
          </div>

          <div>
            <h2 class="section-title" style="margin-bottom: 8px;">Meet ${cleanAuthor}</h2>
            <blockquote class="author-quote">“${cleanAuthorQuote}”</blockquote>
            <p class="author-bio-text">${cleanBio}</p>
          </div>
        </div>
      </div>
    </section>

    <!-- Sample Chapter Reader -->
    <section id="excerpt" class="reader-section">
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

    <!-- Author Newsletter / Reader Magnet Club -->
    <section id="newsletter" class="newsletter-section">
      <div class="container">
        <div class="newsletter-card">
          <span class="newsletter-badge">Reader Club</span>
          <h2 class="newsletter-title">${cleanNewsletterHeading}</h2>
          <p class="newsletter-desc">${cleanNewsletterIncentive}</p>
          <form class="newsletter-form" onsubmit="event.preventDefault(); document.getElementById('nl-msg').style.display='block'; this.style.display='none';">
            <input type="email" placeholder="Enter your email address..." required class="newsletter-input" />
            <button type="submit" class="newsletter-btn">Join Inner Circle</button>
          </form>
          <p id="nl-msg" style="display: none; margin-top: 16px; color: var(--accent); font-weight: 600;">✓ Thank you for subscribing! Your welcome gift is on its way.</p>
        </div>
      </div>
    </section>
  </main>

  <footer>
    <div class="container">
      <p>&copy; ${new Date().getFullYear()} ${cleanAuthor}. All rights reserved.</p>
      <p style="margin-top: 6px; font-size: 0.8rem; opacity: 0.75;">Published with Publisher Toolkit</p>
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
