const jwt = require('jsonwebtoken');
const { supabase } = require('../supabase-config');

// JWT secret from environment variables
const JWT_SECRET = process.env.JWT_SECRET || 'your-super-secret-jwt-key-change-this-in-production';

// Middleware to verify JWT token
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
        const decoded = jwt.verify(token, JWT_SECRET);
        
        // Verify user exists in database
        const { data: user, error } = await supabase
            .from('users')
            .select('id, email, first_name, last_name, business_name, is_active')
            .eq('id', decoded.userId)
            .single();

        if (error || !user || !user.is_active) {
            return res.status(401).json({ 
                error: 'Invalid token',
                message: 'User not found or account inactive'
            });
        }

        req.user = user;
        next();
    } catch (error) {
        if (error.name === 'TokenExpiredError') {
            return res.status(401).json({ 
                error: 'Token expired',
                message: 'Your session has expired. Please log in again.'
            });
        }
        
        return res.status(403).json({ 
            error: 'Invalid token',
            message: 'Invalid authentication token'
        });
    }
};

// Generate JWT token
const generateToken = (userId) => {
    return jwt.sign({ userId }, JWT_SECRET, { expiresIn: '24h' });
};

// Generate refresh token
const generateRefreshToken = (userId) => {
    return jwt.sign({ userId, type: 'refresh' }, JWT_SECRET, { expiresIn: '30d' });
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
    generateToken,
    generateRefreshToken,
    authRateLimit,
    apiRateLimit
};
