import { GoogleGenerativeAI } from "@google/generative-ai";

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

async function run() {
  try {
    const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash-8b" });
    const result = await model.generateContent("hello");
    console.log("gemini-1.5-flash-8b:", result.response.text());
  } catch (e) {
    console.error("gemini-1.5-flash-8b error:", e.message);
  }

  try {
    const model = genAI.getGenerativeModel({
      model: "gemini-1.5-flash-latest",
    });
    const result = await model.generateContent("hello");
    console.log("gemini-1.5-flash-latest:", result.response.text());
  } catch (e) {
    console.error("gemini-1.5-flash-latest error:", e.message);
  }

  try {
    const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });
    const result = await model.generateContent("hello");
    console.log("gemini-2.5-flash:", result.response.text());
  } catch (e) {
    console.error("gemini-2.5-flash error:", e.message);
  }
}

run();
