const express = require('express');
const bcrypt = require('bcryptjs');
const { supabase } = require('../supabase-config');
const { generateToken, generateRefreshToken, authenticateToken, authRateLimit } = require('../middleware/auth');

const router = express.Router();

// Input validation middleware
const validateRegistration = (req, res, next) => {
    const { email, password, firstName, lastName, businessName } = req.body;
    
    if (!email || !password || !firstName || !lastName) {
        return res.status(400).json({
            error: 'Missing required fields',
            message: 'Email, password, first name, and last name are required'
        });
    }

    // Email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
        return res.status(400).json({
            error: 'Invalid email format',
            message: 'Please provide a valid email address'
        });
    }

    // Password validation
    if (password.length < 8) {
        return res.status(400).json({
            error: 'Password too short',
            message: 'Password must be at least 8 characters long'
        });
    }

    next();
};

const validateLogin = (req, res, next) => {
    const { email, password } = req.body;
    
    if (!email || !password) {
        return res.status(400).json({
            error: 'Missing credentials',
            message: 'Email and password are required'
        });
    }

    next();
};

// User registration
router.post('/register', authRateLimit, validateRegistration, async (req, res) => {
    try {
        const { email, password, firstName, lastName, businessName } = req.body;

        // Check if user already exists
        const { data: existingUser, error: checkError } = await supabase
            .from('users')
            .select('id')
            .eq('email', email)
            .single();

        if (existingUser) {
            return res.status(409).json({
                error: 'User already exists',
                message: 'An account with this email already exists'
            });
        }

        // Hash password
        const saltRounds = 12;
        const passwordHash = await bcrypt.hash(password, saltRounds);

        // Create user
        const { data: user, error: createError } = await supabase
            .from('users')
            .insert({
                email,
                password_hash: passwordHash,
                first_name: firstName,
                last_name: lastName,
                business_name: businessName || null
            })
            .select('id, email, first_name, last_name, business_name, created_at')
            .single();

        if (createError) {
            console.error('User creation error:', createError);
            return res.status(500).json({
                error: 'Registration failed',
                message: 'Unable to create user account'
            });
        }

        // Generate tokens
        const accessToken = generateToken(user.id);
        const refreshToken = generateRefreshToken(user.id);

        res.status(201).json({
            message: 'User registered successfully',
            user: {
                id: user.id,
                email: user.email,
                firstName: user.first_name,
                lastName: user.last_name,
                businessName: user.business_name
            },
            tokens: {
                accessToken,
                refreshToken
            }
        });

    } catch (error) {
        console.error('Registration error:', error);
        res.status(500).json({
            error: 'Internal server error',
            message: 'Registration failed due to server error'
        });
    }
});

// User login
router.post('/login', authRateLimit, validateLogin, async (req, res) => {
    try {
        const { email, password } = req.body;

        // Find user by email
        const { data: user, error: findError } = await supabase
            .from('users')
            .select('id, email, password_hash, first_name, last_name, business_name, is_active')
            .eq('email', email)
            .single();

        if (findError || !user) {
            return res.status(401).json({
                error: 'Invalid credentials',
                message: 'Email or password is incorrect'
            });
        }

        if (!user.is_active) {
            return res.status(401).json({
                error: 'Account inactive',
                message: 'Your account has been deactivated'
            });
        }

        // Verify password
        const isValidPassword = await bcrypt.compare(password, user.password_hash);
        if (!isValidPassword) {
            return res.status(401).json({
                error: 'Invalid credentials',
                message: 'Email or password is incorrect'
            });
        }

        // Update last login
        await supabase
            .from('users')
            .update({ last_login: new Date().toISOString() })
            .eq('id', user.id);

        // Generate tokens
        const accessToken = generateToken(user.id);
        const refreshToken = generateRefreshToken(user.id);

        res.json({
            message: 'Login successful',
            user: {
                id: user.id,
                email: user.email,
                firstName: user.first_name,
                lastName: user.last_name,
                businessName: user.business_name
            },
            tokens: {
                accessToken,
                refreshToken
            }
        });

    } catch (error) {
        console.error('Login error:', error);
        res.status(500).json({
            error: 'Internal server error',
            message: 'Login failed due to server error'
        });
    }
});

