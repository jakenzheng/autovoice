# Invoice Classifier - Royal Clarity

A sophisticated document analysis application built with the "Royal Clarity" design philosophy. This application processes automotive invoices using AI to extract parts, labor, and tax information with precision and elegance.

## 🎨 Design Philosophy: Royal Clarity

The interface embodies the philosophy of "Royal Clarity" - imagine a master artisan or calligrapher designing a digital ledger for a modern monarchy. Every element serves a purpose and feels intentionally placed, creating a "one-two punch to the face" of clarity and elegance.

### Visual Aesthetic

- **Material Background**: Premium uncoated paper stock (#FDFBF5) with ultra-fine grain texture
- **Typography**: Geist Sans exclusively, executed with master typesetter precision
- **Color Palette**: Stark contrast with deep near-black (#1a1a1a) and subtle grays (#333333)
- **Icons**: Bespoke royal emblems with sharp, chiseled, engraved aesthetic
- **Shadows**: Subtle, diffused drop-shadows that create tangible depth
- **Animations**: Minimal micro-interactions felt more than seen

### Key Design Principles

1. **Precision Typography**: Strict typographic scale with optimized letter-spacing
2. **Royal Emblems**: Custom SVG icons replacing generic corporate symbols
3. **Material Depth**: Subtle shadows and textures creating physical presence
4. **State Changes**: Communicated through shadow shifts and border weight changes
5. **Minimal Animations**: Quick, gentle ease-out transitions (0.2s)

## 🚀 Features

### Document Processing
- **Multi-format Support**: JPG, PNG, GIF, BMP, TIFF (up to 100MB each)
- **Batch Processing**: Upload up to 50 documents simultaneously
- **AI-Powered Analysis**: OpenAI GPT-4 Vision for precise data extraction
- **Real-time Progress**: Elegant loading states with progress tracking

### Data Extraction
- **Parts Cost**: Automatic detection of parts/total amounts
- **Labor Charges**: Identification of labor costs when present
- **Tax Information**: Tax amount extraction with validation
- **Confidence Scoring**: High/Medium/Low confidence levels
- **Flagged Documents**: Automatic flagging for review when needed

### User Experience
- **Drag & Drop**: Intuitive file upload with visual feedback
- **Responsive Design**: Optimized for desktop and mobile devices
- **Export Functionality**: CSV export of processed results
- **Image Preview**: Modal viewing of original documents
- **Toast Notifications**: Elegant status feedback

## 🛠️ Technical Stack

### Frontend
- **HTML5**: Semantic markup with accessibility focus
- **CSS3**: Custom properties, Grid, Flexbox, and advanced animations
- **JavaScript (ES6+)**: Modern async/await patterns and class-based architecture
- **Geist Sans**: Premium typography from Vercel
- **SVG Icons**: Custom royal emblem iconography

### Backend
- **Node.js**: Server-side JavaScript runtime
- **Express.js**: Web application framework
- **Multer**: File upload handling
- **OpenAI API**: GPT-4 Vision for document analysis
- **CORS**: Cross-origin resource sharing

## 📦 Installation

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd invoice-classifier
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Environment setup**
   ```bash
   cp env.example .env
   ```
   
   Edit `.env` and add your OpenAI API key:
   ```
   OPENAI_API_KEY=your_openai_api_key_here
   PORT=3000
   ```

4. **Start the application**
   ```bash
   npm start
   ```

5. **Access the application**
   Open your browser to `http://localhost:3000`

## 🎯 Usage

### Uploading Documents

1. **Single File**: Click "Single Image" to select one document
2. **Multiple Files**: Click "Multiple Images" to select several documents
3. **Drag & Drop**: Drag files directly onto the upload area
4. **File Validation**: Only image files under 100MB are accepted

### Processing Workflow

1. **File Selection**: Choose your invoice images
2. **Review**: Preview selected files before processing
3. **Processing**: AI analyzes documents with real-time progress
4. **Results**: View extracted data in an elegant summary
5. **Export**: Download results as CSV for further analysis

### Understanding Results

- **Summary Cards**: Overview of total parts, labor, tax, and processed count
- **Detailed Table**: Individual document results with confidence levels
- **Status Indicators**: 
  - ✅ Success: Clean extraction
  - ⚠️ Flagged: Requires review
  - ❌ Error: Processing failed
- **Confidence Levels**:
  - High: Consistent extraction across multiple scans
  - Medium: Minor variations detected
  - Low: Significant uncertainty

## 🎨 Design System

### Color Palette
```css
--royal-paper: #FDFBF5;    /* Premium paper background */
--royal-black: #1a1a1a;    /* Primary text and elements */
--royal-gray: #333333;     /* Secondary text and hover states */
--royal-white: #FFFFFF;    /* Card backgrounds */
```

### Typography Scale
```css
--text-xs: 0.75rem;        /* Labels, metadata */
--text-sm: 0.875rem;       /* Small text, captions */
--text-base: 1rem;         /* Body text */
--text-lg: 1.125rem;       /* Large body text */
--text-xl: 1.25rem;        /* Subheadings */
--text-2xl: 1.5rem;        /* Section headers */
--text-3xl: 1.875rem;      /* Large headers */
--text-4xl: 2.25rem;       /* Page titles */
```

### Spacing System
```css
--space-1: 0.25rem;        /* 4px */
--space-2: 0.5rem;         /* 8px */
--space-3: 0.75rem;        /* 12px */
--space-4: 1rem;           /* 16px */
--space-5: 1.25rem;        /* 20px */
--space-6: 1.5rem;         /* 24px */
--space-8: 2rem;           /* 32px */
--space-10: 2.5rem;        /* 40px */
--space-12: 3rem;          /* 48px */
--space-16: 4rem;          /* 64px */
--space-20: 5rem;          /* 80px */
```

### Shadow System
```css
--shadow-soft: 0 1px 3px rgba(26, 26, 26, 0.1);
--shadow-medium: 0 4px 6px rgba(26, 26, 26, 0.1);
--shadow-strong: 0 10px 15px rgba(26, 26, 26, 0.1);
--shadow-lift: 0 4px 12px rgba(26, 26, 26, 0.15);
```

## 🔧 Configuration

### Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `OPENAI_API_KEY` | OpenAI API key for document analysis | Required |
| `PORT` | Server port | 3000 |
| `GEMINI_API_KEY` | Google Gemini API key (future use) | Optional |

### File Upload Limits

- **Maximum file size**: 100MB per file
- **Supported formats**: JPG, PNG, GIF, BMP, TIFF
- **Batch size**: Up to 50 files per upload
- **File retention**: 1 hour (automatic cleanup)

## 🚀 Performance

### Optimizations

- **Font Loading**: Preconnect to Google Fonts for faster loading
- **Image Processing**: Efficient base64 encoding for AI analysis
- **Memory Management**: Automatic file cleanup after processing
- **Responsive Images**: Optimized modal viewing with max-height constraints
- **CSS Optimization**: Custom properties for consistent theming

### Browser Support

- **Modern Browsers**: Chrome 90+, Firefox 88+, Safari 14+, Edge 90+
- **Mobile**: iOS Safari 14+, Chrome Mobile 90+
- **Features**: CSS Grid, Flexbox, Custom Properties, ES6+

## 🔒 Security

- **File Validation**: Strict MIME type and extension checking
- **Size Limits**: Enforced file size restrictions
- **Temporary Storage**: Files deleted after processing
- **CORS**: Configured for secure cross-origin requests
- **Input Sanitization**: Proper handling of user inputs

## 📱 Responsive Design

The application is fully responsive with breakpoints at:

- **Desktop**: 1200px+ (full layout)
- **Tablet**: 768px - 1199px (adjusted spacing)
- **Mobile**: < 768px (stacked layout)

### Mobile Optimizations

- Touch-friendly button sizes
- Simplified navigation
- Optimized table scrolling
- Reduced padding and margins
- Larger tap targets

## 🎯 Future Enhancements

### Planned Features

- **Dark Mode**: Alternative color scheme
- **Advanced Filtering**: Sort and filter results
- **Batch Operations**: Bulk actions on results
- **Template Matching**: Custom invoice templates
- **API Integration**: RESTful API for external access
- **Analytics Dashboard**: Processing statistics and trends

### Design Improvements

- **Micro-interactions**: Enhanced hover and focus states
- **Loading Skeletons**: Improved loading experiences
- **Accessibility**: WCAG 2.1 AA compliance
- **Internationalization**: Multi-language support
- **Custom Themes**: User-configurable color schemes

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

### Development Guidelines

- Follow the Royal Clarity design philosophy
- Maintain consistent spacing and typography
- Use semantic HTML and accessible markup
- Write clean, documented JavaScript
- Test across different devices and browsers

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🙏 Acknowledgments

- **Geist Sans**: Beautiful typography by Vercel
- **OpenAI**: Powerful AI capabilities for document analysis
- **Design Inspiration**: Royal calligraphy and master craftsmanship
- **Open Source Community**: Tools and libraries that make this possible

---

*Built with precision, designed with clarity, crafted for excellence.*
