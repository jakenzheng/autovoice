const express = require('express');
const { supabase } = require('../supabase-config');
const { authenticateToken, apiRateLimit } = require('../middleware/auth');

const router = express.Router();

// Apply authentication to all routes
router.use(authenticateToken);
router.use(apiRateLimit);

// Get all batches for the current user
router.get('/', async (req, res) => {
    try {
        const userId = req.user.id;

        // Check if Supabase is available
        if (!supabase) {
            // Return demo data when Supabase is not available
            const demoBatches = [
                {
                    id: 'demo-batch-1',
                    user_id: userId,
                    batch_name: 'Demo Batch 1',
                    description: 'Sample batch for demonstration',
                    status: 'completed',
                    total_invoices: 5,
                    processed_invoices: 5,
                    total_parts: 134.02,
                    total_labor: 45.00,
                    total_tax: 23.19,
                    flagged_count: 1,
                    created_at: new Date(Date.now() - 86400000).toISOString(), // 1 day ago
                    updated_at: new Date().toISOString()
                },
                {
                    id: 'demo-batch-2',
                    user_id: userId,
                    batch_name: 'Demo Batch 2',
                    description: 'Another sample batch',
                    status: 'completed',
                    total_invoices: 3,
                    processed_invoices: 3,
                    total_parts: 713.36,
                    total_labor: 95.56,
                    total_tax: 66.93,
                    flagged_count: 0,
                    created_at: new Date(Date.now() - 172800000).toISOString(), // 2 days ago
                    updated_at: new Date().toISOString()
                }
            ];

            return res.json({
                success: true,
                batches: demoBatches
            });
        }

        // Try to get batches from database
        try {
            const { data: batches, error } = await supabase
                .from('batches')
                .select('*')
                .eq('user_id', userId)
                .order('created_at', { ascending: false });

            if (error) {
                console.error('Get batches error:', error);
                return res.json({
                    success: true,
                    batches: []
                });
            }

            res.json({
                success: true,
                batches: batches || []
            });
        } catch (tableError) {
            console.log('Batches table not available, returning empty array');
            res.json({
                success: true,
                batches: []
            });
        }

    } catch (error) {
        console.error('Get batches error:', error);
        res.status(500).json({
            error: 'Internal server error',
            message: 'Unable to retrieve batches'
        });
    }
});

// Get a specific batch
router.get('/:batchId', async (req, res) => {
    try {
        const userId = req.user.id;
        const { batchId } = req.params;

        // Check if Supabase is available
        if (!supabase) {
            // Return demo data for specific batch
            const demoBatch = {
                id: batchId,
                user_id: userId,
                batch_name: 'Demo Batch',
                description: 'Sample batch for demonstration',
                status: 'completed',
                total_invoices: 5,
                processed_invoices: 5,
                total_parts: 134.02,
                total_labor: 45.00,
                total_tax: 23.19,
                flagged_count: 1,
                created_at: new Date().toISOString(),
                updated_at: new Date().toISOString()
            };

            return res.json({
                success: true,
                batch: demoBatch
            });
        }

        // Try to get batch from database
        try {
            const { data: batch, error } = await supabase
                .from('batches')
                .select('*')
                .eq('id', batchId)
                .eq('user_id', userId)
                .single();

            if (error) {
                console.error('Get batch error:', error);
                return res.status(404).json({
                    error: 'Batch not found',
                    message: 'The requested batch could not be found'
                });
            }

            res.json({
                success: true,
                batch
            });
        } catch (tableError) {
            console.log('Batches table not available');
            res.status(404).json({
                error: 'Batch not found',
                message: 'The requested batch could not be found'
            });
        }

    } catch (error) {
        console.error('Get batch error:', error);
        res.status(500).json({
            error: 'Internal server error',
            message: 'Unable to retrieve batch'
        });
    }
});

