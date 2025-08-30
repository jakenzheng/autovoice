const { supabase } = require('../supabase-config');

// Middleware to verify Supabase session
const authenticateToken = async (req, res, next) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN

    if (!token) {
        return res.status(401).json({ 
            error: 'Access token required',
            message: 'Please provide a valid authentication token'
        });
    }

    try {
        // Set the auth token for this request
        const { data: { user }, error } = await supabase.auth.getUser(token);

        if (error || !user) {
            return res.status(401).json({ 
                error: 'Invalid token',
                message: 'Invalid authentication token'
            });
        }

        // Get user profile from our users table
        const { data: profile, error: profileError } = await supabase
            .from('users')
            .select('id, email, first_name, last_name, business_name, is_active')
            .eq('id', user.id)
            .single();

        if (profileError || !profile || !profile.is_active) {
            return res.status(401).json({ 
                error: 'Invalid token',
                message: 'User not found or account inactive'
            });
        }

        req.user = profile;
        next();
    } catch (error) {
        console.error('Auth middleware error:', error);
        return res.status(403).json({ 
            error: 'Invalid token',
            message: 'Invalid authentication token'
        });
    }
};

// Rate limiting middleware
const rateLimiter = require('express-rate-limit');

const authRateLimit = rateLimiter({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 5, // limit each IP to 5 requests per windowMs
    message: {
        error: 'Too many authentication attempts',
        message: 'Please try again later'
    },
    standardHeaders: true,
    legacyHeaders: false,
});

const apiRateLimit = rateLimiter({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 100, // limit each IP to 100 requests per windowMs
    message: {
        error: 'Too many requests',
        message: 'Please try again later'
    },
    standardHeaders: true,
    legacyHeaders: false,
});

module.exports = {
    authenticateToken,
    authRateLimit,
    apiRateLimit
};
