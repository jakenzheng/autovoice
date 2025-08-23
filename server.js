const express = require('express');
const multer = require('multer');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const OpenAI = require('openai');
const { GoogleGenerativeAI } = require('@google/generative-ai');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static('public'));

// OpenAI configuration
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// Gemini AI configuration (commented out for future use)
// const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || 'AIzaSyBf7ZEaaMJmvQyH1F5EinTkWTcNt6xK4t4');

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadDir = 'uploads/';
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname));
  }
});

const upload = multer({ 
  storage: storage,
  fileFilter: (req, file, cb) => {
    const allowedTypes = /jpeg|jpg|png|gif|bmp|tiff/;
    const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
    const mimetype = allowedTypes.test(file.mimetype);
    
    if (mimetype && extname) {
      return cb(null, true);
    } else {
      cb(new Error('Only image files are allowed!'));
    }
  },
  limits: {
    fileSize: 10 * 1024 * 1024 // 10MB limit for Vercel compatibility
  }
});

// Invoice processing function with exact prompt from requirements and retry logic
async function processInvoice(imagePath, filename = 'unknown') {
  const maxRetries = 3;
  const baseDelay = 1000; // 1 second base delay
  
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      // Read image as base64
      const imageBuffer = fs.readFileSync(imagePath);
      const base64Image = imageBuffer.toString('base64');

      const prompt = `Analyze this invoice image completely and extract the following information in JSON format:

REQUIREMENTS:
1. PARTS (REQUIRED): Scan document for case insensitive strings contained within parts_list: ['parts', 'total', 'subtotal', 'sub-total', 'total due', 'invoice total']
   - If more than one label per list is identified, select the value with a label that is stack-ranked higher in the list (closer to the front)
   - Example: if both 'parts' and 'subtotal' exist, use value associated with 'parts' label
   - After first pass, confirm the assigned parts value is the most appropriate value corresponding to the amount of money spent on parts this invoice was created for
   - Extract monetary value (numbers only, no currency symbols)
   - If no parts value found, return 0.00

2. LABOR (OPTIONAL): Scan document for 'labor' (case insensitive)
   - Extract monetary value (numbers only, no currency symbols)
   - If no labor value found, return 0.00
   - Note: document might not include install/physical labor (e.g., ordering bulk parts from car dealership)

3. TAX (OPTIONAL): Scan document for 'tax' or 'sales tax' (case insensitive)
   - Extract monetary value (numbers only, no currency symbols)
   - If value is not a double/integer (e.g., "N/A", "Included"), store as string AND flag document for review
   - If no tax value found, return 0.00

4. FLAGGED: Set to true if:
   - Tax value is NOT 0.00 (any non-zero tax amount)
   - Tax value is not a number (string value)
   - Any extracted value seems incorrect or ambiguous
   - Document is unclear or unreadable

5. CONFIDENCE: Perform multiple scans and cross-validation:
   - Scan 1: Initial extraction of all values
   - Scan 2: Re-verify each number by looking for the same label again
   - Scan 3: Cross-reference with other similar labels to ensure consistency
   - If all 3 scans return the same values: "high" confidence
   - If 2 scans match but 1 differs: "medium" confidence  
   - If scans show significant variation or uncertainty: "low" confidence
   - Consider document clarity, number formatting, and label proximity

Return ONLY valid JSON in this exact format:
{
  "parts": number,
  "labor": number,
  "tax": number or string,
  "flagged": boolean,
  "confidence": "high|medium|low"
}`;

      // OpenAI GPT-4 Vision implementation
      const response = await openai.chat.completions.create({
        model: "gpt-4o",
        messages: [
          {
            role: "user",
            content: [
              {
                type: "text",
                text: prompt
              },
              {
                type: "image_url",
                image_url: {
                  url: `data:image/jpeg;base64,${base64Image}`
                }
              }
            ]
          }
        ],
        max_tokens: 500,
        temperature: 0.1
      });

      const result = response.choices[0].message.content;
      const text = result;
      
      // Gemini AI implementation (commented out for future use)
      // const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
      // const result = await model.generateContent([
      //   prompt,
      //   {
      //     inlineData: {
      //       mimeType: "image/jpeg",
      //       data: base64Image
      //     }
      //   }
      // ]);
      // const response = await result.response;
      // const text = response.text();
      
      // Clean the response text to extract JSON
      let jsonText = text.trim();
      
      // Remove markdown code blocks if present
      if (jsonText.startsWith('```json')) {
        jsonText = jsonText.replace(/^```json\s*/, '').replace(/\s*```$/, '');
      } else if (jsonText.startsWith('```')) {
        jsonText = jsonText.replace(/^```\s*/, '').replace(/\s*```$/, '');
      }
      
      // Try to parse JSON response
      try {
        const parsed = JSON.parse(jsonText);
        
        // Validate and normalize the response
        const validatedData = {
          parts: typeof parsed.parts === 'number' ? parsed.parts : parseFloat(parsed.parts) || 0.00,
          labor: typeof parsed.labor === 'number' ? parsed.labor : parseFloat(parsed.labor) || 0.00,
          tax: parsed.tax,
          flagged: false, // Will be set based on tax value
          confidence: parsed.confidence || 'medium'
        };
        
        // Set flagged to true if tax is NOT 0.00 (as per requirements)
        if (typeof validatedData.tax === 'number' && validatedData.tax !== 0.00) {
          validatedData.flagged = true;
        } else if (typeof validatedData.tax === 'string') {
          validatedData.flagged = true;
        }
        
        // Log the extracted data for debugging
        console.log(`Extracted data for ${filename}:`, {
          parts: validatedData.parts,
          labor: validatedData.labor,
          tax: validatedData.tax,
          flagged: validatedData.flagged,
          confidence: validatedData.confidence
        });
        
        return {
          success: true,
          data: validatedData,
          raw: text
        };
      } catch (parseError) {
        console.error('JSON Parse Error:', parseError);
        console.error('Raw Response:', text);
        console.error('Cleaned JSON Text:', jsonText);
        return {
          success: false,
          error: "Failed to parse AI response",
          raw: text
        };
      }

    } catch (error) {
      console.error(`Attempt ${attempt}/${maxRetries} failed for ${filename}:`, error.message);
      
      // Check if it's a quota/rate limit error
      if (error.message.includes('429') || error.message.includes('quota') || error.message.includes('rate limit') || error.message.includes('billing')) {
        if (attempt < maxRetries) {
          const delay = baseDelay * Math.pow(2, attempt - 1); // Exponential backoff
          console.log(`Rate limit hit. Waiting ${delay}ms before retry...`);
          await new Promise(resolve => setTimeout(resolve, delay));
          continue;
        } else {
          return {
            success: false,
            error: "API quota exceeded. Please try again later or upgrade your plan.",
            quotaExceeded: true
          };
        }
      }
      
      // For other errors, don't retry
      return {
        success: false,
        error: error.message
      };
    }
  }
}

