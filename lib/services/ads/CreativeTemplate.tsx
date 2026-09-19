export function CreativeTemplate({
  coverImageUrl,
  title,
  author,
  width,
  height,
  palette,
  campaignBadge,
  ctaText,
}: {
  coverImageUrl: string
  title: string
  author: string
  width: number
  height: number
  palette: { background: string; ink: string; accent: string; secondary?: string }
  campaignBadge?: string
  ctaText?: string
}) {
  // Row layout for wide banners (e.g. 970x600, 970x300, 1200x628, 728x90); 300x250, 300x300 stack vertically.
  const isBanner = width / height >= 1.5
  const isCompact = width <= 360 && height <= 300
  const isUltraThin = height <= 120
  const scale = Math.min(width, height) / 1080

  // Book covers are standard portrait (~1:1.45 ratio). Avoid square-cropping full book covers.
  const coverHeight = isBanner
    ? isUltraThin
      ? height - 16
      : Math.round(height * 0.78)
    : isCompact
      ? Math.round(height * 0.42)
      : Math.round(Math.min(width, height) * 0.48)
  const coverWidth = Math.round(coverHeight * 0.68)

  const titleSize = isBanner
    ? isUltraThin
      ? Math.max(13, height * 0.2)
      : Math.max(20, Math.round(height * 0.075))
    : isCompact
      ? 15
      : Math.max(16, 56 * scale)
  const authorSize = isBanner
    ? isUltraThin
      ? Math.max(10, height * 0.14)
      : Math.max(13, Math.round(height * 0.045))
    : isCompact
      ? 11
      : Math.max(12, 30 * scale)
  const badgeSize = isBanner
    ? isUltraThin
      ? Math.max(9, height * 0.12)
      : Math.max(11, Math.round(height * 0.038))
    : isCompact
      ? 10
      : Math.max(11, 24 * scale)
  const ctaSize = isBanner
    ? isUltraThin
      ? Math.max(10, height * 0.15)
      : Math.max(13, Math.round(height * 0.042))
    : isCompact
      ? 11
      : Math.max(12, 28 * scale)

  return (
    <div
      style={{
        width,
        height,
        display: 'flex',
        flexDirection: isBanner ? 'row' : 'column',
        alignItems: 'center',
        justifyContent: 'center',
        background: palette.background,
        color: palette.ink,
        fontFamily: 'serif',
        padding: isUltraThin ? 10 : isBanner ? Math.max(20, Math.round(height * 0.08)) : isCompact ? 12 : Math.max(12, 40 * scale),
        gap: isUltraThin ? 16 : isBanner ? Math.max(24, Math.round(width * 0.04)) : isCompact ? 6 : Math.max(8, 28 * scale),
      }}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={coverImageUrl}
        width={coverWidth}
        height={coverHeight}
        style={{
          objectFit: 'contain',
          borderRadius: Math.max(3, 10 * scale),
          boxShadow: '0 14px 30px rgba(0,0,0,0.5)',
          border: `1px solid ${palette.secondary ?? 'rgba(255,255,255,0.15)'}`,
        }}
      />
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: isBanner ? 'flex-start' : 'center',
          gap: isUltraThin ? 4 : isBanner ? Math.max(8, Math.round(height * 0.025)) : isCompact ? 4 : Math.max(4, 12 * scale),
          maxWidth: isBanner ? (isUltraThin ? width - coverWidth - 220 : width - coverWidth - 80) : width * 0.9,
        }}
      >
        {campaignBadge && (
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: badgeSize,
              fontWeight: 700,
              letterSpacing: '0.08em',
              color: palette.accent,
              background: 'rgba(0,0,0,0.25)',
              border: `1px solid ${palette.accent}`,
              padding: isBanner ? '2px 8px' : `${Math.max(3, 8 * scale)}px ${Math.max(8, 18 * scale)}px`,
              borderRadius: 9999,
              textAlign: 'center',
            }}
          >
            {campaignBadge}
          </div>
        )}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: isBanner ? 'flex-start' : 'center',
            fontSize: titleSize,
            fontWeight: 700,
            lineHeight: 1.15,
            textAlign: isBanner ? 'left' : 'center',
          }}
        >
          {title}
        </div>
        <div style={{ display: 'flex', width: isBanner ? 28 : Math.max(32, 64 * scale), height: 3, background: palette.accent }} />
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: isBanner ? 'flex-start' : 'center',
            fontSize: authorSize,
            opacity: 0.85,
          }}
        >
          {author}
        </div>

        {ctaText && !isBanner && (
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              marginTop: Math.max(4, 8 * scale),
              fontSize: ctaSize,
              fontWeight: 700,
              letterSpacing: '0.04em',
              background: palette.accent,
              color: palette.background,
              padding: `${Math.max(6, 14 * scale)}px ${Math.max(14, 28 * scale)}px`,
              borderRadius: Math.max(6, 12 * scale),
              boxShadow: '0 4px 12px rgba(0,0,0,0.25)',
            }}
          >
            <span>{ctaText}</span>
            <svg
              width={Math.max(12, Math.round(ctaSize * 1.1))}
              height={Math.max(12, Math.round(ctaSize * 1.1))}
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
              style={{ marginLeft: 6, display: 'flex' }}
            >
              <line x1="5" y1="12" x2="19" y2="12" />
              <polyline points="12 5 19 12 12 19" />
            </svg>
          </div>
        )}
      </div>

      {ctaText && isBanner && (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            marginLeft: 'auto',
            fontSize: ctaSize,
            fontWeight: 700,
            background: palette.accent,
            color: palette.background,
            padding: '6px 14px',
            borderRadius: 8,
            whiteSpace: 'nowrap',
          }}
        >
          <span>{ctaText}</span>
          <svg
            width={Math.max(12, Math.round(ctaSize * 1.1))}
            height={Math.max(12, Math.round(ctaSize * 1.1))}
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
            style={{ marginLeft: 6, display: 'flex' }}
          >
            <line x1="5" y1="12" x2="19" y2="12" />
            <polyline points="12 5 19 12 12 19" />
          </svg>
        </div>
      )}
    </div>
  )
}
