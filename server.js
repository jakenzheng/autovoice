const express = require('express');
const multer = require('multer');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const OpenAI = require('openai');
const { GoogleGenerativeAI } = require('@google/generative-ai');
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

// Supabase configuration
let supabase = null;
try {
    const supabaseUrl = process.env.SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_ANON_KEY;
    
    if (supabaseUrl && supabaseKey) {
        supabase = createClient(supabaseUrl, supabaseKey);
        console.log('✅ Supabase connected successfully');
    } else {
        console.log('⚠️  Supabase environment variables not found - running without database');
    }
} catch (error) {
    console.log('⚠️  Supabase connection failed - running without database');
}

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

// Configure multer for file uploads - Vercel compatible
const storage = multer.memoryStorage(); // Use memory storage for serverless

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
    fileSize: 100 * 1024 * 1024 // 100MB limit
  }
});

// Invoice processing function with exact prompt from requirements and retry logic
async function processInvoice(imageBuffer, filename = 'unknown') {
  const maxRetries = 3;
  const baseDelay = 1000; // 1 second base delay
  
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      // Convert buffer to base64
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
        console.log(`🤖 AI Extracted data for ${filename}:`, {
          parts: validatedData.parts,
          labor: validatedData.labor,
          tax: validatedData.tax,
          flagged: validatedData.flagged,
          confidence: validatedData.confidence
        });
        console.log(`📝 Raw AI response:`, text);
        
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

// Import authentication routes
const authRoutes = require('./routes/auth');

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

// Authentication API routes
app.use('/api/auth', authRoutes);

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    supabase: supabase ? 'connected' : 'not configured',
    environment: process.env.NODE_ENV || 'development'
  });
});

// Test upload endpoint for debugging
app.post('/test-upload', upload.single('test'), (req, res) => {
  console.log('🧪 Test upload received:', {
    file: req.file,
    body: req.body
  });
  res.json({ 
    message: 'Test upload successful',
    file: req.file ? req.file.originalname : 'No file',
    body: req.body
  });
});

app.post('/upload', upload.array('invoices', 50), async (req, res) => {
  try {
    console.log('📤 Upload request received:', {
      body: req.body,
      files: req.files ? req.files.length : 'undefined',
      contentType: req.headers['content-type']
    });
    
    // Check if OpenAI API key is configured
    if (!process.env.OPENAI_API_KEY) {
      console.error('❌ OpenAI API key not configured');
      return res.status(500).json({ error: 'OpenAI API key not configured' });
    }
    
    // Check if Supabase is available
    if (!supabase) {
      console.log('⚠️  Supabase not configured, proceeding without database');
    }
    
    if (!req.files || req.files.length === 0) {
      console.log('❌ No files in request');
      return res.status(400).json({ error: 'No files uploaded' });
    }

    // Create batch record if Supabase is available
    let batchId = null;
    if (supabase) {
      try {
        const { data: batch, error: batchError } = await supabase
          .from('batches')
          .insert({
            batch_name: `Batch ${new Date().toLocaleDateString()}`,
            description: `Invoice batch processed on ${new Date().toLocaleString()}`,
            status: 'processing',
            total_invoices: req.files.length,
            processed_invoices: 0,
            total_parts: 0,
            total_labor: 0,
            total_tax: 0,
            flagged_count: 0
          })
          .select()
          .single();

        if (batchError) {
          console.log('Could not create batch record:', batchError);
        } else {
          batchId = batch.id;
          console.log('Created batch:', batchId);
        }
      } catch (error) {
        console.log('Batch creation failed:', error);
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
      
      try {
        const result = await processInvoice(file.buffer, file.originalname);
        
        if (result.success) {
        const data = result.data;
        
        // Add file info
        data.filename = file.originalname;
        
        results.push(data);
        
        // Store file record in Supabase if available
        if (supabase && batchId) {
          try {
            console.log('📊 Storing in Supabase:', {
              filename: file.originalname,
              parts: data.parts,
              labor: data.labor,
              tax: data.tax,
              flagged: data.flagged,
              confidence: data.confidence
            });
            
            await supabase
              .from('files')
              .insert({
                batch_id: batchId,
                original_filename: file.originalname,
                file_size: file.size,
                mime_type: file.mimetype,
                image_url: null, // No file storage on Vercel
                extracted_parts: data.parts, // Store actual AI result, not parsed
                extracted_labor: data.labor, // Store actual AI result, not parsed
                extracted_tax: data.tax, // Store actual AI result (could be string or number)
                is_flagged: data.flagged,
                confidence_level: data.confidence,
                processing_metadata: {
                  processing_time: Date.now(),
                  ai_model: 'gpt-4o',
                  raw_ai_response: result.raw // Store the actual AI response for debugging
                },
                processing_completed_at: new Date().toISOString()
              });
            console.log('✅ Supabase record stored successfully');
          } catch (error) {
            console.log('❌ Could not store file record:', error);
          }
        }
        
        // Calculate totals (excluding flagged documents)
        if (!data.flagged) {
          totalParts += data.parts || 0; // Use actual AI result
          totalLabor += data.labor || 0; // Use actual AI result
          
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
            error: result.error,
            flagged: true,
            quotaExceeded: result.quotaExceeded || false
          });
          flaggedCount++;
        }
      } catch (processingError) {
        console.error(`❌ Error processing ${file.originalname}:`, processingError);
        results.push({
          filename: file.originalname,
          error: processingError.message || 'Processing failed',
          flagged: true
        });
        flaggedCount++;
      }
    }

    // Update batch status if Supabase is available
    if (supabase && batchId) {
      try {
        await supabase
          .from('batches')
          .update({
            status: 'completed',
            processed_invoices: results.length,
            total_parts: parseFloat(totalParts.toFixed(2)),
            total_labor: parseFloat(totalLabor.toFixed(2)),
            total_tax: parseFloat(totalTax.toFixed(2)),
            flagged_count: flaggedCount,
            processing_completed_at: new Date().toISOString()
          })
          .eq('id', batchId);
      } catch (error) {
        console.log('Could not update batch status:', error);
      }
    }

    // No file cleanup needed with memory storage

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
      batchId: batchId,
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
  console.error('🚨 Server error:', error);
  
  if (error instanceof multer.MulterError) {
    console.error('📁 Multer error:', error.code, error.message);
    if (error.code === 'LIMIT_FILE_SIZE') {
      return res.status(400).json({ error: 'File too large. Maximum size is 100MB.' });
    } else if (error.code === 'LIMIT_FILE_COUNT') {
      return res.status(400).json({ error: 'Too many files. Maximum is 50.' });
    } else if (error.code === 'LIMIT_UNEXPECTED_FILE') {
      return res.status(400).json({ error: 'Unexpected file field.' });
    }
    return res.status(400).json({ error: `File upload error: ${error.message}` });
  }
  
  res.status(500).json({ error: error.message });
});

app.listen(PORT, () => {
  console.log(`🚗 Invoice Classifier running on http://localhost:${PORT}`);
  console.log(`✨ Luxury automotive invoice processing ready with OpenAI GPT-4 Vision`);
  console.log(`📊 Processing up to 50 invoices per batch`);
  if (supabase) {
    console.log('✅ Supabase database integration enabled');
  } else {
    console.log('⚠️  Running without database storage');
  }
});
