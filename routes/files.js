const express = require('express');
const { supabase } = require('../supabase-config');
const { authenticateToken, apiRateLimit } = require('../middleware/auth');

const router = express.Router();

// Apply authentication to all routes
router.use(authenticateToken);
router.use(apiRateLimit);

// Get all files for the current user
router.get('/', async (req, res) => {
    try {
        const userId = req.user.id;
        const { batchId, flagged } = req.query;

        // Check if files table exists, fallback to empty array
        try {
            let query = supabase
                .from('files')
                .select('*')
                .eq('user_id', userId);

            if (batchId) {
                query = query.eq('batch_id', batchId);
            }
            if (flagged === 'true') {
                query = query.eq('is_flagged', true);
            }

            const { data: files, error } = await query.order('created_at', { ascending: false });

            if (error) {
                console.error('Get files error:', error);
                return res.json({
                    success: true,
                    files: []
                });
            }

            res.json({
                success: true,
                files: files || []
            });
        } catch (tableError) {
            console.log('Files table not available, returning empty array');
            res.json({
                success: true,
                files: []
            });
        }

    } catch (error) {
        console.error('Get files error:', error);
        res.status(500).json({
            error: 'Internal server error',
            message: 'Unable to retrieve files'
        });
    }
});

// Get a specific file
router.get('/:fileId', async (req, res) => {
    try {
        const userId = req.user.id;
        const { fileId } = req.params;

        try {
            const { data: file, error } = await supabase
                .from('files')
                .select('*')
                .eq('id', fileId)
                .eq('user_id', userId)
                .single();

            if (error) {
                console.error('Get file error:', error);
                return res.status(404).json({
                    error: 'File not found',
                    message: 'The requested file could not be found'
                });
            }

            res.json({
                success: true,
                file
            });
        } catch (tableError) {
            console.log('Files table not available');
            res.status(404).json({
                error: 'File not found',
                message: 'The requested file could not be found'
            });
        }

    } catch (error) {
        console.error('Get file error:', error);
        res.status(500).json({
            error: 'Internal server error',
            message: 'Unable to retrieve file'
        });
    }
});

// Update file data (parts, labor, tax)
router.put('/:fileId', async (req, res) => {
    try {
        const userId = req.user.id;
        const { fileId } = req.params;
        const { editedParts, editedLabor, editedTax } = req.body;

        try {
            const { data: file, error } = await supabase
                .from('files')
                .update({
                    edited_parts: editedParts !== undefined ? parseFloat(editedParts) : null,
                    edited_labor: editedLabor !== undefined ? parseFloat(editedLabor) : null,
                    edited_tax: editedTax !== undefined ? parseFloat(editedTax) : null,
                    updated_at: new Date().toISOString()
                })
                .eq('id', fileId)
                .eq('user_id', userId)
                .select()
                .single();

            if (error) {
                console.error('Update file error:', error);
                return res.status(500).json({
                    error: 'Database error',
                    message: 'Unable to update file'
                });
            }

            res.json({
                success: true,
                file
            });
        } catch (tableError) {
            console.log('Files table not available');
            res.status(500).json({
                error: 'Database error',
                message: 'Unable to update file'
            });
        }

    } catch (error) {
        console.error('Update file error:', error);
        res.status(500).json({
            error: 'Internal server error',
            message: 'Unable to update file'
        });
    }
});

// Get flagged files for review
router.get('/flagged/review', async (req, res) => {
    try {
        const userId = req.user.id;

        try {
            const { data: files, error } = await supabase
                .from('files')
                .select('*')
                .eq('user_id', userId)
                .eq('is_flagged', true)
                .order('created_at', { ascending: false });

            if (error) {
                console.error('Get flagged files error:', error);
                return res.json({
                    success: true,
                    files: []
                });
            }

            res.json({
                success: true,
                files: files || []
            });
        } catch (tableError) {
            console.log('Files table not available, returning empty array');
            res.json({
                success: true,
                files: []
            });
        }

    } catch (error) {
        console.error('Get flagged files error:', error);
        res.status(500).json({
            error: 'Internal server error',
            message: 'Unable to retrieve flagged files'
        });
    }
});