// Get current user
router.get('/me', authenticateToken, async (req, res) => {
    try {
        res.json({
            user: {
                id: req.user.id,
                email: req.user.email,
                firstName: req.user.first_name,
                lastName: req.user.last_name,
                businessName: req.user.business_name
            }
        });
    } catch (error) {
        console.error('Get user error:', error);
        res.status(500).json({
            error: 'Internal server error',
            message: 'Unable to retrieve user information'
        });
    }
});

// Update user profile
router.put('/profile', authenticateToken, async (req, res) => {
    try {
        const { firstName, lastName, businessName } = req.body;
        const userId = req.user.id;

        const updateData = {};
        if (firstName !== undefined) updateData.first_name = firstName;
        if (lastName !== undefined) updateData.last_name = lastName;
        if (businessName !== undefined) updateData.business_name = businessName;

        if (Object.keys(updateData).length === 0) {
            return res.status(400).json({
                error: 'No updates provided',
                message: 'Please provide at least one field to update'
            });
        }

        const { data: updatedUser, error: updateError } = await supabase
            .from('users')
            .update(updateData)
            .eq('id', userId)
            .select('id, email, first_name, last_name, business_name')
            .single();

        if (updateError) {
            console.error('Profile update error:', updateError);
            return res.status(500).json({
                error: 'Update failed',
                message: 'Unable to update profile'
            });
        }

        res.json({
            message: 'Profile updated successfully',
            user: {
                id: updatedUser.id,
                email: updatedUser.email,
                firstName: updatedUser.first_name,
                lastName: updatedUser.last_name,
                businessName: updatedUser.business_name
            }
        });

    } catch (error) {
        console.error('Profile update error:', error);
        res.status(500).json({
            error: 'Internal server error',
            message: 'Profile update failed due to server error'
        });
    }
});

// Change password
router.put('/change-password', authenticateToken, async (req, res) => {
    try {
        const { currentPassword, newPassword } = req.body;
        const userId = req.user.id;

        if (!currentPassword || !newPassword) {
            return res.status(400).json({
                error: 'Missing passwords',
                message: 'Current password and new password are required'
            });
        }

        if (newPassword.length < 8) {
            return res.status(400).json({
                error: 'Password too short',
                message: 'New password must be at least 8 characters long'
            });
        }

        // Get current password hash
        const { data: user, error: findError } = await supabase
            .from('users')
            .select('password_hash')
            .eq('id', userId)
            .single();

        if (findError || !user) {
            return res.status(404).json({
                error: 'User not found',
                message: 'User account not found'
            });
        }

        // Verify current password
        const isValidPassword = await bcrypt.compare(currentPassword, user.password_hash);
        if (!isValidPassword) {
            return res.status(401).json({
                error: 'Invalid password',
                message: 'Current password is incorrect'
            });
        }

        // Hash new password
        const saltRounds = 12;
        const newPasswordHash = await bcrypt.hash(newPassword, saltRounds);

        // Update password
        const { error: updateError } = await supabase
            .from('users')
            .update({ password_hash: newPasswordHash })
            .eq('id', userId);

        if (updateError) {
            console.error('Password update error:', updateError);
            return res.status(500).json({
                error: 'Update failed',
                message: 'Unable to update password'
            });
        }

        res.json({
            message: 'Password changed successfully'
        });

    } catch (error) {
        console.error('Password change error:', error);
        res.status(500).json({
            error: 'Internal server error',
            message: 'Password change failed due to server error'
        });
    }
});

// Logout (client-side token removal)
router.post('/logout', authenticateToken, async (req, res) => {
    try {
        // In a stateless JWT system, logout is handled client-side
        // by removing the token from storage
        res.json({
            message: 'Logout successful'
        });
    } catch (error) {
        console.error('Logout error:', error);
        res.status(500).json({
            error: 'Internal server error',
            message: 'Logout failed due to server error'
        });
    }
});

module.exports = router;
