import Tesseract from 'tesseract.js'

export async function ocrImage(file: File): Promise<string> {
  const { data } = await Tesseract.recognize(file, 'eng')
  return data.text?.trim() || ''
}
