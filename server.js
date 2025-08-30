const express = require('express');
const multer = require('multer');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const OpenAI = require('openai');
const { GoogleGenerativeAI } = require('@google/generative-ai');
const helmet = require('helmet');
require('dotenv').config();

// Import authentication and data persistence modules
const authRoutes = require('./routes/auth');
const batchRoutes = require('./routes/batches');
const invoiceRoutes = require('./routes/invoices');
const analyticsRoutes = require('./routes/analytics');
const { supabase } = require('./supabase-config');

const app = express();
const PORT = process.env.PORT || 3000;

// Security middleware - temporarily disable CSP to fix font and script issues
app.use(helmet({
  contentSecurityPolicy: false
}));

// Middleware
app.use(cors({
  origin: process.env.NODE_ENV === 'production' 
    ? ['https://invoice-classifier-kqz3uci7u-jakenzhengs-projects.vercel.app']
    : true,
  credentials: true
}));
app.use(express.json({ limit: '10mb' }));
app.use(express.static('public'));

// OpenAI configuration
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// Gemini AI configuration (commented out for future use)
// const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || 'AIzaSyBf7ZEaaMJmvQyH1F5EinTkWTcNt6xK4t4');

// Configure multer for file uploads (memory storage for Vercel compatibility)
const upload = multer({
  storage: multer.memoryStorage(),
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
async function processInvoice(imageBuffer, filename = 'unknown') {
  const maxRetries = 3;
  const baseDelay = 1000; // 1 second base delay
  
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      // Convert image buffer to base64
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

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/batches', batchRoutes);
app.use('/api/invoices', invoiceRoutes);
app.use('/api/analytics', analyticsRoutes);

// Routes
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Note: File viewing is disabled in Vercel deployment due to memory storage

app.post('/upload', upload.array('invoices', 50), async (req, res) => {
  try {
    if (!req.files || req.files.length === 0) {
      return res.status(400).json({ error: 'No files uploaded' });
    }

    // Get user ID from Supabase Auth
    let userId = null;
    try {
        const { data: { user }, error } = await supabase.auth.getUser();
        if (user) {
            userId = user.id;
        }
    } catch (error) {
        console.error('Auth check error:', error);
    }

    const batchName = req.body.batchName || `Batch ${new Date().toLocaleDateString()}`;
    const description = req.body.description || '';

    // Create batch if user is authenticated
    let batchId = null;
    if (userId) {
      try {
        const { data: batch, error: batchError } = await supabase
          .from('batches')
          .insert({
            user_id: userId,
            batch_name: batchName,
            description: description,
            status: 'processing',
            total_invoices: req.files.length,
            processed_invoices: 0,
            summary: {
              totalParts: 0,
              totalLabor: 0,
              totalTax: 0,
              flaggedCount: 0
            }
          })
          .select('id')
          .single();

        if (batchError) {
          console.error('Batch creation error:', batchError);
        } else {
          batchId = batch.id;
        }
      } catch (error) {
        console.error('Batch creation error:', error);
      }
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
      
      const result = await processInvoice(file.buffer, file.originalname);
      
      if (result.success) {
        const data = result.data;
        
        // Add file info
        data.filename = file.originalname;
        data.filepath = null; // No file path with memory storage
        
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

        // Save invoice to database if user is authenticated
        if (userId && batchId) {
          try {
            await supabase
              .from('invoices')
              .insert({
                batch_id: batchId,
                user_id: userId,
                original_filename: file.originalname,
                file_size: file.size,
                mime_type: file.mimetype,
                image_url: null, // Will be updated when file storage is implemented
                thumbnail_url: null,
                extracted_data: {
                  parts: data.parts,
                  labor: data.labor,
                  tax: data.tax,
                  flagged: data.flagged,
                  confidence: data.confidence
                },
                processing_metadata: {
                  processedAt: new Date().toISOString(),
                  aiModel: 'gpt-4o',
                  processingTime: Date.now() - Date.now() // Placeholder
                }
              });
          } catch (error) {
            console.error('Invoice save error:', error);
          }
        }
      } else {
        results.push({
          filename: file.originalname,
          filepath: null, // No file path with memory storage
          error: result.error,
          flagged: true,
          quotaExceeded: result.quotaExceeded || false
        });
        flaggedCount++;
      }
    }

    // Update batch with final summary if user is authenticated
    if (userId && batchId) {
      try {
        const summary = {
          totalParts: parseFloat(totalParts.toFixed(2)),
          totalLabor: parseFloat(totalLabor.toFixed(2)),
          totalTax: parseFloat(totalTax.toFixed(2)),
          flaggedCount
        };

        await supabase
          .from('batches')
          .update({
            status: 'completed',
            processed_invoices: results.length,
            summary: summary,
            completed_at: new Date().toISOString()
          })
          .eq('id', batchId);
      } catch (error) {
        console.error('Batch update error:', error);
      }
    }

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
      summary,
      batchId: batchId
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
