/** Multipart body for "Upload a cover": the fields POST /api/ads/projects reads for a book without a PDF. */
export function buildCoverUploadForm(input: { title: string; author: string; cover: File; insidePages: File[] }): FormData {
  const form = new FormData()
  form.append('title', input.title.trim())
  form.append('author', input.author.trim())
  form.append('frontCover', input.cover)
  // Inside pages feed A+ feature modules and the video ad's scenes.
  for (const page of input.insidePages) form.append('interiorImages', page)
  return form
}
