const express = require('express');
const { supabase } = require('../supabase-config');
const { authenticateToken, apiRateLimit } = require('../middleware/auth');

const router = express.Router();

// Apply authentication to all routes
router.use(authenticateToken);
router.use(apiRateLimit);

// Get all invoices for a batch
router.get('/batch/:batchId', async (req, res) => {
    try {
        const { batchId } = req.params;
        const userId = req.user.id;
        const { page = 1, limit = 20, flagged, confidence, sortBy = 'created_at', sortOrder = 'desc' } = req.query;

        // Verify batch belongs to user
        const { data: batch, error: batchError } = await supabase
            .from('batches')
            .select('id')
            .eq('id', batchId)
            .eq('user_id', userId)
            .single();

        if (batchError || !batch) {
            return res.status(404).json({
                error: 'Batch not found',
                message: 'The requested batch does not exist'
            });
        }

        let query = supabase
            .from('invoices')
            .select('*')
            .eq('batch_id', batchId)
            .order(sortBy, { ascending: sortOrder === 'asc' });

        // Apply filters
        if (flagged !== undefined) {
            query = query.eq('extracted_data->flagged', flagged === 'true');
        }

        if (confidence) {
            query = query.eq('extracted_data->confidence', confidence);
        }

        // Apply pagination
        const offset = (page - 1) * limit;
        query = query.range(offset, offset + limit - 1);

        const { data: invoices, error } = await query;

        if (error) {
            console.error('Get invoices error:', error);
            return res.status(500).json({
                error: 'Database error',
                message: 'Unable to retrieve invoices'
            });
        }

        // Get total count for pagination
        const { count: totalCount } = await supabase
            .from('invoices')
            .select('*', { count: 'exact', head: true })
            .eq('batch_id', batchId);

        res.json({
            invoices,
            pagination: {
                page: parseInt(page),
                limit: parseInt(limit),
                total: totalCount,
                pages: Math.ceil(totalCount / limit)
            }
        });

    } catch (error) {
        console.error('Get invoices error:', error);
        res.status(500).json({
            error: 'Internal server error',
            message: 'Unable to retrieve invoices'
        });
    }
});

// Get all flagged invoices for current user
router.get('/flagged', async (req, res) => {
    try {
        const userId = req.user.id;
        const { page = 1, limit = 20, confidence, sortBy = 'created_at', sortOrder = 'desc' } = req.query;

        let query = supabase
            .from('invoices')
            .select(`
                *,
                batches!inner(batch_name, user_id)
            `)
            .eq('batches.user_id', userId)
            .eq('extracted_data->flagged', true)
            .order(sortBy, { ascending: sortOrder === 'asc' });

        // Apply confidence filter
        if (confidence) {
            query = query.eq('extracted_data->confidence', confidence);
        }

        // Apply pagination
        const offset = (page - 1) * limit;
        query = query.range(offset, offset + limit - 1);

        const { data: invoices, error } = await query;

        if (error) {
            console.error('Get flagged invoices error:', error);
            return res.status(500).json({
                error: 'Database error',
                message: 'Unable to retrieve flagged invoices'
            });
        }

        // Get total count for pagination
        const { count: totalCount } = await supabase
            .from('invoices')
            .select(`
                *,
                batches!inner(user_id)
            `, { count: 'exact', head: true })
            .eq('batches.user_id', userId)
            .eq('extracted_data->flagged', true);

        res.json({
            invoices,
            pagination: {
                page: parseInt(page),
                limit: parseInt(limit),
                total: totalCount,
                pages: Math.ceil(totalCount / limit)
            }
        });

    } catch (error) {
        console.error('Get flagged invoices error:', error);
        res.status(500).json({
            error: 'Internal server error',
            message: 'Unable to retrieve flagged invoices'
        });
    }
});

