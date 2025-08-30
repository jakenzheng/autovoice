const express = require('express');
const { supabase } = require('../supabase-config');
const { apiRateLimit } = require('../middleware/auth');

const router = express.Router();

// Supabase Auth routes
router.post('/signup', apiRateLimit, async (req, res) => {
    try {
        const { email, password, firstName, lastName, businessName } = req.body;

        if (!email || !password || !firstName || !lastName) {
            return res.status(400).json({
                error: 'Missing required fields',
                message: 'Email, password, first name, and last name are required'
            });
        }

        // Create user with Supabase Auth
        const { data: authData, error: authError } = await supabase.auth.signUp({
            email,
            password,
            options: {
                data: {
                    first_name: firstName,
                    last_name: lastName,
                    business_name: businessName || null
                }
            }
        });

        if (authError) {
            console.error('Signup error:', authError);
            
            // Handle specific Supabase auth errors
            if (authError.message.includes('Email address') && authError.message.includes('invalid')) {
                return res.status(400).json({
                    error: 'Invalid email format',
                    message: 'Please provide a valid email address'
                });
            }
            
            if (authError.message.includes('already registered')) {
                return res.status(409).json({
                    error: 'Email already registered',
                    message: 'An account with this email already exists'
                });
            }
            
            return res.status(400).json({
                error: 'Signup failed',
                message: authError.message
            });
        }

        // Create user profile in our users table
        if (authData.user) {
            const { error: profileError } = await supabase
                .from('users')
                .insert({
                    id: authData.user.id,
                    email: authData.user.email,
                    first_name: firstName,
                    last_name: lastName,
                    business_name: businessName || null,
                    email_verified: authData.user.email_confirmed_at ? true : false,
                    is_active: true
                });

            if (profileError) {
                console.error('Profile creation error:', profileError);
            }
        }

        res.status(201).json({
            message: 'Account created successfully. Please check your email to verify your account.',
            user: {
                id: authData.user?.id,
                email: authData.user?.email,
                firstName,
                lastName,
                businessName
            }
        });

    } catch (error) {
        console.error('Signup error:', error);
        res.status(500).json({
            error: 'Internal server error',
            message: 'Signup failed due to server error'
        });
    }
});

router.post('/signin', apiRateLimit, async (req, res) => {
    try {
        const { email, password } = req.body;

        if (!email || !password) {
            return res.status(400).json({
                error: 'Missing credentials',
                message: 'Email and password are required'
            });
        }

        // Sign in with Supabase Auth
        const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
            email,
            password
        });

        if (authError) {
            console.error('Signin error:', authError);
            return res.status(401).json({
                error: 'Invalid credentials',
                message: 'Email or password is incorrect'
            });
        }

        // Get user profile (if users table exists)
        let user = null;
        try {
            const { data: userData, error: profileError } = await supabase
                .from('users')
                .select('*')
                .eq('id', authData.user.id)
                .single();

            if (profileError) {
                console.error('Profile fetch error:', profileError);
            } else {
                user = userData;
                
                // Update last login
                await supabase
                    .from('users')
                    .update({ last_login: new Date().toISOString() })
                    .eq('id', authData.user.id);
            }
        } catch (error) {
            console.log('Users table not available, using auth user data');
        }

        res.json({
            message: 'Login successful',
            user: {
                id: authData.user.id,
                email: authData.user.email,
                firstName: user?.first_name || authData.user.user_metadata?.first_name,
                lastName: user?.last_name || authData.user.user_metadata?.last_name,
                businessName: user?.business_name
            },
            session: authData.session
        });

    } catch (error) {
        console.error('Signin error:', error);
        res.status(500).json({
            error: 'Internal server error',
            message: 'Login failed due to server error'
        });
    }
});

router.post('/signout', async (req, res) => {
    try {
        const { error } = await supabase.auth.signOut();
        
        if (error) {
            console.error('Signout error:', error);
            return res.status(500).json({
                error: 'Signout failed',
                message: error.message
            });
        }

        res.json({
            message: 'Logged out successfully'
        });

    } catch (error) {
        console.error('Signout error:', error);
        res.status(500).json({
            error: 'Internal server error',
            message: 'Logout failed due to server error'
        });
    }
});

router.get('/me', async (req, res) => {
    try {
        // Get the authorization header
        const authHeader = req.headers['authorization'];
        const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN

        if (!token) {
            return res.status(401).json({
                error: 'Not authenticated',
                message: 'Please sign in to continue'
            });
        }

        // Set the auth token for this request
        const { data: { user }, error } = await supabase.auth.getUser(token);
        
        if (error || !user) {
            return res.status(401).json({
                error: 'Not authenticated',
                message: 'Please sign in to continue'
            });
        }

        // Get user profile (if users table exists)
        let profile = null;
        try {
            const { data: profileData, error: profileError } = await supabase
                .from('users')
                .select('*')
                .eq('id', user.id)
                .single();

            if (profileError) {
                console.error('Profile fetch error:', profileError);
            } else {
                profile = profileData;
            }
        } catch (error) {
            console.log('Users table not available, using auth user data');
        }

        res.json({
            user: {
                id: user.id,
                email: user.email,
                firstName: profile?.first_name || user.user_metadata?.first_name || 'User',
                lastName: profile?.last_name || user.user_metadata?.last_name || '',
                businessName: profile?.business_name || user.user_metadata?.business_name
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

router.put('/profile', async (req, res) => {
    try {
        const { data: { user }, error: authError } = await supabase.auth.getUser();
        
        if (authError || !user) {
            return res.status(401).json({
                error: 'Not authenticated',
                message: 'Please sign in to continue'
            });
        }

        const { firstName, lastName, businessName } = req.body;

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
            .eq('id', user.id)
            .select('*')
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

module.exports = router;
