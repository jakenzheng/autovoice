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
- **Multi-format Support**: JPG, PNG, GIF, BMP, TIFF (up to 10MB each)
- **Batch Processing**: Upload up to 50 documents simultaneously
- **AI-Powered Analysis**: OpenAI GPT-4 Vision for precise data extraction
- **Real-time Progress**: Socket.io real-time updates with progress tracking
- **Image Optimization**: Sharp.js for thumbnail generation and optimization

### Data Extraction & Management
- **Parts Cost**: Automatic detection of parts/total amounts
- **Labor Charges**: Identification of labor costs when present
- **Tax Information**: Tax amount extraction with validation
- **Confidence Scoring**: High/Medium/Low confidence levels
- **Flagged Documents**: Automatic flagging for review when needed
- **Editable Results**: Inline editing of extracted data with real-time updates
- **Batch Management**: Organize documents into batches with metadata

### User Authentication & Management
- **Supabase Auth**: Secure user authentication and management
- **User Profiles**: Individual user accounts with data isolation
- **Session Management**: Persistent login sessions
- **Row Level Security**: Database-level security for user data

### Analytics & Reporting
- **Real-time Analytics**: Live pie charts showing parts vs labor distribution
- **Batch History**: Complete history of all processed batches
- **Monthly Breakdown**: Month-by-month analytics with charts
- **Export Functionality**: CSV export of batch data and analytics
- **Filtering & Search**: Advanced filtering by date, status, and batch

### User Experience
- **Drag & Drop**: Intuitive file upload with visual feedback
- **Responsive Design**: Optimized for desktop and mobile devices
- **Navigation Menu**: Clean header navigation between sections
- **Image Preview**: Modal viewing of original documents with thumbnails
- **Toast Notifications**: Elegant status feedback
- **Processing Status**: Real-time progress indicators

## 🛠️ Technical Stack

### Frontend
- **HTML5**: Semantic markup with accessibility focus
- **CSS3**: Custom properties, Grid, Flexbox, and advanced animations
- **JavaScript (ES6+)**: Modern async/await patterns and class-based architecture
- **Chart.js**: Interactive data visualization
- **Socket.io Client**: Real-time communication
- **Moment.js**: Date handling and formatting
- **Geist Sans**: Premium typography from Vercel
- **SVG Icons**: Custom royal emblem iconography

### Backend
- **Node.js**: Server-side JavaScript runtime
- **Express.js**: Web application framework
- **Socket.io**: Real-time bidirectional communication
- **Multer**: File upload handling
- **Sharp.js**: Image processing and optimization
- **OpenAI API**: GPT-4 Vision for document analysis
- **Supabase**: Authentication, database, and storage
- **CORS**: Cross-origin resource sharing

### Database
- **PostgreSQL**: Primary database via Supabase
- **Row Level Security**: User data isolation
- **Real-time Subscriptions**: Live data updates
- **Storage**: File storage with automatic cleanup

## 📦 Installation

1. **Clone the repository**
   ```bash
   git clone https://github.com/jakenzheng/autovoice.git
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
   
   Edit `.env` and add your API keys:
   ```
   OPENAI_API_KEY=your_openai_api_key_here
   SUPABASE_URL=your_supabase_project_url_here
   SUPABASE_ANON_KEY=your_supabase_anon_key_here
   PORT=3000
   NODE_ENV=development
   ```

4. **Database setup**
   ```bash
   # Run the database setup script in your Supabase SQL editor
   # Copy the contents of database-setup.sql
   ```

5. **Start the application**
   ```bash
   npm start
   ```

6. **Access the application**
   Open your browser to `http://localhost:3000`

## 🚀 Deployment

### Vercel Deployment (Recommended)

1. **Connect to Vercel**
   ```bash
   vercel
   ```

2. **Set environment variables in Vercel dashboard**
   - `OPENAI_API_KEY`
   - `SUPABASE_URL`
   - `SUPABASE_ANON_KEY`

3. **Deploy**
   ```bash
   vercel --prod
   ```

### Environment Variables for Production

| Variable | Description | Required |
|----------|-------------|----------|
| `OPENAI_API_KEY` | OpenAI API key for document analysis | Yes |
| `SUPABASE_URL` | Supabase project URL | Yes |
| `SUPABASE_ANON_KEY` | Supabase anonymous key | Yes |
| `PORT` | Server port | No (default: 3000) |
| `NODE_ENV` | Environment mode | No (default: development) |

## 🎯 Usage

### Getting Started

1. **Register/Login**: Create an account or sign in
2. **Upload Documents**: Use the upload section to process invoices
3. **View Analytics**: Check the analytics dashboard for insights
4. **Review History**: Access your processing history and exports

### Uploading Documents

1. **Single File**: Click "Single Image" to select one document
2. **Multiple Files**: Click "Multiple Images" to select several documents
3. **Drag & Drop**: Drag files directly onto the upload area
4. **Batch Naming**: Add a name and description for your batch
5. **File Validation**: Only image files under 10MB are accepted