// Get invoices grouped by month
router.get('/by-month', async (req, res) => {
    try {
        const userId = req.user.id;
        const { year } = req.query;

        let query = supabase
            .from('invoices')
            .select(`
                *,
                batches!inner(user_id)
            `)
            .eq('batches.user_id', userId);

        if (year) {
            query = query.gte('created_at', `${year}-01-01`)
                        .lt('created_at', `${parseInt(year) + 1}-01-01`);
        }

        const { data: invoices, error } = await query;

        if (error) {
            console.error('Get invoices by month error:', error);
            return res.status(500).json({
                error: 'Database error',
                message: 'Unable to retrieve invoices'
            });
        }

        // Group invoices by month
        const monthlyData = {};
        invoices.forEach(invoice => {
            const date = new Date(invoice.created_at);
            const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
            const monthName = date.toLocaleString('default', { month: 'long', year: 'numeric' });

            if (!monthlyData[monthKey]) {
                monthlyData[monthKey] = {
                    month: monthName,
                    monthKey,
                    invoices: [],
                    totalParts: 0,
                    totalLabor: 0,
                    totalTax: 0,
                    flaggedCount: 0,
                    highConfidence: 0,
                    mediumConfidence: 0,
                    lowConfidence: 0
                };
            }

            monthlyData[monthKey].invoices.push(invoice);
            
            if (invoice.extracted_data) {
                monthlyData[monthKey].totalParts += invoice.extracted_data.parts || 0;
                monthlyData[monthKey].totalLabor += invoice.extracted_data.labor || 0;
                monthlyData[monthKey].totalTax += invoice.extracted_data.tax || 0;
                
                if (invoice.extracted_data.flagged) {
                    monthlyData[monthKey].flaggedCount++;
                }

                // Count confidence levels
                switch (invoice.extracted_data.confidence) {
                    case 'high':
                        monthlyData[monthKey].highConfidence++;
                        break;
                    case 'medium':
                        monthlyData[monthKey].mediumConfidence++;
                        break;
                    case 'low':
                        monthlyData[monthKey].lowConfidence++;
                        break;
                }
            }
        });

        // Convert to array and sort by month
        const monthlyArray = Object.values(monthlyData).sort((a, b) => b.monthKey.localeCompare(a.monthKey));

        res.json({
            monthlyData: monthlyArray
        });

    } catch (error) {
        console.error('Get invoices by month error:', error);
        res.status(500).json({
            error: 'Internal server error',
            message: 'Unable to retrieve monthly data'
        });
    }
});

// Get single invoice by ID
router.get('/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const userId = req.user.id;

        const { data: invoice, error } = await supabase
            .from('invoices')
            .select(`
                *,
                batches!inner(user_id)
            `)
            .eq('id', id)
            .eq('batches.user_id', userId)
            .single();

        if (error) {
            if (error.code === 'PGRST116') {
                return res.status(404).json({
                    error: 'Invoice not found',
                    message: 'The requested invoice does not exist'
                });
            }
            console.error('Get invoice error:', error);
            return res.status(500).json({
                error: 'Database error',
                message: 'Unable to retrieve invoice'
            });
        }

        res.json({ invoice });

    } catch (error) {
        console.error('Get invoice error:', error);
        res.status(500).json({
            error: 'Internal server error',
            message: 'Unable to retrieve invoice'
        });
    }
});

// Create new invoice
router.post('/', async (req, res) => {
    try {
        const userId = req.user.id;
        const { batchId, originalFilename, fileSize, mimeType, imageUrl, thumbnailUrl, extractedData, processingMetadata } = req.body;

        if (!batchId || !originalFilename) {
            return res.status(400).json({
                error: 'Missing required fields',
                message: 'Batch ID and original filename are required'
            });
        }

        // Verify batch belongs to user
        const { data: batch, error: batchError } = await supabase
            .from('batches')
            .select('id')
            .eq('id', batchId)
            .eq('user_id', userId)
            .single();

        if (batchError || !batch) {
            return res.status(404).json({
                error: 'Batch not found',
                message: 'The specified batch does not exist'
            });
        }

        const { data: invoice, error } = await supabase
            .from('invoices')
            .insert({
                batch_id: batchId,
                user_id: userId,
                original_filename: originalFilename,
                file_size: fileSize || null,
                mime_type: mimeType || null,
                image_url: imageUrl || null,
                thumbnail_url: thumbnailUrl || null,
                extracted_data: extractedData || {},
                processing_metadata: processingMetadata || {}
            })
            .select('*')
            .single();

        if (error) {
            console.error('Create invoice error:', error);
            return res.status(500).json({
                error: 'Database error',
                message: 'Unable to create invoice'
            });
        }

        res.status(201).json({
            message: 'Invoice created successfully',
            invoice
        });

    } catch (error) {
        console.error('Create invoice error:', error);
        res.status(500).json({
            error: 'Internal server error',
            message: 'Unable to create invoice'
        });
    }
});

