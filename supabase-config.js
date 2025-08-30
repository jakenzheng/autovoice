// Supabase Configuration
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

// Initialize Supabase client
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
    console.error('❌ Missing Supabase credentials in .env file');
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

// Test connection
async function testConnection() {
    try {
        console.log('🔗 Testing Supabase connection...');
        console.log('📊 Project URL:', supabaseUrl);
        console.log('🔑 Anon Key configured');
        
        // Simple connection test
        const { data, error } = await supabase.auth.getSession();
        
        if (error) {
            console.error('❌ Supabase connection failed:', error.message);
            return false;
        } else {
            console.log('✅ Supabase connection successful!');
            console.log('🔐 Auth service accessible');
            return true;
        }
    } catch (error) {
        console.error('❌ Supabase connection error:', error.message);
        return false;
    }
}

// Database schema setup instructions
function printSetupInstructions() {
    console.log('\n📋 Database Setup Instructions:');
    console.log('1. Go to your Supabase dashboard: https://app.supabase.com');
    console.log('2. Select your project: jjqdpqyolheeylwomxqi');
    console.log('3. Go to SQL Editor');
    console.log('4. Run the following SQL commands:\n');
    
    console.log(`
-- Create users table
CREATE TABLE IF NOT EXISTS users (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    email VARCHAR UNIQUE NOT NULL,
    password_hash VARCHAR NOT NULL,
    first_name VARCHAR,
    last_name VARCHAR,
    business_name VARCHAR,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    last_login TIMESTAMP WITH TIME ZONE,
    is_active BOOLEAN DEFAULT TRUE,
    email_verified BOOLEAN DEFAULT FALSE,
    reset_token VARCHAR,
    reset_token_expiry TIMESTAMP WITH TIME ZONE
);

-- Create batches table
CREATE TABLE IF NOT EXISTS batches (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    batch_name VARCHAR NOT NULL,
    description TEXT,
    status VARCHAR DEFAULT 'processing',
    total_invoices INTEGER DEFAULT 0,
    processed_invoices INTEGER DEFAULT 0,
    summary JSONB DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    completed_at TIMESTAMP WITH TIME ZONE
);

-- Create invoices table
CREATE TABLE IF NOT EXISTS invoices (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    batch_id UUID REFERENCES batches(id) ON DELETE CASCADE,
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    original_filename VARCHAR NOT NULL,
    file_size INTEGER,
    mime_type VARCHAR,
    image_url VARCHAR,
    thumbnail_url VARCHAR,
    extracted_data JSONB DEFAULT '{}',
    processing_metadata JSONB DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_batches_user_id ON batches(user_id);
CREATE INDEX IF NOT EXISTS idx_batches_created_at ON batches(created_at);
CREATE INDEX IF NOT EXISTS idx_invoices_batch_id ON invoices(batch_id);
CREATE INDEX IF NOT EXISTS idx_invoices_user_id ON invoices(user_id);
CREATE INDEX IF NOT EXISTS idx_invoices_created_at ON invoices(created_at);

-- Enable Row Level Security (RLS)
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE batches ENABLE ROW LEVEL SECURITY;
ALTER TABLE invoices ENABLE ROW LEVEL SECURITY;

-- Create RLS policies
CREATE POLICY "Users can view own data" ON users FOR SELECT USING (auth.uid() = id);
CREATE POLICY "Users can update own data" ON users FOR UPDATE USING (auth.uid() = id);

CREATE POLICY "Users can view own batches" ON batches FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own batches" ON batches FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own batches" ON batches FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own batches" ON batches FOR DELETE USING (auth.uid() = user_id);

CREATE POLICY "Users can view own invoices" ON invoices FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own invoices" ON invoices FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own invoices" ON invoices FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own invoices" ON invoices FOR DELETE USING (auth.uid() = user_id);
    `);
}

module.exports = {
    supabase,
    testConnection,
    printSetupInstructions
};

// Run test if this file is executed directly
if (require.main === module) {
    (async () => {
        const connected = await testConnection();
        if (connected) {
            printSetupInstructions();
        }
    })();
}