### Processing Workflow

1. **File Selection**: Choose your invoice images
2. **Batch Setup**: Name and describe your batch
3. **Processing**: AI analyzes documents with real-time progress
4. **Review Results**: View extracted data with confidence levels
5. **Edit if Needed**: Modify any extracted data inline
6. **Export**: Download results as CSV for further analysis

### Understanding Results

- **Summary Cards**: Overview of total parts, labor, tax, and processed count
- **Detailed Table**: Individual document results with confidence levels
- **Editable Fields**: Click any value to edit and update totals
- **Status Indicators**: 
  - ✅ Success: Clean extraction
  - ⚠️ Flagged: Requires review
  - ❌ Error: Processing failed
- **Confidence Levels**:
  - High: Consistent extraction across multiple scans
  - Medium: Minor variations detected
  - Low: Significant uncertainty

### Analytics Dashboard

- **Pie Chart**: Visual breakdown of parts vs labor distribution
- **Batch Summary**: Total counts and amounts
- **Real-time Updates**: Live data as you process documents

### History Section

- **Batch History**: Complete list of all processed batches
- **Monthly Analytics**: Month-by-month breakdown with charts
- **Filtering**: Filter by date range and status
- **Export All**: Download comprehensive batch data

## 🎨 Design System

### Color Palette
```css
--royal-paper: #FDFBF5;    /* Premium paper background */
--royal-black: #1a1a1a;    /* Primary text and elements */
--royal-gray: #333333;     /* Secondary text and hover states */
--royal-white: #FFFFFF;    /* Card backgrounds */
--parts-blue: #3B82F6;     /* Parts data visualization */
--labor-red: #EF4444;      /* Labor data visualization */
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
| `SUPABASE_URL` | Supabase project URL | Required |
| `SUPABASE_ANON_KEY` | Supabase anonymous key | Required |
| `PORT` | Server port | 3000 |
| `NODE_ENV` | Environment mode | development |

### File Upload Limits

- **Maximum file size**: 10MB per file
- **Supported formats**: JPG, PNG, GIF, BMP, TIFF
- **Batch size**: Up to 50 files per upload
- **File retention**: Automatic cleanup after processing

## 🚀 Performance

### Optimizations

- **Font Loading**: Preconnect to Google Fonts for faster loading
- **Image Processing**: Sharp.js optimization and thumbnail generation
- **Memory Management**: Automatic file cleanup after processing
- **Real-time Updates**: Socket.io for live progress and data updates
- **Database Optimization**: Efficient queries with proper indexing
- **CSS Optimization**: Custom properties for consistent theming

### Browser Support

- **Modern Browsers**: Chrome 90+, Firefox 88+, Safari 14+, Edge 90+
- **Mobile**: iOS Safari 14+, Chrome Mobile 90+
- **Features**: CSS Grid, Flexbox, Custom Properties, ES6+, WebSockets

## 🔒 Security

- **Authentication**: Supabase Auth with JWT tokens
- **Row Level Security**: Database-level user data isolation
- **File Validation**: Strict MIME type and extension checking
- **Size Limits**: Enforced file size restrictions
- **Temporary Storage**: Files deleted after processing
- **CORS**: Configured for secure cross-origin requests
- **Input Sanitization**: Proper handling of user inputs
- **API Rate Limiting**: Protection against abuse

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
- Responsive charts and analytics

## 🎯 Future Enhancements

### Planned Features

- **Advanced Filtering**: Sort and filter results by multiple criteria
- **Batch Templates**: Predefined batch configurations
- **API Integration**: RESTful API for external access
- **Advanced Analytics**: Machine learning insights and trends
- **Multi-language Support**: Internationalization
- **Dark Mode**: Alternative color scheme
- **Mobile App**: Native mobile application

### Design Improvements

- **Micro-interactions**: Enhanced hover and focus states
- **Loading Skeletons**: Improved loading experiences
- **Accessibility**: WCAG 2.1 AA compliance
- **Custom Themes**: User-configurable color schemes
- **Advanced Charts**: More sophisticated data visualization

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
- Ensure proper error handling and user feedback

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🙏 Acknowledgments

- **Geist Sans**: Beautiful typography by Vercel
- **OpenAI**: Powerful AI capabilities for document analysis
- **Supabase**: Excellent backend-as-a-service platform
- **Chart.js**: Interactive data visualization library
- **Socket.io**: Real-time communication framework
- **Design Inspiration**: Royal calligraphy and master craftsmanship
- **Open Source Community**: Tools and libraries that make this possible

---

*Built with precision, designed with clarity, crafted for excellence.*

## 🔗 Live Demo

**Production URL**: https://autonvoice.vercel.app

*Note: This application uses Vercel deployment protection. Access through the Vercel dashboard or contact the administrator for access.*
