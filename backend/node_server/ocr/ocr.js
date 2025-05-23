import Tesseract from "tesseract.js";

async function performOCRFromBuffer(buffer) {
  try {
    const result = await Tesseract.recognize(buffer, 'eng', {
      logger: (m) => console.log(m),
      tessedit_pageseg_mode: '7',
      tessedit_ocr_engine_mode: '3',
      tessedit_char_whitelist: '0123456789/',
    });

    return result.data.text.trim(); 
  } catch (error) {
    console.error("OCR failed:", error);
    return "";
  }
}

export { performOCRFromBuffer };