-- AutoVoice Invoice Classifier Database Schema
-- Enhanced batch management with comprehensive tracking and export capabilities

-- Enable necessary extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Users table (for authentication and user management)
CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    email VARCHAR(255) UNIQUE NOT NULL,
    first_name VARCHAR(100) NOT NULL,
    last_name VARCHAR(100) NOT NULL,
    business_name VARCHAR(255),
    is_active BOOLEAN DEFAULT TRUE,
    email_verified BOOLEAN DEFAULT FALSE,
    last_login TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Batches table (comprehensive batch management with export capabilities)
CREATE TABLE IF NOT EXISTS batches (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    batch_name VARCHAR(255) NOT NULL,
    description TEXT,
    status VARCHAR(50) DEFAULT 'processing' CHECK (status IN ('processing', 'completed', 'reviewing', 'failed')),
    total_invoices INTEGER DEFAULT 0,
    processed_invoices INTEGER DEFAULT 0,
    total_parts DECIMAL(10,2) DEFAULT 0.00,
    total_labor DECIMAL(10,2) DEFAULT 0.00,
    total_tax DECIMAL(10,2) DEFAULT 0.00,
    flagged_count INTEGER DEFAULT 0,
    processing_started_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    processing_completed_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    metadata JSONB DEFAULT '{}' -- Additional batch metadata
);