// Submit review for flagged file
router.post('/:fileId/review', async (req, res) => {
    try {
        const userId = req.user.id;
        const { fileId } = req.params;
        const { reviewNotes, correctedParts, correctedLabor, correctedTax, reviewStatus } = req.body;

        try {
            // Create review record
            const { data: review, error: reviewError } = await supabase
                .from('flagged_reviews')
                .insert({
                    file_id: fileId,
                    user_id: userId,
                    review_notes: reviewNotes,
                    corrected_parts: correctedParts !== undefined ? parseFloat(correctedParts) : null,
                    corrected_labor: correctedLabor !== undefined ? parseFloat(correctedLabor) : null,
                    corrected_tax: correctedTax !== undefined ? parseFloat(correctedTax) : null,
                    review_status: reviewStatus || 'approved'
                })
                .select()
                .single();

            if (reviewError) {
                console.error('Create review error:', reviewError);
                return res.status(500).json({
                    error: 'Database error',
                    message: 'Unable to create review'
                });
            }

            // Update file with corrected values if provided
            if (correctedParts !== undefined || correctedLabor !== undefined || correctedTax !== undefined) {
                const updateData = {};
                if (correctedParts !== undefined) updateData.edited_parts = parseFloat(correctedParts);
                if (correctedLabor !== undefined) updateData.edited_labor = parseFloat(correctedLabor);
                if (correctedTax !== undefined) updateData.edited_tax = parseFloat(correctedTax);
                updateData.review_status = 'reviewed';
                updateData.updated_at = new Date().toISOString();

                await supabase
                    .from('files')
                    .update(updateData)
                    .eq('id', fileId)
                    .eq('user_id', userId);
            }

            res.json({
                success: true,
                review
            });
        } catch (tableError) {
            console.log('Tables not available');
            res.status(500).json({
                error: 'Database error',
                message: 'Unable to create review'
            });
        }

    } catch (error) {
        console.error('Submit review error:', error);
        res.status(500).json({
            error: 'Internal server error',
            message: 'Unable to submit review'
        });
    }
});

// Get review history for a file
router.get('/:fileId/reviews', async (req, res) => {
    try {
        const userId = req.user.id;
        const { fileId } = req.params;

        try {
            const { data: reviews, error } = await supabase
                .from('flagged_reviews')
                .select('*')
                .eq('file_id', fileId)
                .eq('user_id', userId)
                .order('created_at', { ascending: false });

            if (error) {
                console.error('Get reviews error:', error);
                return res.json({
                    success: true,
                    reviews: []
                });
            }

            res.json({
                success: true,
                reviews: reviews || []
            });
        } catch (tableError) {
            console.log('Flagged reviews table not available, returning empty array');
            res.json({
                success: true,
                reviews: []
            });
        }

    } catch (error) {
        console.error('Get reviews error:', error);
        res.status(500).json({
            error: 'Internal server error',
            message: 'Unable to retrieve reviews'
        });
    }
});

// Delete a file
router.delete('/:fileId', async (req, res) => {
    try {
        const userId = req.user.id;
        const { fileId } = req.params;

        try {
            const { error } = await supabase
                .from('files')
                .delete()
                .eq('id', fileId)
                .eq('user_id', userId);

            if (error) {
                console.error('Delete file error:', error);
                return res.status(500).json({
                    error: 'Database error',
                    message: 'Unable to delete file'
                });
            }

            res.json({
                success: true,
                message: 'File deleted successfully'
            });
        } catch (tableError) {
            console.log('Files table not available');
            res.status(500).json({
                error: 'Database error',
                message: 'Unable to delete file'
            });
        }

    } catch (error) {
        console.error('Delete file error:', error);
        res.status(500).json({
            error: 'Internal server error',
            message: 'Unable to delete file'
        });
    }
});

module.exports = router;
