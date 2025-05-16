import Tesseract from "tesseract.js";

async function performOCRFromBuffer(buffer) {
  try {
    const result = await Tesseract.recognize(buffer, 'eng', {
      logger: (m) => console.log(m),
      config: 'tessedit_char_whitelist=0123456789/ --psm 7'
    });

    return result.data.text.trim(); 
  } catch (error) {
    console.error("OCR failed:", error);
    return "";
  }
}

export { performOCRFromBuffer };