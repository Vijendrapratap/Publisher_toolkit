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
  // Row layout only for genuinely wide banners (e.g. 728x90); 300x250 stacks.
  const isBanner = width / height >= 2
  const scale = Math.min(width, height) / 1080
  const coverSize = isBanner ? height - 20 : Math.min(width, height) * 0.52
  const titleSize = isBanner ? Math.max(13, height * 0.2) : Math.max(16, 56 * scale)
  const authorSize = isBanner ? Math.max(10, height * 0.14) : Math.max(12, 30 * scale)
  const badgeSize = isBanner ? Math.max(9, height * 0.12) : Math.max(11, 24 * scale)
  const ctaSize = isBanner ? Math.max(10, height * 0.15) : Math.max(12, 28 * scale)

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
        padding: isBanner ? 10 : Math.max(12, 40 * scale),
        gap: isBanner ? 16 : Math.max(8, 28 * scale),
      }}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={coverImageUrl}
        width={coverSize}
        height={coverSize}
        style={{
          objectFit: 'cover',
          borderRadius: Math.max(4, 14 * scale),
          boxShadow: '0 16px 36px rgba(0,0,0,0.45)',
          border: `1px solid ${palette.secondary ?? 'rgba(255,255,255,0.1)'}`,
        }}
      />
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: isBanner ? 'flex-start' : 'center',
          gap: isBanner ? 4 : Math.max(4, 12 * scale),
          maxWidth: isBanner ? width - coverSize - 200 : width * 0.88,
        }}
      >
        {campaignBadge && (
          <div
            style={{
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
        <div style={{ fontSize: titleSize, fontWeight: 700, lineHeight: 1.15, textAlign: isBanner ? 'left' : 'center' }}>
          {title}
        </div>
        <div style={{ display: 'flex', width: isBanner ? 28 : Math.max(32, 64 * scale), height: 3, background: palette.accent }} />
        <div style={{ fontSize: authorSize, opacity: 0.85 }}>{author}</div>

        {ctaText && !isBanner && (
          <div
            style={{
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
            {ctaText} ➔
          </div>
        )}
      </div>

      {ctaText && isBanner && (
        <div
          style={{
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
          {ctaText} ➔
        </div>
      )}
    </div>
  )
}
