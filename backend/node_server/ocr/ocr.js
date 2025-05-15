import Tesseract from "tesseract.js";

async function performOCRFromBuffer(buffer) {
  try {
    const result = await Tesseract.recognize(buffer, 'eng', {
      logger: (m) => console.log(m),
    });

    return result.data.text.trim(); 
  } catch (error) {
    console.error("OCR failed:", error);
    return "";
  }
}

export { performOCRFromBuffer };