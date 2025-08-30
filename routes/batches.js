const express = require('express');
const { supabase } = require('../supabase-config');
const { authenticateToken, apiRateLimit } = require('../middleware/auth');

const router = express.Router();

// Apply authentication to all routes
router.use(authenticateToken);
router.use(apiRateLimit);

// Get all batches for current user
router.get('/', async (req, res) => {
    try {
        const userId = req.user.id;
        const { page = 1, limit = 10, status, sortBy = 'created_at', sortOrder = 'desc' } = req.query;

        let query = supabase
            .from('batches')
            .select('*')
            .eq('user_id', userId)
            .order(sortBy, { ascending: sortOrder === 'asc' });

        // Apply status filter if provided
        if (status) {
            query = query.eq('status', status);
        }

        // Apply pagination
        const offset = (page - 1) * limit;
        query = query.range(offset, offset + limit - 1);

        const { data: batches, error, count } = await query;

        if (error) {
            console.error('Get batches error:', error);
            return res.status(500).json({
                error: 'Database error',
                message: 'Unable to retrieve batches'
            });
        }

        // Get total count for pagination
        const { count: totalCount } = await supabase
            .from('batches')
            .select('*', { count: 'exact', head: true })
            .eq('user_id', userId);

        res.json({
            batches,
            pagination: {
                page: parseInt(page),
                limit: parseInt(limit),
                total: totalCount,
                pages: Math.ceil(totalCount / limit)
            }
        });

    } catch (error) {
        console.error('Get batches error:', error);
        res.status(500).json({
            error: 'Internal server error',
            message: 'Unable to retrieve batches'
        });
    }
});

// Get batches grouped by month
router.get('/by-month', async (req, res) => {
    try {
        const userId = req.user.id;
        const { year } = req.query;

        let query = supabase
            .from('batches')
            .select('*')
            .eq('user_id', userId);

        if (year) {
            query = query.gte('created_at', `${year}-01-01`)
                        .lt('created_at', `${parseInt(year) + 1}-01-01`);
        }

        const { data: batches, error } = await query;

        if (error) {
            console.error('Get batches by month error:', error);
            return res.status(500).json({
                error: 'Database error',
                message: 'Unable to retrieve batches'
            });
        }

        // Group batches by month
        const monthlyData = {};
        batches.forEach(batch => {
            const date = new Date(batch.created_at);
            const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
            const monthName = date.toLocaleString('default', { month: 'long', year: 'numeric' });

            if (!monthlyData[monthKey]) {
                monthlyData[monthKey] = {
                    month: monthName,
                    monthKey,
                    batches: [],
                    totalInvoices: 0,
                    totalParts: 0,
                    totalLabor: 0,
                    totalTax: 0,
                    flaggedCount: 0
                };
            }

            monthlyData[monthKey].batches.push(batch);
            monthlyData[monthKey].totalInvoices += batch.total_invoices || 0;
            
            if (batch.summary) {
                monthlyData[monthKey].totalParts += batch.summary.totalParts || 0;
                monthlyData[monthKey].totalLabor += batch.summary.totalLabor || 0;
                monthlyData[monthKey].totalTax += batch.summary.totalTax || 0;
                monthlyData[monthKey].flaggedCount += batch.summary.flaggedCount || 0;
            }
        });

        // Convert to array and sort by month
        const monthlyArray = Object.values(monthlyData).sort((a, b) => b.monthKey.localeCompare(a.monthKey));

        res.json({
            monthlyData: monthlyArray
        });

    } catch (error) {
        console.error('Get batches by month error:', error);
        res.status(500).json({
            error: 'Internal server error',
            message: 'Unable to retrieve monthly data'
        });
    }
});

// Get single batch by ID
router.get('/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const userId = req.user.id;

        const { data: batch, error } = await supabase
            .from('batches')
            .select('*')
            .eq('id', id)
            .eq('user_id', userId)
            .single();

        if (error) {
            if (error.code === 'PGRST116') {
                return res.status(404).json({
                    error: 'Batch not found',
                    message: 'The requested batch does not exist'
                });
            }
            console.error('Get batch error:', error);
            return res.status(500).json({
                error: 'Database error',
                message: 'Unable to retrieve batch'
            });
        }

        res.json({ batch });

    } catch (error) {
        console.error('Get batch error:', error);
        res.status(500).json({
            error: 'Internal server error',
            message: 'Unable to retrieve batch'
        });
    }
});

// Create new batch
router.post('/', async (req, res) => {
    try {
        const userId = req.user.id;
        const { batchName, description } = req.body;

        if (!batchName) {
            return res.status(400).json({
                error: 'Missing batch name',
                message: 'Batch name is required'
            });
        }

        const { data: batch, error } = await supabase
            .from('batches')
            .insert({
                user_id: userId,
                batch_name: batchName,
                description: description || null,
                status: 'processing',
                total_invoices: 0,
                processed_invoices: 0,
                summary: {
                    totalParts: 0,
                    totalLabor: 0,
                    totalTax: 0,
                    flaggedCount: 0
                }
            })
            .select('*')
            .single();

        if (error) {
            console.error('Create batch error:', error);
            return res.status(500).json({
                error: 'Database error',
                message: 'Unable to create batch'
            });
        }

        res.status(201).json({
            message: 'Batch created successfully',
            batch
        });

    } catch (error) {
        console.error('Create batch error:', error);
        res.status(500).json({
            error: 'Internal server error',
            message: 'Unable to create batch'
        });
    }
});