// Create a new batch
router.post('/', async (req, res) => {
    try {
        const userId = req.user.id;
        const { batchName, description } = req.body;

        // Check if Supabase is available
        if (!supabase) {
            // Return demo batch creation
            const demoBatch = {
                id: 'demo-batch-' + Date.now(),
                user_id: userId,
                batch_name: batchName || 'Demo Batch',
                description: description || '',
                status: 'processing',
                total_invoices: 0,
                processed_invoices: 0,
                total_parts: 0,
                total_labor: 0,
                total_tax: 0,
                flagged_count: 0,
                created_at: new Date().toISOString(),
                updated_at: new Date().toISOString()
            };

            return res.json({
                success: true,
                batch: demoBatch
            });
        }

        // Try to create batch in database
        try {
            const { data: batch, error } = await supabase
                .from('batches')
                .insert({
                    user_id: userId,
                    batch_name: batchName,
                    description: description,
                    status: 'processing',
                    total_invoices: 0,
                    processed_invoices: 0,
                    total_parts: 0,
                    total_labor: 0,
                    total_tax: 0,
                    flagged_count: 0
                })
                .select()
                .single();

            if (error) {
                console.error('Create batch error:', error);
                return res.status(500).json({
                    error: 'Database error',
                    message: 'Unable to create batch'
                });
            }

            res.json({
                success: true,
                batch
            });
        } catch (tableError) {
            console.log('Batches table not available');
            res.status(500).json({
                error: 'Database error',
                message: 'Unable to create batch'
            });
        }

    } catch (error) {
        console.error('Create batch error:', error);
        res.status(500).json({
            error: 'Internal server error',
            message: 'Unable to create batch'
        });
    }
});

// Update a batch
router.put('/:batchId', async (req, res) => {
    try {
        const userId = req.user.id;
        const { batchId } = req.params;
        const updateData = req.body;

        // Check if Supabase is available
        if (!supabase) {
            // Return demo batch update
            const demoBatch = {
                id: batchId,
                user_id: userId,
                batch_name: updateData.batch_name || 'Demo Batch',
                description: updateData.description || '',
                status: updateData.status || 'completed',
                total_invoices: updateData.total_invoices || 0,
                processed_invoices: updateData.processed_invoices || 0,
                total_parts: updateData.total_parts || 0,
                total_labor: updateData.total_labor || 0,
                total_tax: updateData.total_tax || 0,
                flagged_count: updateData.flagged_count || 0,
                created_at: new Date().toISOString(),
                updated_at: new Date().toISOString()
            };

            return res.json({
                success: true,
                batch: demoBatch
            });
        }

        // Try to update batch in database
        try {
            const { data: batch, error } = await supabase
                .from('batches')
                .update(updateData)
                .eq('id', batchId)
                .eq('user_id', userId)
                .select()
                .single();

            if (error) {
                console.error('Update batch error:', error);
                return res.status(500).json({
                    error: 'Database error',
                    message: 'Unable to update batch'
                });
            }

            res.json({
                success: true,
                batch
            });
        } catch (tableError) {
            console.log('Batches table not available');
            res.status(500).json({
                error: 'Database error',
                message: 'Unable to update batch'
            });
        }

    } catch (error) {
        console.error('Update batch error:', error);
        res.status(500).json({
            error: 'Internal server error',
            message: 'Unable to update batch'
        });
    }
});

// Delete a batch
router.delete('/:batchId', async (req, res) => {
    try {
        const userId = req.user.id;
        const { batchId } = req.params;

        // Check if Supabase is available
        if (!supabase) {
            // Return success for demo mode
            return res.json({
                success: true,
                message: 'Batch deleted successfully'
            });
        }

        // Try to delete batch from database
        try {
            const { error } = await supabase
                .from('batches')
                .delete()
                .eq('id', batchId)
                .eq('user_id', userId);

            if (error) {
                console.error('Delete batch error:', error);
                return res.status(500).json({
                    error: 'Database error',
                    message: 'Unable to delete batch'
                });
            }

            res.json({
                success: true,
                message: 'Batch deleted successfully'
            });
        } catch (tableError) {
            console.log('Batches table not available');
            res.status(500).json({
                error: 'Database error',
                message: 'Unable to delete batch'
            });
        }

    } catch (error) {
        console.error('Delete batch error:', error);
        res.status(500).json({
            error: 'Internal server error',
            message: 'Unable to delete batch'
        });
    }
});

module.exports = router;
