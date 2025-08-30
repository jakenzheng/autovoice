const express = require('express');
const { supabase } = require('../supabase-config');
const { authenticateToken, apiRateLimit } = require('../middleware/auth');

const router = express.Router();

// Apply authentication to all routes
router.use(authenticateToken);
router.use(apiRateLimit);

// Get summary statistics
router.get('/summary', async (req, res) => {
    try {
        const userId = req.user.id;
        const { year, month } = req.query;

        let dateFilter = '';
        if (year && month) {
            dateFilter = `AND DATE_TRUNC('month', created_at) = '${year}-${month.padStart(2, '0')}-01'::date`;
        } else if (year) {
            dateFilter = `AND DATE_TRUNC('year', created_at) = '${year}-01-01'::date`;
        }

        // Get summary statistics using raw SQL for better performance
        const { data: summary, error } = await supabase.rpc('get_summary_stats', {
            user_id_param: userId,
            date_filter: dateFilter
        });

        if (error) {
            console.error('Get summary stats error:', error);
            return res.status(500).json({
                error: 'Database error',
                message: 'Unable to retrieve summary statistics'
            });
        }

        res.json({ summary: summary[0] || {} });

    } catch (error) {
        console.error('Get summary error:', error);
        res.status(500).json({
            error: 'Internal server error',
            message: 'Unable to retrieve summary statistics'
        });
    }
});

// Get chart data for visualization
router.get('/charts', async (req, res) => {
    try {
        const userId = req.user.id;
        const { year, chartType = 'parts_vs_labor' } = req.query;

        let dateFilter = '';
        if (year) {
            dateFilter = `AND DATE_TRUNC('year', created_at) = '${year}-01-01'::date`;
        }

        let chartData = {};

        switch (chartType) {
            case 'parts_vs_labor':
                // Get parts vs labor pie chart data
                const { data: pieData, error: pieError } = await supabase.rpc('get_parts_labor_data', {
                    user_id_param: userId,
                    date_filter: dateFilter
                });

                if (pieError) {
                    console.error('Get pie chart data error:', pieError);
                    return res.status(500).json({
                        error: 'Database error',
                        message: 'Unable to retrieve chart data'
                    });
                }

                chartData = {
                    type: 'pie',
                    data: pieData || [],
                    labels: ['Parts', 'Labor'],
                    datasets: [{
                        data: [
                            pieData?.[0]?.total_parts || 0,
                            pieData?.[0]?.total_labor || 0
                        ],
                        backgroundColor: ['#1a1a1a', '#8B4513'],
                        borderColor: ['#000000', '#654321'],
                        borderWidth: 2
                    }]
                };
                break;

            case 'monthly_trends':
                // Get monthly processing trends
                const { data: trendData, error: trendError } = await supabase.rpc('get_monthly_trends', {
                    user_id_param: userId,
                    year_param: year || new Date().getFullYear()
                });

                if (trendError) {
                    console.error('Get trend data error:', trendError);
                    return res.status(500).json({
                        error: 'Database error',
                        message: 'Unable to retrieve trend data'
                    });
                }

                chartData = {
                    type: 'line',
                    data: trendData || [],
                    labels: trendData?.map(item => item.month) || [],
                    datasets: [
                        {
                            label: 'Total Parts',
                            data: trendData?.map(item => item.total_parts) || [],
                            borderColor: '#1a1a1a',
                            backgroundColor: 'rgba(26, 26, 26, 0.1)',
                            tension: 0.4
                        },
                        {
                            label: 'Total Labor',
                            data: trendData?.map(item => item.total_labor) || [],
                            borderColor: '#8B4513',
                            backgroundColor: 'rgba(139, 69, 19, 0.1)',
                            tension: 0.4
                        }
                    ]
                };
                break;

            case 'confidence_distribution':
                // Get confidence level distribution
                const { data: confidenceData, error: confidenceError } = await supabase.rpc('get_confidence_distribution', {
                    user_id_param: userId,
                    date_filter: dateFilter
                });

                if (confidenceError) {
                    console.error('Get confidence data error:', confidenceError);
                    return res.status(500).json({
                        error: 'Database error',
                        message: 'Unable to retrieve confidence data'
                    });
                }

                chartData = {
                    type: 'doughnut',
                    data: confidenceData || [],
                    labels: ['High Confidence', 'Medium Confidence', 'Low Confidence'],
                    datasets: [{
                        data: [
                            confidenceData?.[0]?.high_count || 0,
                            confidenceData?.[0]?.medium_count || 0,
                            confidenceData?.[0]?.low_count || 0
                        ],
                        backgroundColor: ['#28a745', '#ffc107', '#dc3545'],
                        borderColor: ['#1e7e34', '#e0a800', '#c82333'],
                        borderWidth: 2
                    }]
                };
                break;

            default:
                return res.status(400).json({
                    error: 'Invalid chart type',
                    message: 'Supported chart types: parts_vs_labor, monthly_trends, confidence_distribution'
                });
        }

        res.json({ chartData });

    } catch (error) {
        console.error('Get charts error:', error);
        res.status(500).json({
            error: 'Internal server error',
            message: 'Unable to retrieve chart data'
        });
    }
});

