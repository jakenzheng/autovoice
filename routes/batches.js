const express = require('express');
const { createClient } = require('@supabase/supabase-js');
const { authenticateToken, apiRateLimit } = require('../middleware/auth');

const router = express.Router();

// Create Supabase client (will be null if env vars not set)
let supabase = null;
try {
    const supabaseUrl = process.env.SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_ANON_KEY;
    
    if (supabaseUrl && supabaseKey) {
        supabase = createClient(supabaseUrl, supabaseKey);
    }
} catch (error) {
    console.log('Supabase client creation failed in batches routes');
}

// Get all batches for the authenticated user
router.get('/', authenticateToken, apiRateLimit, async (req, res) => {
    try {
        if (!supabase) {
            // Return demo data if Supabase is not available
            return res.json([
                {
                    id: 'demo-batch-1',
                    batch_name: 'Demo Batch 1',
                    description: 'Sample batch for demonstration',
                    status: 'completed',
                    total_invoices: 5,
                    processed_invoices: 5,
                    total_parts: 1250.50,
                    total_labor: 450.00,
                    total_tax: 125.05,
                    created_at: new Date().toISOString(),
                    updated_at: new Date().toISOString()
                }
            ]);
        }

        const { data: batches, error } = await supabase
            .from('batches')
            .select('*')
            .eq('user_id', req.user.id)
            .order('created_at', { ascending: false });

        if (error) {
            console.error('Error fetching batches:', error);
            return res.status(500).json({
                error: 'Failed to fetch batches',
                message: error.message
            });
        }

        res.json(batches || []);

    } catch (error) {
        console.error('Batches fetch error:', error);
        res.status(500).json({
            error: 'Internal server error',
            message: 'Failed to fetch batches'
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