-- Files table (individual file storage with comprehensive tracking)
CREATE TABLE IF NOT EXISTS files (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    batch_id UUID REFERENCES batches(id) ON DELETE CASCADE,
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    original_filename VARCHAR(255) NOT NULL,
    file_size INTEGER,
    mime_type VARCHAR(100),
    image_url TEXT, -- Supabase Storage URL
    thumbnail_url TEXT, -- Base64 or Storage URL
    extracted_parts DECIMAL(10,2) DEFAULT 0.00,
    extracted_labor DECIMAL(10,2) DEFAULT 0.00,
    extracted_tax DECIMAL(10,2) DEFAULT 0.00,
    edited_parts DECIMAL(10,2), -- User edited value
    edited_labor DECIMAL(10,2), -- User edited value
    edited_tax DECIMAL(10,2), -- User edited value
    is_flagged BOOLEAN DEFAULT FALSE,
    confidence_level VARCHAR(20) DEFAULT 'medium' CHECK (confidence_level IN ('low', 'medium', 'high')),
    processing_metadata JSONB, -- Store AI processing details
    review_notes TEXT, -- Notes for flagged documents
    review_status VARCHAR(20) DEFAULT 'pending' CHECK (review_status IN ('pending', 'reviewed', 'approved', 'rejected')),
    processing_started_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    processing_completed_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Flagged documents review table
CREATE TABLE IF NOT EXISTS flagged_reviews (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    file_id UUID REFERENCES files(id) ON DELETE CASCADE,
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    review_notes TEXT,
    corrected_parts DECIMAL(10,2),
    corrected_labor DECIMAL(10,2),
    corrected_tax DECIMAL(10,2),
    review_status VARCHAR(20) DEFAULT 'pending' CHECK (review_status IN ('pending', 'approved', 'rejected')),
    reviewed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Batch exports table (for tracking export requests)
CREATE TABLE IF NOT EXISTS batch_exports (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    export_type VARCHAR(50) NOT NULL, -- 'all_batches', 'date_range', 'specific_batch'
    date_from TIMESTAMP WITH TIME ZONE,
    date_to TIMESTAMP WITH TIME ZONE,
    batch_ids UUID[], -- Array of specific batch IDs if applicable
    file_format VARCHAR(20) DEFAULT 'csv', -- 'csv', 'json', 'excel'
    status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed', 'failed')),
    download_url TEXT, -- URL to download the exported file
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    completed_at TIMESTAMP WITH TIME ZONE
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_created_at ON users(created_at);
CREATE INDEX IF NOT EXISTS idx_batches_user_id ON batches(user_id);
CREATE INDEX IF NOT EXISTS idx_batches_status ON batches(status);
CREATE INDEX IF NOT EXISTS idx_batches_created_at ON batches(created_at);
CREATE INDEX IF NOT EXISTS idx_batches_processing_completed_at ON batches(processing_completed_at);
CREATE INDEX IF NOT EXISTS idx_files_batch_id ON files(batch_id);
CREATE INDEX IF NOT EXISTS idx_files_user_id ON files(user_id);
CREATE INDEX IF NOT EXISTS idx_files_flagged ON files(is_flagged);
CREATE INDEX IF NOT EXISTS idx_files_created_at ON files(created_at);
CREATE INDEX IF NOT EXISTS idx_flagged_reviews_file_id ON flagged_reviews(file_id);
CREATE INDEX IF NOT EXISTS idx_batch_exports_user_id ON batch_exports(user_id);
CREATE INDEX IF NOT EXISTS idx_batch_exports_status ON batch_exports(status);

-- Create updated_at trigger function
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Apply triggers to update updated_at columns
CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON users FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_batches_updated_at BEFORE UPDATE ON batches FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_files_updated_at BEFORE UPDATE ON files FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Function to update batch totals when files are updated
CREATE OR REPLACE FUNCTION update_batch_totals()
RETURNS TRIGGER AS $$
BEGIN
    -- Update batch totals based on edited values or extracted values
    UPDATE batches 
    SET 
        total_parts = (
            SELECT COALESCE(SUM(
                CASE 
                    WHEN edited_parts IS NOT NULL THEN edited_parts 
                    ELSE extracted_parts 
                END
            ), 0)
            FROM files 
            WHERE batch_id = NEW.batch_id
        ),
        total_labor = (
            SELECT COALESCE(SUM(
                CASE 
                    WHEN edited_labor IS NOT NULL THEN edited_labor 
                    ELSE extracted_labor 
                END
            ), 0)
            FROM files 
            WHERE batch_id = NEW.batch_id
        ),
        total_tax = (
            SELECT COALESCE(SUM(
                CASE 
                    WHEN edited_tax IS NOT NULL THEN edited_tax 
                    ELSE extracted_tax 
                END
            ), 0)
            FROM files 
            WHERE batch_id = NEW.batch_id
        ),
        flagged_count = (
            SELECT COUNT(*) 
            FROM files 
            WHERE batch_id = NEW.batch_id AND is_flagged = TRUE
        ),
        processed_invoices = (
            SELECT COUNT(*) 
            FROM files 
            WHERE batch_id = NEW.batch_id
        ),
        updated_at = NOW()
    WHERE id = NEW.batch_id;
    
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Apply trigger to update batch totals when files are modified
CREATE TRIGGER update_batch_totals_trigger 
    AFTER INSERT OR UPDATE OR DELETE ON files 
    FOR EACH ROW EXECUTE FUNCTION update_batch_totals();

-- Function to get comprehensive batch summary for a user
CREATE OR REPLACE FUNCTION get_user_batch_summary(user_uuid UUID)
RETURNS TABLE (
    total_batches INTEGER,
    total_files INTEGER,
    total_parts DECIMAL(10,2),
    total_labor DECIMAL(10,2),
    total_tax DECIMAL(10,2),
    flagged_files INTEGER,
    processing_time_avg INTERVAL,
    first_batch_date TIMESTAMP WITH TIME ZONE,
    last_batch_date TIMESTAMP WITH TIME ZONE
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        COUNT(b.id)::INTEGER as total_batches,
        COALESCE(SUM(b.processed_invoices), 0)::INTEGER as total_files,
        COALESCE(SUM(b.total_parts), 0) as total_parts,
        COALESCE(SUM(b.total_labor), 0) as total_labor,
        COALESCE(SUM(b.total_tax), 0) as total_tax,
        COALESCE(SUM(b.flagged_count), 0)::INTEGER as flagged_files,
        AVG(b.processing_completed_at - b.processing_started_at) as processing_time_avg,
        MIN(b.created_at) as first_batch_date,
        MAX(b.created_at) as last_batch_date
    FROM batches b
    WHERE b.user_id = user_uuid AND b.status = 'completed';
END;
$$ language 'plpgsql';

-- Function to get all batches for a user with detailed information
CREATE OR REPLACE FUNCTION get_user_batches_export(user_uuid UUID, date_from TIMESTAMP WITH TIME ZONE DEFAULT NULL, date_to TIMESTAMP WITH TIME ZONE DEFAULT NULL)
RETURNS TABLE (
    batch_id UUID,
    batch_name VARCHAR(255),
    description TEXT,
    status VARCHAR(50),
    total_invoices INTEGER,
    processed_invoices INTEGER,
    total_parts DECIMAL(10,2),
    total_labor DECIMAL(10,2),
    total_tax DECIMAL(10,2),
    flagged_count INTEGER,
    processing_started_at TIMESTAMP WITH TIME ZONE,
    processing_completed_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE,
    processing_duration INTERVAL,
    files_detail JSONB
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        b.id as batch_id,
        b.batch_name,
        b.description,
        b.status,
        b.total_invoices,
        b.processed_invoices,
        b.total_parts,
        b.total_labor,
        b.total_tax,
        b.flagged_count,
        b.processing_started_at,
        b.processing_completed_at,
        b.created_at,
        (b.processing_completed_at - b.processing_started_at) as processing_duration,
        COALESCE(
            (SELECT jsonb_agg(
                jsonb_build_object(
                    'file_id', f.id,
                    'filename', f.original_filename,
                    'extracted_parts', f.extracted_parts,
                    'extracted_labor', f.extracted_labor,
                    'extracted_tax', f.extracted_tax,
                    'edited_parts', f.edited_parts,
                    'edited_labor', f.edited_labor,
                    'edited_tax', f.edited_tax,
                    'is_flagged', f.is_flagged,
                    'confidence_level', f.confidence_level,
                    'processing_started_at', f.processing_started_at,
                    'processing_completed_at', f.processing_completed_at,
                    'created_at', f.created_at
                )
            ) FROM files f WHERE f.batch_id = b.id), 
            '[]'::jsonb
        ) as files_detail
    FROM batches b
    WHERE b.user_id = user_uuid
    AND (date_from IS NULL OR b.created_at >= date_from)
    AND (date_to IS NULL OR b.created_at <= date_to)
    ORDER BY b.created_at DESC;
END;
$$ language 'plpgsql';

-- Function to create batch export record
CREATE OR REPLACE FUNCTION create_batch_export(
    user_uuid UUID,
    export_type_param VARCHAR(50),
    date_from_param TIMESTAMP WITH TIME ZONE DEFAULT NULL,
    date_to_param TIMESTAMP WITH TIME ZONE DEFAULT NULL,
    batch_ids_param UUID[] DEFAULT NULL,
    file_format_param VARCHAR(20) DEFAULT 'csv'
)
RETURNS UUID AS $$
DECLARE
    export_id UUID;
BEGIN
    INSERT INTO batch_exports (
        user_id,
        export_type,
        date_from,
        date_to,
        batch_ids,
        file_format,
        status
    ) VALUES (
        user_uuid,
        export_type_param,
        date_from_param,
        date_to_param,
        batch_ids_param,
        file_format_param,
        'pending'
    ) RETURNING id INTO export_id;
    
    RETURN export_id;
END;
$$ language 'plpgsql';

-- Row Level Security (RLS) policies
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE batches ENABLE ROW LEVEL SECURITY;
ALTER TABLE files ENABLE ROW LEVEL SECURITY;
ALTER TABLE flagged_reviews ENABLE ROW LEVEL SECURITY;
ALTER TABLE batch_exports ENABLE ROW LEVEL SECURITY;

-- Users can only access their own data
CREATE POLICY "Users can view own profile" ON users FOR SELECT USING (auth.uid() = id);
CREATE POLICY "Users can update own profile" ON users FOR UPDATE USING (auth.uid() = id);

-- Batches policies
CREATE POLICY "Users can view own batches" ON batches FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own batches" ON batches FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own batches" ON batches FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own batches" ON batches FOR DELETE USING (auth.uid() = user_id);

-- Files policies
CREATE POLICY "Users can view own files" ON files FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own files" ON files FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own files" ON files FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own files" ON files FOR DELETE USING (auth.uid() = user_id);

-- Flagged reviews policies
CREATE POLICY "Users can view own flagged reviews" ON flagged_reviews FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own flagged reviews" ON flagged_reviews FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own flagged reviews" ON flagged_reviews FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own flagged reviews" ON flagged_reviews FOR DELETE USING (auth.uid() = user_id);

-- Batch exports policies
CREATE POLICY "Users can view own exports" ON batch_exports FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own exports" ON batch_exports FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own exports" ON batch_exports FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own exports" ON batch_exports FOR DELETE USING (auth.uid() = user_id);

-- Grant necessary permissions
GRANT USAGE ON SCHEMA public TO anon, authenticated;
GRANT ALL ON ALL TABLES IN SCHEMA public TO anon, authenticated;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO anon, authenticated;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public TO anon, authenticated;

-- Success message
SELECT 'Database setup completed successfully! All tables, indexes, functions, and security policies have been created.' as status;
