# 🚗 Invoice Classifier Demo Guide

## Quick Demo Setup

### 1. Environment Setup
```bash
# Copy the environment example (includes pre-configured OpenAI API key)
cp env.example .env

# The application comes with a pre-configured OpenAI API key
# You can override it in .env if needed:
# OPENAI_API_KEY=your_custom_openai_api_key_here
```

### 2. Start the Application
```bash
npm start
```

### 3. Access the Application
Open your browser and navigate to: `http://localhost:3000`

## Demo Workflow

### Step 1: Upload Invoices
- **Drag & Drop**: Simply drag invoice images onto the upload area
- **Browse Files**: Click "Select Files" to choose invoice images
- **Supported Formats**: JPG, PNG, GIF, BMP, TIFF (max 10MB each)

### Step 2: Process Documents
- Click "Process Invoices" to start AI analysis
- Watch the elegant loading animation with progress tracking
- The system will analyze each invoice using OpenAI GPT-4 Vision

### Step 3: Review Results
- **Summary Cards**: View total parts, labor, and tax amounts
- **Detailed Table**: Examine individual invoice results
- **Flagged Documents**: Check documents that need manual review

### Step 4: Export Data
- Download results as CSV for further analysis
- Process new batches or reset the application

## Expected Results

### Successful Processing
- ✅ Parts values extracted with priority ranking
- ✅ Labor costs identified (if present)
- ✅ Tax amounts captured (numeric or string)
- ✅ Confidence levels assigned to each result

### Flagged Documents
- ⚠️ Documents with non-numeric tax values
- ⚠️ Unclear or ambiguous invoice data
- ⚠️ Processing errors or low confidence results

## Sample Invoice Data

The system is designed to extract:
- **Parts**: $1,250.00 (from "parts" or "total" fields)
- **Labor**: $350.00 (from "labor" field)
- **Tax**: $120.00 (from "tax" or "sales tax" field)

## Luxury Features

### Design Elements
- 🎨 Ferrari Red (#FF2800) primary color
- 🏆 Ferrari Gold (#D4AF37) accents
- ⚫ Audemars Piguet Black backgrounds
- 🍎 Apple UI/UX principles

### User Experience
- ✨ Smooth animations and transitions
- 📱 Responsive design for all devices
- 🎯 Intuitive drag & drop interface
- 🔄 Real-time progress tracking

## Troubleshooting

### Common Issues
1. **API Key Error**: The app comes with a pre-configured OpenAI API key, but you can override it in .env if needed
2. **File Upload Issues**: Check file size (max 10MB) and format
3. **Processing Errors**: Verify invoice images are clear and readable

### Support
- Check the browser console for detailed error messages
- Review the README.md for comprehensive documentation
- Ensure all dependencies are properly installed

---

**Ready to revolutionize your invoice processing workflow! 🚀**