// Update batch
router.put('/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const userId = req.user.id;
        const { batchName, description, status, summary } = req.body;

        // Verify batch belongs to user
        const { data: existingBatch, error: checkError } = await supabase
            .from('batches')
            .select('id')
            .eq('id', id)
            .eq('user_id', userId)
            .single();

        if (checkError || !existingBatch) {
            return res.status(404).json({
                error: 'Batch not found',
                message: 'The requested batch does not exist'
            });
        }

        const updateData = {
            updated_at: new Date().toISOString()
        };

        if (batchName !== undefined) updateData.batch_name = batchName;
        if (description !== undefined) updateData.description = description;
        if (status !== undefined) updateData.status = status;
        if (summary !== undefined) updateData.summary = summary;

        // Set completed_at if status is completed
        if (status === 'completed') {
            updateData.completed_at = new Date().toISOString();
        }

        const { data: updatedBatch, error } = await supabase
            .from('batches')
            .update(updateData)
            .eq('id', id)
            .select('*')
            .single();

        if (error) {
            console.error('Update batch error:', error);
            return res.status(500).json({
                error: 'Database error',
                message: 'Unable to update batch'
            });
        }

        res.json({
            message: 'Batch updated successfully',
            batch: updatedBatch
        });

    } catch (error) {
        console.error('Update batch error:', error);
        res.status(500).json({
            error: 'Internal server error',
            message: 'Unable to update batch'
        });
    }
});

// Delete batch
router.delete('/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const userId = req.user.id;

        // Verify batch belongs to user
        const { data: existingBatch, error: checkError } = await supabase
            .from('batches')
            .select('id')
            .eq('id', id)
            .eq('user_id', userId)
            .single();

        if (checkError || !existingBatch) {
            return res.status(404).json({
                error: 'Batch not found',
                message: 'The requested batch does not exist'
            });
        }

        const { error } = await supabase
            .from('batches')
            .delete()
            .eq('id', id);

        if (error) {
            console.error('Delete batch error:', error);
            return res.status(500).json({
                error: 'Database error',
                message: 'Unable to delete batch'
            });
        }

        res.json({
            message: 'Batch deleted successfully'
        });

    } catch (error) {
        console.error('Delete batch error:', error);
        res.status(500).json({
            error: 'Internal server error',
            message: 'Unable to delete batch'
        });
    }
});

// Export batch data
router.get('/:id/export', async (req, res) => {
    try {
        const { id } = req.params;
        const userId = req.user.id;
        const { format = 'json' } = req.query;

        // Get batch with invoices
        const { data: batch, error: batchError } = await supabase
            .from('batches')
            .select('*')
            .eq('id', id)
            .eq('user_id', userId)
            .single();

        if (batchError || !batch) {
            return res.status(404).json({
                error: 'Batch not found',
                message: 'The requested batch does not exist'
            });
        }

        const { data: invoices, error: invoicesError } = await supabase
            .from('invoices')
            .select('*')
            .eq('batch_id', id)
            .order('created_at', { ascending: true });

        if (invoicesError) {
            console.error('Get invoices error:', invoicesError);
            return res.status(500).json({
                error: 'Database error',
                message: 'Unable to retrieve invoices'
            });
        }

        const exportData = {
            batch,
            invoices,
            exportDate: new Date().toISOString(),
            totalInvoices: invoices.length
        };

        if (format === 'csv') {
            // Convert to CSV format
            const csvHeaders = ['Invoice ID', 'Filename', 'Parts', 'Labor', 'Tax', 'Flagged', 'Confidence', 'Created At'];
            const csvRows = invoices.map(invoice => [
                invoice.id,
                invoice.original_filename,
                invoice.extracted_data?.parts || 0,
                invoice.extracted_data?.labor || 0,
                invoice.extracted_data?.tax || 0,
                invoice.extracted_data?.flagged ? 'Yes' : 'No',
                invoice.extracted_data?.confidence || 'unknown',
                new Date(invoice.created_at).toLocaleDateString()
            ]);

            const csvContent = [csvHeaders, ...csvRows]
                .map(row => row.map(field => `"${field}"`).join(','))
                .join('\n');

            res.setHeader('Content-Type', 'text/csv');
            res.setHeader('Content-Disposition', `attachment; filename="batch-${id}-${new Date().toISOString().split('T')[0]}.csv"`);
            res.send(csvContent);
        } else {
            // Return JSON
            res.json(exportData);
        }

    } catch (error) {
        console.error('Export batch error:', error);
        res.status(500).json({
            error: 'Internal server error',
            message: 'Unable to export batch data'
        });
    }
});

module.exports = router;
