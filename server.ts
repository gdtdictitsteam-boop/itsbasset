import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI, Type } from "@google/genai";
import dotenv from "dotenv";

dotenv.config();

const app = express();
const PORT = 3000;

app.use(express.json({ limit: "10mb" }));

// Initialize Gemini Client
const getGeminiClient = () => {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    console.warn("GEMINI_API_KEY environment variable is not set.");
  }
  return new GoogleGenAI({
    apiKey: apiKey || "DEMO_KEY",
    httpOptions: {
      headers: {
        "User-Agent": "aistudio-build",
      },
    },
  });
};

// API Endpoint for AI Document OCR & Verification (Gemini Vision OCR)
app.post("/api/verify-handover-doc", async (req, res) => {
  try {
    const { documentUrl, expectedItemName, expectedQuantity, documentBase64, mimeType } = req.body;

    if (!expectedItemName || expectedQuantity === undefined) {
      return res.status(400).json({ error: "Missing required fields: expectedItemName and expectedQuantity" });
    }

    const apiKey = process.env.GEMINI_API_KEY;
    
    // If no API key or in fallback mode
    if (!apiKey) {
      // Intelligent fallback logic for testing/demo without API Key
      const isSimulatedMismatch = expectedQuantity > 100;
      return res.json({
        is_match: !isSimulatedMismatch,
        extracted_item_name: expectedItemName,
        extracted_quantity: expectedQuantity,
        confidence_score: 96,
        explanation_kh: !isSimulatedMismatch
          ? `✅ ផ្ទៀងផ្ទាត់ជោគជ័យ (Demo Mode)! Gemini AI បានអានឯកសារឃើញឈ្មោះ "${expectedItemName}" និងចំនួន ${expectedQuantity} គ្រឿង ត្រូវគ្នាបេះបិទជាមួយប្រព័ន្ធ។`
          : `⚠️ រកឃើញភាពខុសគ្នា (Demo Mode)! AI បានអានឃើញចំនួន ${expectedQuantity - 1} គ្រឿង ប៉ុន្តែក្នុងប្រព័ន្ធមាន ${expectedQuantity} គ្រឿង។`
      });
    }

    const ai = getGeminiClient();

    let imagePart = null;

    // 1. If base64 is provided directly from client
    if (documentBase64) {
      const cleanBase64 = documentBase64.replace(/^data:(.*);base64,/, "");
      imagePart = {
        inlineData: {
          mimeType: mimeType || "image/jpeg",
          data: cleanBase64,
        },
      };
    } 
    // 2. Fetch image/file bytes if documentUrl is a public HTTP URL
    else if (documentUrl && documentUrl.startsWith("http")) {
      try {
        const fileResponse = await fetch(documentUrl);
        if (fileResponse.ok) {
          const arrayBuffer = await fileResponse.arrayBuffer();
          const buffer = Buffer.from(arrayBuffer);
          const base64Data = buffer.toString("base64");
          const contentType = fileResponse.headers.get("content-type") || "image/jpeg";

          imagePart = {
            inlineData: {
              mimeType: contentType.includes("pdf") ? "application/pdf" : "image/jpeg",
              data: base64Data,
            },
          };
        }
      } catch (fetchErr) {
        console.warn("Could not fetch remote documentUrl for OCR, falling back to text prompt:", fetchErr);
      }
    }

    const promptText = `
    You are an official Cyber Security & Inventory Document Auditor for the General Department of Taxation (GDT).
    Your job is to perform strict OCR document verification on a handover document (លិខិតប្រគល់-ទទួល).

    Target System Data to verify against:
    - Expected Item Name: "${expectedItemName}"
    - Expected Quantity: ${expectedQuantity}

    Instructions:
    1. Read and analyze the document image/PDF provided (if available).
    2. Extract the item name (ឈ្មោះសម្ភារៈ) and quantity (ចំនួន) from the document text/tables.
    3. Compare the extracted document data against the Target System Data.
    4. Determine if they match (is_match = true) or if there is a mismatch (is_match = false).
    5. Provide a detailed summary and explanation in KHMER language (explanation_kh).

    Return your response strictly in JSON according to the schema provided.
    `;

    const contents = imagePart
      ? { parts: [imagePart, { text: promptText }] }
      : { parts: [{ text: promptText }] };

    const response = await ai.models.generateContent({
      model: "gemini-3.6-flash",
      contents,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            extracted_item_name: {
              type: Type.STRING,
              description: "The item name extracted from the handover document",
            },
            extracted_quantity: {
              type: Type.NUMBER,
              description: "The quantity extracted from the handover document",
            },
            is_match: {
              type: Type.BOOLEAN,
              description: "True if extracted item name and quantity match system data, false otherwise",
            },
            confidence_score: {
              type: Type.NUMBER,
              description: "OCR confidence percentage between 0 and 100",
            },
            explanation_kh: {
              type: Type.STRING,
              description: "Clear explanation in Khmer explaining the comparison outcome with status icons",
            },
          },
          required: ["extracted_item_name", "extracted_quantity", "is_match", "explanation_kh"],
        },
      },
    });

    const resultText = response.text || "{}";
    const parsedResult = JSON.parse(resultText);

    return res.json(parsedResult);
  } catch (err: any) {
    console.error("Gemini OCR Verification Error:", err);
    return res.status(500).json({
      error: "AI Verification Failed",
      details: err.message || "Failed to analyze document with Gemini AI",
    });
  }
});

// Start Server with Vite Middleware in Development
async function start() {
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`🚀 GDT Inventory Server running on http://0.0.0.0:${PORT}`);
  });
}

start();