// Get processing trends over time
router.get('/trends', async (req, res) => {
    try {
        const userId = req.user.id;
        const { period = 'monthly', year } = req.query;

        let query = supabase
            .from('invoices')
            .select(`
                created_at,
                extracted_data,
                batches!inner(user_id)
            `)
            .eq('batches.user_id', userId);

        if (year) {
            query = query.gte('created_at', `${year}-01-01`)
                        .lt('created_at', `${parseInt(year) + 1}-01-01`);
        }

        const { data: invoices, error } = await query;

        if (error) {
            console.error('Get trends error:', error);
            return res.status(500).json({
                error: 'Database error',
                message: 'Unable to retrieve trend data'
            });
        }

        // Process trend data based on period
        const trends = processTrendData(invoices, period);

        res.json({ trends });

    } catch (error) {
        console.error('Get trends error:', error);
        res.status(500).json({
            error: 'Internal server error',
            message: 'Unable to retrieve trend data'
        });
    }
});

// Get processing efficiency metrics
router.get('/efficiency', async (req, res) => {
    try {
        const userId = req.user.id;
        const { year } = req.query;

        let dateFilter = '';
        if (year) {
            dateFilter = `AND DATE_TRUNC('year', created_at) = '${year}-01-01'::date`;
        }

        // Get efficiency metrics
        const { data: efficiency, error } = await supabase.rpc('get_efficiency_metrics', {
            user_id_param: userId,
            date_filter: dateFilter
        });

        if (error) {
            console.error('Get efficiency metrics error:', error);
            return res.status(500).json({
                error: 'Database error',
                message: 'Unable to retrieve efficiency metrics'
            });
        }

        res.json({ efficiency: efficiency[0] || {} });

    } catch (error) {
        console.error('Get efficiency error:', error);
        res.status(500).json({
            error: 'Internal server error',
            message: 'Unable to retrieve efficiency metrics'
        });
    }
});

// Helper function to process trend data
function processTrendData(invoices, period) {
    const trends = {};
    
    invoices.forEach(invoice => {
        const date = new Date(invoice.created_at);
        let key;
        
        switch (period) {
            case 'daily':
                key = date.toISOString().split('T')[0];
                break;
            case 'weekly':
                const weekStart = new Date(date);
                weekStart.setDate(date.getDate() - date.getDay());
                key = weekStart.toISOString().split('T')[0];
                break;
            case 'monthly':
            default:
                key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
                break;
        }

        if (!trends[key]) {
            trends[key] = {
                period: key,
                totalInvoices: 0,
                totalParts: 0,
                totalLabor: 0,
                totalTax: 0,
                flaggedCount: 0,
                highConfidence: 0,
                mediumConfidence: 0,
                lowConfidence: 0
            };
        }

        trends[key].totalInvoices++;
        
        if (invoice.extracted_data) {
            trends[key].totalParts += invoice.extracted_data.parts || 0;
            trends[key].totalLabor += invoice.extracted_data.labor || 0;
            trends[key].totalTax += invoice.extracted_data.tax || 0;
            
            if (invoice.extracted_data.flagged) {
                trends[key].flaggedCount++;
            }

            switch (invoice.extracted_data.confidence) {
                case 'high':
                    trends[key].highConfidence++;
                    break;
                case 'medium':
                    trends[key].mediumConfidence++;
                    break;
                case 'low':
                    trends[key].lowConfidence++;
                    break;
            }
        }
    });

    // Convert to array and sort by period
    return Object.values(trends).sort((a, b) => a.period.localeCompare(b.period));
}

module.exports = router;
