import { PDFDocument, rgb, StandardFonts } from 'pdf-lib'

export async function buildFixturePdf(): Promise<Buffer> {
  const doc = await PDFDocument.create()
  const font = await doc.embedFont(StandardFonts.Helvetica)

  const page = doc.addPage([400, 600])
  page.drawText('The Lazy Developer', { x: 40, y: 550, size: 24, font })
  page.drawText('by Jane Coder', { x: 40, y: 520, size: 14, font })
  page.drawRectangle({ x: 40, y: 300, width: 320, height: 180, color: rgb(0.2, 0.4, 0.8) })

  const backPage = doc.addPage([400, 600])
  backPage.drawText('A story about shipping less code.', { x: 40, y: 300, size: 12, font })

  return Buffer.from(await doc.save())
}