// Update invoice data
router.put('/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const userId = req.user.id;
        const { extractedData, processingMetadata } = req.body;

        // Verify invoice belongs to user
        const { data: existingInvoice, error: checkError } = await supabase
            .from('invoices')
            .select(`
                id,
                batches!inner(user_id)
            `)
            .eq('id', id)
            .eq('batches.user_id', userId)
            .single();

        if (checkError || !existingInvoice) {
            return res.status(404).json({
                error: 'Invoice not found',
                message: 'The requested invoice does not exist'
            });
        }

        const updateData = {};

        if (extractedData !== undefined) {
            // Mark as edited if data is being updated
            updateData.extracted_data = {
                ...extractedData,
                isEdited: true,
                originalValues: existingInvoice.extracted_data?.originalValues || existingInvoice.extracted_data
            };
        }

        if (processingMetadata !== undefined) {
            updateData.processing_metadata = {
                ...processingMetadata,
                lastEdited: new Date().toISOString(),
                editedBy: userId
            };
        }

        const { data: updatedInvoice, error } = await supabase
            .from('invoices')
            .update(updateData)
            .eq('id', id)
            .select('*')
            .single();

        if (error) {
            console.error('Update invoice error:', error);
            return res.status(500).json({
                error: 'Database error',
                message: 'Unable to update invoice'
            });
        }

        res.json({
            message: 'Invoice updated successfully',
            invoice: updatedInvoice
        });

    } catch (error) {
        console.error('Update invoice error:', error);
        res.status(500).json({
            error: 'Internal server error',
            message: 'Unable to update invoice'
        });
    }
});

// Toggle flagged status
router.put('/:id/flag', async (req, res) => {
    try {
        const { id } = req.params;
        const userId = req.user.id;
        const { flagged } = req.body;

        // Verify invoice belongs to user
        const { data: existingInvoice, error: checkError } = await supabase
            .from('invoices')
            .select(`
                id,
                extracted_data,
                batches!inner(user_id)
            `)
            .eq('id', id)
            .eq('batches.user_id', userId)
            .single();

        if (checkError || !existingInvoice) {
            return res.status(404).json({
                error: 'Invoice not found',
                message: 'The requested invoice does not exist'
            });
        }

        // Update flagged status
        const updatedExtractedData = {
            ...existingInvoice.extracted_data,
            flagged: flagged
        };

        const { data: updatedInvoice, error } = await supabase
            .from('invoices')
            .update({
                extracted_data: updatedExtractedData
            })
            .eq('id', id)
            .select('*')
            .single();

        if (error) {
            console.error('Toggle flag error:', error);
            return res.status(500).json({
                error: 'Database error',
                message: 'Unable to update flag status'
            });
        }

        res.json({
            message: `Invoice ${flagged ? 'flagged' : 'unflagged'} successfully`,
            invoice: updatedInvoice
        });

    } catch (error) {
        console.error('Toggle flag error:', error);
        res.status(500).json({
            error: 'Internal server error',
            message: 'Unable to update flag status'
        });
    }
});

// Delete invoice
router.delete('/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const userId = req.user.id;

        // Verify invoice belongs to user
        const { data: existingInvoice, error: checkError } = await supabase
            .from('invoices')
            .select(`
                id,
                batches!inner(user_id)
            `)
            .eq('id', id)
            .eq('batches.user_id', userId)
            .single();

        if (checkError || !existingInvoice) {
            return res.status(404).json({
                error: 'Invoice not found',
                message: 'The requested invoice does not exist'
            });
        }

        const { error } = await supabase
            .from('invoices')
            .delete()
            .eq('id', id);

        if (error) {
            console.error('Delete invoice error:', error);
            return res.status(500).json({
                error: 'Database error',
                message: 'Unable to delete invoice'
            });
        }

        res.json({
            message: 'Invoice deleted successfully'
        });

    } catch (error) {
        console.error('Delete invoice error:', error);
        res.status(500).json({
            error: 'Internal server error',
            message: 'Unable to delete invoice'
        });
    }
});

module.exports = router;
