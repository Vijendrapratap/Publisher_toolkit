export function CreativeTemplate({
  coverImageUrl,
  title,
  author,
  width,
  height,
  palette,
}: {
  coverImageUrl: string
  title: string
  author: string
  width: number
  height: number
  palette: { background: string; ink: string; accent: string }
}) {
  // Row layout only for genuinely wide banners (e.g. 728x90); 300x250 stacks.
  const isBanner = width / height >= 2
  const scale = Math.min(width, height) / 1080
  const coverSize = isBanner ? height - 24 : Math.min(width, height) * 0.58
  const titleSize = isBanner ? Math.max(14, height * 0.22) : Math.max(16, 64 * scale)
  const authorSize = isBanner ? Math.max(11, height * 0.15) : Math.max(12, 34 * scale)

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
        padding: isBanner ? 12 : Math.max(12, 48 * scale),
        gap: isBanner ? 14 : Math.max(8, 36 * scale),
      }}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={coverImageUrl}
        width={coverSize}
        height={coverSize}
        style={{ objectFit: 'cover', borderRadius: Math.max(4, 16 * scale), boxShadow: '0 12px 32px rgba(0,0,0,0.35)' }}
      />
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: isBanner ? 'flex-start' : 'center', gap: 6 }}>
        <div style={{ fontSize: titleSize, fontWeight: 700, lineHeight: 1.1, textAlign: isBanner ? 'left' : 'center' }}>
          {title}
        </div>
        <div style={{ display: 'flex', width: isBanner ? 32 : 64 * scale + 16, height: 3, background: palette.accent }} />
        <div style={{ fontSize: authorSize, opacity: 0.85 }}>{author}</div>
      </div>
    </div>
  )
}
