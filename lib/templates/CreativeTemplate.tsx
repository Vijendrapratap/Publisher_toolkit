export function CreativeTemplate({
  coverImageUrl,
  title,
  author,
  width,
  height,
}: {
  coverImageUrl: string
  title: string
  author: string
  width: number
  height: number
}) {
  // Row layout only for genuinely wide/short banner shapes (e.g. 728x90).
  // A squarish or portrait size like 300x250 needs the stacked/column layout.
  const isBanner = width / height >= 2
  return (
    <div
      style={{
        width,
        height,
        display: 'flex',
        flexDirection: isBanner ? 'row' : 'column',
        alignItems: 'center',
        justifyContent: 'center',
        background: '#111827',
        color: 'white',
        fontFamily: 'sans-serif',
        padding: 16,
        gap: 12,
      }}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={coverImageUrl}
        width={isBanner ? height - 32 : Math.min(width, height) * 0.6}
        height={isBanner ? height - 32 : Math.min(width, height) * 0.6}
        style={{ objectFit: 'cover', borderRadius: 8 }}
      />
      <div style={{ display: 'flex', flexDirection: 'column' }}>
        <div style={{ fontSize: isBanner ? 16 : 28, fontWeight: 700 }}>{title}</div>
        <div style={{ fontSize: isBanner ? 12 : 18, opacity: 0.8 }}>{author}</div>
      </div>
    </div>
  )
}
