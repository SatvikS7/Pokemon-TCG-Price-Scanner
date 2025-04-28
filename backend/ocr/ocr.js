import Tesseract from "tesseract.js";

async function performOCRFromBuffer(buffer) {
  try {
    const result = await Tesseract.recognize(buffer, 'eng', {
      logger: (m) => console.log(m), // optional: shows progress
    });

    return result.data.text.trim(); // return extracted text
  } catch (error) {
    console.error("OCR failed:", error);
    return "";
  }
}

export { performOCRFromBuffer };