// Routes
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Serve uploaded images
app.get('/uploads/:filename', (req, res) => {
  const filename = req.params.filename;
  const filepath = path.join(__dirname, 'uploads', filename);
  
  if (fs.existsSync(filepath)) {
    res.sendFile(filepath);
  } else {
    res.status(404).json({ error: 'File not found' });
  }
});

app.post('/upload', upload.array('invoices', 50), async (req, res) => {
  try {
    if (!req.files || req.files.length === 0) {
      return res.status(400).json({ error: 'No files uploaded' });
    }

    const results = [];
    let totalParts = 0;
    let totalLabor = 0;
    let totalTax = 0;
    let flaggedCount = 0;

    console.log(`Processing ${req.files.length} invoices...`);

    for (let i = 0; i < req.files.length; i++) {
      const file = req.files[i];
      console.log(`Processing file ${i + 1}/${req.files.length}: ${file.originalname}`);
      
      const result = await processInvoice(file.path, file.originalname);
      
      if (result.success) {
        const data = result.data;
        
        // Add file info
        data.filename = file.originalname;
        data.filepath = file.path;
        
        results.push(data);
        
        // Calculate totals (excluding flagged documents)
        if (!data.flagged) {
          totalParts += parseFloat(data.parts) || 0;
          totalLabor += parseFloat(data.labor) || 0;
          
          // Only add tax if it's a number
          if (typeof data.tax === 'number') {
            totalTax += data.tax;
          }
        } else {
          flaggedCount++;
        }
      } else {
        results.push({
          filename: file.originalname,
          filepath: file.path,
          error: result.error,
          flagged: true,
          quotaExceeded: result.quotaExceeded || false
        });
        flaggedCount++;
      }
    }

    // Store file paths for later viewing (don't delete immediately)
    req.files.forEach(file => {
      // Keep files for 1 hour, then clean up
      setTimeout(() => {
        if (fs.existsSync(file.path)) {
          fs.unlinkSync(file.path);
        }
      }, 60 * 60 * 1000); // 1 hour
    });

    const summary = {
      totalParts: parseFloat(totalParts.toFixed(2)),
      totalLabor: parseFloat(totalLabor.toFixed(2)),
      totalTax: parseFloat(totalTax.toFixed(2)),
      totalInvoices: results.length,
      flaggedCount,
      processedCount: results.length - flaggedCount
    };

    console.log('Processing complete. Summary:', summary);
    
    // Check if quota was exceeded
    const quotaExceededCount = results.filter(r => r.quotaExceeded).length;
    if (quotaExceededCount > 0) {
      console.log(`⚠️  ${quotaExceededCount} files failed due to API quota limit`);
    }

    res.json({
      success: true,
      results,
      summary
    });

  } catch (error) {
    console.error('Upload error:', error);
    res.status(500).json({ error: 'Server error processing invoices' });
  }
});

// Error handling middleware
app.use((error, req, res, next) => {
  if (error instanceof multer.MulterError) {
    if (error.code === 'LIMIT_FILE_SIZE') {
      return res.status(400).json({ error: 'File too large. Maximum size is 100MB.' });
    }
  }
  res.status(500).json({ error: error.message });
});

app.listen(PORT, () => {
  console.log(`🚗 Invoice Classifier running on http://localhost:${PORT}`);
  console.log(`✨ Luxury automotive invoice processing ready with OpenAI GPT-4 Vision`);
  console.log(`📊 Processing up to 50 invoices per batch`);
});
