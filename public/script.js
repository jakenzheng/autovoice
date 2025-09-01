// Royal Clarity - Invoice Classifier Frontend JavaScript

// Global authentication state
let currentUser = null;
let authToken = localStorage.getItem('supabase.auth.token');

// Socket.io connection
let socket = null;

// Chart.js instances
let partsLaborChart = null;

class InvoiceClassifier {
    constructor() {
        this.selectedFiles = [];
        this.results = [];
        this.currentBatchId = null;
        // Don't call init() here - it will be called after DOM is loaded
    }

    init() {
        this.setupEventListeners();
        this.setupDragAndDrop();
        this.initializeSocket();
        this.initializeCharts();
    }

    initializeSocket() {
        try {
            socket = io();
            
            socket.on('connect', () => {
                console.log('Connected to server via Socket.io');
            });
            
            socket.on('processing-progress', (data) => {
                this.updateProcessingProgress(data);
            });
            
            socket.on('processing-complete', (data) => {
                this.handleProcessingComplete(data);
            });
            
            socket.on('disconnect', () => {
                console.log('Disconnected from server');
            });
        } catch (error) {
            console.error('Socket.io initialization error:', error);
        }
    }

    initializeCharts() {
        try {
            // Initialize only the parts vs labor pie chart
            const chartOptions = {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        position: 'bottom',
                        labels: {
                            font: {
                                family: 'Inter, sans-serif',
                                size: 12
                            },
                            color: '#1a1a1a'
                        }
                    },
                    tooltip: {
                        callbacks: {
                            label: function(context) {
                                const label = context.label || '';
                                const value = context.parsed || 0;
                                const total = context.dataset.data.reduce((a, b) => a + b, 0);
                                const percentage = total > 0 ? ((value / total) * 100).toFixed(1) : 0;
                                return `${label}: $${value.toFixed(2)} (${percentage}%)`;
                            }
                        }
                    }
                }
            };
            
            // Parts vs Labor Chart
            const partsLaborCtx = document.getElementById('partsLaborChart');
            if (partsLaborCtx) {
                partsLaborChart = new Chart(partsLaborCtx, {
                    type: 'pie',
                    data: {
                        labels: ['Parts', 'Labor'],
                        datasets: [{
                            data: [0, 0],
                            backgroundColor: ['rgba(0, 123, 255, 0.8)', 'rgba(220, 53, 69, 0.8)'], // Blue for parts, Red for labor
                            borderColor: ['rgba(0, 123, 255, 1)', 'rgba(220, 53, 69, 1)'], // Blue border for parts, Red border for labor
                            borderWidth: 2
                        }]
                    },
                    options: chartOptions
                });
            }
        } catch (error) {
            console.error('Chart.js initialization error:', error);
        }
    }

    updateProcessingProgress(data) {
        const processingStatus = document.getElementById('processingStatus');
        const progressFill = document.getElementById('progressFill');
        const progressText = document.getElementById('progressText');
        const currentFile = document.getElementById('currentFile');
        const statusText = document.getElementById('statusText');
        
        if (processingStatus && progressFill && progressText && currentFile && statusText) {
            processingStatus.style.display = 'block';
            progressFill.style.width = `${data.percentage}%`;
            progressText.textContent = `${data.current} / ${data.total} files processed`;
            currentFile.textContent = data.filename;
            statusText.textContent = `Processing ${data.filename}...`;
        }
    }

    handleProcessingComplete(data) {
        const processingStatus = document.getElementById('processingStatus');
        const statusText = document.getElementById('statusText');
        const spinner = document.querySelector('.spinner');
        
        if (processingStatus && statusText && spinner) {
            statusText.textContent = 'Processing complete!';
            spinner.style.display = 'none';
            
            setTimeout(() => {
                processingStatus.style.display = 'none';
            }, 3000);
            
            // Update analytics if available
            if (data.summary) {
                this.updateAnalytics(data.summary);
            }
        }
    }

    updateAnalytics(summary) {
        // Update summary cards with real-time data
        const totalParts = document.getElementById('totalParts');
        const totalLabor = document.getElementById('totalLabor');
        const totalTax = document.getElementById('totalTax');
        const processedCount = document.getElementById('processedCount');
        const flaggedCount = document.getElementById('flaggedCount');
        
        if (totalParts) totalParts.textContent = `$${summary.totalParts.toFixed(2)}`;
        if (totalLabor) totalLabor.textContent = `$${summary.totalLabor.toFixed(2)}`;
        if (totalTax) totalTax.textContent = `$${summary.totalTax.toFixed(2)}`;
        if (processedCount) processedCount.textContent = summary.processedCount;
        if (flaggedCount) flaggedCount.textContent = `${summary.flaggedCount} flagged`;
        
        // Update pie chart if analytics section is visible
        const analyticsSection = document.getElementById('analyticsSection');
        if (analyticsSection && analyticsSection.style.display !== 'none' && partsLaborChart) {
            // Get current chart data and add new values
            const currentData = partsLaborChart.data.datasets[0].data;
            const newParts = currentData[0] + summary.totalParts;
            const newLabor = currentData[1] + summary.totalLabor;
            
            partsLaborChart.data.datasets[0].data = [newParts, newLabor];
            partsLaborChart.update();
        }
    }

    updateField(index, field, value) {
        if (index >= 0 && index < this.results.length) {
            const result = this.results[index];
            const numValue = parseFloat(value) || 0;
            
            // Update the result
            result[field] = numValue;
            
            // Update summary totals
            this.updateSummaryTotals();
            
            // Update the pie chart if analytics is visible
            this.updatePieChartFromCurrentResults();
            
            this.showToast(`${field.charAt(0).toUpperCase() + field.slice(1)} updated to $${numValue.toFixed(2)}`, 'success');
        }
    }

    async toggleStatus(index) {
        if (index >= 0 && index < this.results.length) {
            const result = this.results[index];
            
            // Only allow toggling if the document is flagged
            if (!result.flagged) {
                this.showToast('Only flagged documents can be updated to approved', 'info');
                return;
            }

            try {
                // Update the result locally first
                result.flagged = false;
                
                // Update the UI immediately
                this.populateResultsTable();
                this.updateSummaryTotals();
                
                // Show success message
                this.showToast('Document status updated to approved', 'success');
                
                // If we have a batch ID, update the backend
                if (this.currentBatchId && result.invoice_id) {
                    await this.updateInvoiceStatus(result.invoice_id, false);
                }
                
            } catch (error) {
                console.error('Error updating status:', error);
                // Revert the change if there was an error
                result.flagged = true;
                this.populateResultsTable();
                this.updateSummaryTotals();
                this.showToast('Error updating status. Please try again.', 'error');
            }
        }
    }

    async updateInvoiceStatus(invoiceId, flagged) {
        try {
            const response = await fetch(`/api/invoices/${invoiceId}/flag`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${localStorage.getItem('supabase.auth.token')}`
                },
                body: JSON.stringify({ flagged })
            });

            if (!response.ok) {
                throw new Error('Failed to update invoice status');
            }

            return await response.json();
        } catch (error) {
            console.error('Error updating invoice status:', error);
            throw error;
        }
    }

    updateSummaryTotals() {
        let totalParts = 0;
        let totalLabor = 0;
        let totalTax = 0;
        let flaggedCount = 0;
        
        this.results.forEach(result => {
            totalParts += parseFloat(result.parts) || 0;
            totalLabor += parseFloat(result.labor) || 0;
            totalTax += parseFloat(result.tax) || 0;
            if (result.flagged) flaggedCount++;
        });
        
        // Update summary cards
        const totalPartsEl = document.getElementById('totalParts');
        const totalLaborEl = document.getElementById('totalLabor');
        const totalTaxEl = document.getElementById('totalTax');
        const processedCountEl = document.getElementById('processedCount');
        const flaggedCountEl = document.getElementById('flaggedCount');
        
        if (totalPartsEl) totalPartsEl.textContent = `$${totalParts.toFixed(2)}`;
        if (totalLaborEl) totalLaborEl.textContent = `$${totalLabor.toFixed(2)}`;
        if (totalTaxEl) totalTaxEl.textContent = `$${totalTax.toFixed(2)}`;
        if (processedCountEl) processedCountEl.textContent = this.results.length;
        if (flaggedCountEl) flaggedCountEl.textContent = `${flaggedCount} flagged`;
    }

    updatePieChartFromCurrentResults() {
        if (!partsLaborChart) return;
        
        let totalParts = 0;
        let totalLabor = 0;
        
        this.results.forEach(result => {
            totalParts += parseFloat(result.parts) || 0;
            totalLabor += parseFloat(result.labor) || 0;
        });
        
        partsLaborChart.data.datasets[0].data = [totalParts, totalLabor];
        partsLaborChart.update();
    }



    viewBatchDetails(batchId) {
        // TODO: Implement batch details view
        this.showToast('Batch details view coming soon', 'info');
    }

    setupEventListeners() {
        // Remove existing event listeners to prevent duplicates
        const fileInput = document.getElementById('fileInput');
        const processBtn = document.getElementById('processBtn');
        const closeModal = document.getElementById('closeModal');
        const imageModal = document.getElementById('imageModal');

        // Clone and replace elements to remove existing listeners
        if (fileInput) {
            const newFileInput = fileInput.cloneNode(true);
            fileInput.parentNode.replaceChild(newFileInput, fileInput);
            newFileInput.addEventListener('change', (e) => {
                this.handleFileSelection(e.target.files);
            });
        }

        if (processBtn) {
            const newProcessBtn = processBtn.cloneNode(true);
            processBtn.parentNode.replaceChild(newProcessBtn, processBtn);
            newProcessBtn.addEventListener('click', () => {
                this.processInvoices();
            });
        }

        if (closeModal) {
            const newCloseModal = closeModal.cloneNode(true);
            closeModal.parentNode.replaceChild(newCloseModal, closeModal);
            newCloseModal.addEventListener('click', () => {
                this.closeImageModal();
            });
        }

        if (imageModal) {
            const newImageModal = imageModal.cloneNode(true);
            imageModal.parentNode.replaceChild(newImageModal, imageModal);
            newImageModal.addEventListener('click', (e) => {
                if (e.target.id === 'imageModal') {
                    this.closeImageModal();
                }
            });
        }
    }

    setupDragAndDrop() {
        const uploadArea = document.getElementById('uploadArea');

        // Prevent default drag behaviors
        ['dragenter', 'dragover', 'dragleave', 'drop'].forEach(eventName => {
            uploadArea.addEventListener(eventName, preventDefaults, false);
            document.body.addEventListener(eventName, preventDefaults, false);
        });

        // Highlight drop area when item is dragged over it
        ['dragenter', 'dragover'].forEach(eventName => {
            uploadArea.addEventListener(eventName, highlight, false);
        });

        ['dragleave', 'drop'].forEach(eventName => {
            uploadArea.addEventListener(eventName, unhighlight, false);
        });

        // Handle dropped files
        uploadArea.addEventListener('drop', (e) => {
            const dt = e.dataTransfer;
            const files = dt.files;
            this.handleFileSelection(files);
        });

        function preventDefaults(e) {
            e.preventDefault();
            e.stopPropagation();
        }

        function highlight(e) {
            uploadArea.classList.add('dragover');
        }

        function unhighlight(e) {
            uploadArea.classList.remove('dragover');
        }
    }

    handleFileSelection(files) {
        const validFiles = Array.from(files).filter(file => {
            const validTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/bmp', 'image/tiff'];
            const maxSize = 10 * 1024 * 1024; // 10MB for Vercel compatibility

            if (!validTypes.includes(file.type)) {
                this.showToast(`Invalid file type: ${file.name}`, 'error');
                return false;
            }

            if (file.size > maxSize) {
                this.showToast(`File too large: ${file.name}`, 'error');
                return false;
            }

            return true;
        });

        if (validFiles.length === 0) {
            return;
        }

        // Add new files to existing selection
        this.selectedFiles = [...this.selectedFiles, ...validFiles];
        this.updateFilePreview();
        this.showToast(`${validFiles.length} file(s) added`, 'success');
    }

    updateFilePreview() {
        const filePreview = document.getElementById('filePreview');
        const fileList = document.getElementById('fileList');

        if (this.selectedFiles.length === 0) {
            filePreview.style.display = 'none';
            return;
        }

        fileList.innerHTML = '';
        this.selectedFiles.forEach((file, index) => {
            const fileItem = document.createElement('div');
            fileItem.className = 'file-item';
            
            fileItem.innerHTML = `
                <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
                    <rect x="2" y="2" width="16" height="16" rx="2" stroke="currentColor" stroke-width="1.5" fill="none"/>
                    <path d="M6 6L14 6" stroke="currentColor" stroke-width="1.5"/>
                    <path d="M6 10L14 10" stroke="currentColor" stroke-width="1.5"/>
                    <path d="M6 14L10 14" stroke="currentColor" stroke-width="1.5"/>
                </svg>
                <div class="file-info">
                    <div class="file-name">${file.name}</div>
                    <div class="file-size">${this.formatFileSize(file.size)}</div>
                </div>
                <button onclick="window.invoiceClassifier.removeFile(${index})" style="background: none; border: none; cursor: pointer; padding: 4px; color: var(--royal-gray);">
                    <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                        <path d="M4 4L12 12" stroke="currentColor" stroke-width="1.5"/>
                        <path d="M12 4L4 12" stroke="currentColor" stroke-width="1.5"/>
                    </svg>
                </button>
            `;
            
            fileList.appendChild(fileItem);
        });

        filePreview.style.display = 'block';
    }

    removeFile(index) {
        this.selectedFiles.splice(index, 1);
        this.updateFilePreview();
        this.showToast('File removed', 'success');
    }

    formatFileSize(bytes) {
        if (bytes === 0) return '0 Bytes';
        const k = 1024;
        const sizes = ['Bytes', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    }

    async processInvoices() {
        if (this.selectedFiles.length === 0) {
            this.showToast('Please select files to process', 'warning');
            return;
        }

        // Show loading section
        document.getElementById('uploadTab').style.display = 'none';
        document.getElementById('loadingSection').style.display = 'block';
        document.getElementById('resultsTab').style.display = 'none';

        const formData = new FormData();
        this.selectedFiles.forEach(file => {
            formData.append('invoices', file);
        });

        try {
            this.updateProgress(10);
            this.updateProcessingStatus('Preparing files...');

            // Add batch information if user is authenticated
            if (currentUser) {
                const batchName = document.getElementById('batchName')?.value || `Batch ${new Date().toLocaleDateString()}`;
                const description = document.getElementById('batchDescription')?.value || '';
                formData.append('batchName', batchName);
                formData.append('description', description);
            }

            const response = await fetch('/upload', {
                method: 'POST',
                body: formData
            });

            this.updateProgress(30);
            this.updateProcessingStatus('Uploading documents...');

            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            this.updateProgress(60);
            this.updateProcessingStatus('Processing with AI...');

            const result = await response.json();

            this.updateProgress(90);
            this.updateProcessingStatus('Finalizing results...');

            if (result.success) {
                this.results = result.results;
                this.currentBatchId = result.batchId;
                
                // Join Socket.io room for real-time updates if batch ID exists
                if (result.batchId && socket) {
                    socket.emit('join-batch', result.batchId);
                }
                
                this.displayResults(result.summary);
                this.updateProgress(100);
                this.updateProcessingStatus('Complete!');
                
                setTimeout(() => {
                    this.showToast(`Processed ${result.summary.processedCount} documents successfully`, 'success');
                }, 500);
            } else {
                throw new Error(result.error || 'Processing failed');
            }

        } catch (error) {
            console.error('Processing error:', error);
            this.showToast(`Processing failed: ${error.message}`, 'error');
            this.showUploadSection();
        }
    }

    updateProgress(percentage) {
        const progressFill = document.getElementById('progressFill');
        progressFill.style.width = `${percentage}%`;
    }

    updateProcessingStatus(message) {
        const statusElement = document.getElementById('processingStatus');
        if (statusElement) {
            statusElement.textContent = message;
        }
    }

    displayResults(summary) {
        // Update summary cards
        document.getElementById('totalParts').textContent = this.formatCurrency(summary.totalParts);
        document.getElementById('totalLabor').textContent = this.formatCurrency(summary.totalLabor);
        document.getElementById('totalTax').textContent = this.formatCurrency(summary.totalTax);
        document.getElementById('processedCount').textContent = summary.processedCount;
        document.getElementById('flaggedCount').textContent = `${summary.flaggedCount} flagged`;

        // Populate results table
        this.populateResultsTable();

        // Show results section
        document.getElementById('loadingSection').style.display = 'none';
        document.getElementById('resultsTab').style.display = 'block';
        
        // Switch to results tab
        switchContentTab('results');
    }

    populateResultsTable() {
        const tableBody = document.getElementById('resultsTableBody');
        tableBody.innerHTML = '';

        this.results.forEach((result, index) => {
            const row = document.createElement('tr');
            
            const statusClass = result.flagged ? 'status-flagged' : 'status-success';
            const statusText = result.flagged ? 'Flagged' : 'Success';
            
            const confidenceClass = `confidence-${result.confidence || 'medium'}`;
            const confidenceText = result.confidence || 'medium';

            // Create clickable filename
            const filenameCell = result.filename ? 
                `<span class="clickable-filename" onclick="window.invoiceClassifier.showImageModal('${result.filename}', ${index})">${result.filename}</span>` : 
                'Unknown';

            row.innerHTML = `
                <td>${filenameCell}</td>
                <td>
                    <input type="number" class="editable-field" data-field="parts" data-index="${index}" 
                           value="${result.parts || 0}" step="0.01" min="0" 
                           onchange="window.invoiceClassifier.updateField(${index}, 'parts', this.value)">
                </td>
                <td>
                    <input type="number" class="editable-field" data-field="labor" data-index="${index}" 
                           value="${result.labor || 0}" step="0.01" min="0" 
                           onchange="window.invoiceClassifier.updateField(${index}, 'labor', this.value)">
                </td>
                <td>
                    <input type="number" class="editable-field" data-field="tax" data-index="${index}" 
                           value="${typeof result.tax === 'number' ? result.tax : 0}" step="0.01" min="0" 
                           onchange="window.invoiceClassifier.updateField(${index}, 'tax', this.value)">
                </td>
                <td><span class="status-badge ${statusClass} clickable-status" onclick="window.invoiceClassifier.toggleStatus(${index})">${statusText}</span></td>
                <td><span class="confidence-badge ${confidenceClass}">${confidenceText}</span></td>
                <td><span class="reasoning-text">${result.reasoning || 'AI analysis completed'}</span></td>
                <td>
                    <button class="view-btn" onclick="window.invoiceClassifier.showImageModal('${result.filename}', ${index})">
                        <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                            <path d="M8 2C11.3137 2 14 4.68629 14 8C14 11.3137 11.3137 14 8 14C4.68629 14 2 11.3137 2 8C2 4.68629 4.68629 2 8 2Z" stroke="currentColor" stroke-width="1.5" fill="none"/>
                            <path d="M8 5C6.34315 5 5 6.34315 5 8C5 9.65685 6.34315 11 8 11C9.65685 11 11 9.65685 11 8C11 6.34315 9.65685 5 8 5Z" stroke="currentColor" stroke-width="1.5" fill="none"/>
                            <path d="M8 6.5C7.17157 6.5 6.5 7.17157 6.5 8C6.5 8.82843 7.17157 9.5 8 9.5C8.82843 9.5 9.5 8.82843 9.5 8C9.5 7.17157 8.82843 6.5 8 6.5Z" stroke="currentColor" stroke-width="1.5" fill="none"/>
                        </svg>
                    </button>
                </td>
            `;
            
            tableBody.appendChild(row);
        });
    }

    formatCurrency(amount) {
        if (typeof amount === 'string') {
            return amount;
        }
        return new Intl.NumberFormat('en-US', {
            style: 'currency',
            currency: 'USD'
        }).format(amount || 0);
    }

    showUploadSection() {
        document.getElementById('loadingSection').style.display = 'none';
        document.getElementById('resultsTab').style.display = 'none';
        document.getElementById('uploadTab').style.display = 'block';
        
        // Switch to upload tab
        switchContentTab('upload');
    }

    resetApp() {
        this.selectedFiles = [];
        this.results = [];
        
        // Reset file input if it exists
        const fileInput = document.getElementById('fileInput');
        if (fileInput) {
            fileInput.value = '';
        }
        
        // Hide file preview if it exists
        const filePreview = document.getElementById('filePreview');
        if (filePreview) {
            filePreview.style.display = 'none';
        }
        
        // Clear file list if it exists
        const fileList = document.getElementById('fileList');
        if (fileList) {
            fileList.innerHTML = '';
        }
        
        this.showUploadSection();
        this.showToast('Ready for new batch', 'success');
    }

    exportResults() {
        if (this.results.length === 0) {
            this.showToast('No results to export', 'warning');
            return;
        }

        const csvContent = this.generateCSV();
        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement('a');
        
        if (link.download !== undefined) {
            const url = URL.createObjectURL(blob);
            link.setAttribute('href', url);
            link.setAttribute('download', `invoice_results_${new Date().toISOString().split('T')[0]}.csv`);
            link.style.visibility = 'hidden';
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
        }

        this.showToast('Results exported successfully', 'success');
    }

    generateCSV() {
        const headers = ['Filename', 'Parts', 'Labor', 'Tax', 'Status', 'Confidence'];
        const rows = this.results.map(result => [
            result.filename || 'Unknown',
            result.parts || 0,
            result.labor || 0,
            typeof result.tax === 'string' ? result.tax : (result.tax || 0),
            result.flagged ? 'Flagged' : 'Success',
            result.confidence || 'medium'
        ]);

        return [headers, ...rows]
            .map(row => row.map(cell => `"${cell}"`).join(','))
            .join('\n');
    }

    showImageModal(filename, index) {
        const modal = document.getElementById('imageModal');
        const modalImage = document.getElementById('modalImage');
        const modalTitle = document.getElementById('modalTitle');
        
        // Get result data for this file
        const result = this.results[index];
        
        modalTitle.textContent = filename;
        modal.classList.add('show');
        
        // Prevent body scroll
        document.body.style.overflow = 'hidden';
        
        // Update modal info
        if (result) {
            document.getElementById('modalParts').textContent = this.formatCurrency(result.parts || 0);
            document.getElementById('modalLabor').textContent = this.formatCurrency(result.labor || 0);
            document.getElementById('modalTax').textContent = typeof result.tax === 'string' ? result.tax : this.formatCurrency(result.tax || 0);
            document.getElementById('modalStatus').textContent = result.flagged ? 'Flagged' : 'Success';
            document.getElementById('modalConfidence').textContent = result.confidence || 'Medium';
            
            // Set status color
            const statusElement = document.getElementById('modalStatus');
            statusElement.className = result.flagged ? 'status-flagged' : 'status-success';
        }
        
        // Try to show thumbnail if available
        if (result && result.thumbnail_url) {
            modalImage.src = result.thumbnail_url;
            modalImage.style.display = 'block';
        } else {
            // Show placeholder for Vercel deployment
            modalImage.src = '';
            modalImage.style.display = 'none';
            const message = document.createElement('p');
            message.textContent = 'Thumbnail not available in this deployment. Files are processed in memory for security.';
            message.style.textAlign = 'center';
            message.style.color = 'var(--royal-gray)';
            message.style.padding = 'var(--space-4)';
            modal.querySelector('.modal-body').insertBefore(message, modal.querySelector('.image-info'));
        }
    }

    closeImageModal() {
        const modal = document.getElementById('imageModal');
        modal.classList.remove('show');
        document.body.style.overflow = 'auto';
    }

    showToast(message, type = 'info') {
        const toastContainer = document.getElementById('toastContainer');
        const toast = document.createElement('div');
        toast.className = `toast ${type}`;
        
        toast.innerHTML = `
            <div class="toast-content">
                <div class="toast-title">${type.charAt(0).toUpperCase() + type.slice(1)}</div>
                <div class="toast-message">${message}</div>
            </div>
        `;

        toastContainer.appendChild(toast);

        // Auto remove after 5 seconds
        setTimeout(() => {
            if (toast.parentNode) {
                toast.parentNode.removeChild(toast);
            }
        }, 5000);
    }

    // Authentication methods
    async checkAuthStatus() {
        try {
            // Get the stored session token
            const sessionToken = localStorage.getItem('supabase.auth.token');
            
            if (!sessionToken) {
                console.log('No session token found, logging out');
                this.logout();
                return;
            }

            console.log('Checking auth status with token:', sessionToken.substring(0, 20) + '...');

            const response = await fetch('/api/auth/me', {
                headers: {
                    'Authorization': `Bearer ${sessionToken}`
                }
            });
            
            if (response.ok) {
                const data = await response.json();
                currentUser = data.user;
                authToken = sessionToken; // Ensure authToken is set
                console.log('Auth check successful, user:', currentUser);
                this.updateAuthUI();
            } else {
                console.log('Auth check failed:', response.status, response.statusText);
                this.logout();
            }
        } catch (error) {
            console.error('Auth check error:', error);
            this.logout();
        }
    }

    updateAuthUI() {
        const authButtons = document.getElementById('authButtons');
        const userMenu = document.getElementById('userMenu');
        const userName = document.getElementById('userName');
        const welcomeSection = document.getElementById('welcomeSection');
        const mainContent = document.getElementById('mainContent');

        console.log('updateAuthUI called, currentUser:', currentUser);

        if (currentUser) {
            // User is authenticated - show main content, hide welcome
            console.log('User authenticated, showing main content');
            authButtons.style.display = 'none';
            userMenu.style.display = 'flex';
            userName.textContent = `${currentUser.firstName} ${currentUser.lastName}`;
            welcomeSection.style.display = 'none';
            mainContent.style.display = 'block';
            
            // Show upload tab by default
            switchContentTab('upload');
        } else {
            // User is not authenticated - show welcome, hide main content
            console.log('User not authenticated, showing welcome section');
            authButtons.style.display = 'flex';
            userMenu.style.display = 'none';
            welcomeSection.style.display = 'block';
            mainContent.style.display = 'none';
        }
    }

    updateAnalytics() {
        // Update analytics data when needed
        const analyticsTotalParts = document.getElementById('analyticsTotalParts');
        const analyticsTotalLabor = document.getElementById('analyticsTotalLabor');
        const analyticsProcessedCount = document.getElementById('analyticsProcessedCount');
        const analyticsFlaggedCount = document.getElementById('analyticsFlaggedCount');
        
        if (analyticsTotalParts && this.results.length > 0) {
            const totalParts = this.results.reduce((sum, result) => sum + (parseFloat(result.parts) || 0), 0);
            const totalLabor = this.results.reduce((sum, result) => sum + (parseFloat(result.labor) || 0), 0);
            const flaggedCount = this.results.filter(result => result.flagged).length;
            
            analyticsTotalParts.textContent = `$${totalParts.toFixed(2)}`;
            analyticsTotalLabor.textContent = `$${totalLabor.toFixed(2)}`;
            analyticsProcessedCount.textContent = this.results.length;
            analyticsFlaggedCount.textContent = flaggedCount;
        }
    }

    logout() {
        currentUser = null;
        authToken = null;
        localStorage.removeItem('supabase.auth.token');
        localStorage.removeItem('supabase.auth.refreshToken');
        this.updateAuthUI();
        this.showToast('Logged out successfully', 'success');
    }
}

// Global functions for HTML onclick handlers
function processInvoices() {
    window.invoiceClassifier.processInvoices();
}

function resetApp() {
    window.invoiceClassifier.resetApp();
}

function exportResults() {
    window.invoiceClassifier.exportResults();
}

// Authentication functions
async function handleLogin(event) {
    event.preventDefault();
    
    const email = document.getElementById('loginEmail').value;
    const password = document.getElementById('loginPassword').value;
    
    try {
        const response = await fetch('/api/auth/signin', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ email, password })
        });
        
        const data = await response.json();
        
        if (response.ok) {
            currentUser = data.user;
            // Store the session token
            if (data.session) {
                localStorage.setItem('supabase.auth.token', data.session.access_token);
                authToken = data.session.access_token;
                if (data.session.refresh_token) {
                    localStorage.setItem('supabase.auth.refreshToken', data.session.refresh_token);
                }
            }
            
            console.log('Login successful, user:', currentUser);
            window.invoiceClassifier.updateAuthUI();
            closeLoginModal();
            window.invoiceClassifier.showToast('Login successful! Welcome back.', 'success');
        } else {
            window.invoiceClassifier.showToast(data.message || 'Login failed', 'error');
        }
    } catch (error) {
        console.error('Login error:', error);
        window.invoiceClassifier.showToast('Login failed', 'error');
    }
}

async function handleRegister(event) {
    event.preventDefault();
    
    const firstName = document.getElementById('registerFirstName').value;
    const lastName = document.getElementById('registerLastName').value;
    const email = document.getElementById('registerEmail').value;
    const businessName = document.getElementById('registerBusinessName').value;
    const password = document.getElementById('registerPassword').value;
    
    try {
        const response = await fetch('/api/auth/signup', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ 
                firstName, 
                lastName, 
                email, 
                businessName, 
                password 
            })
        });
        
        const data = await response.json();
        
        if (response.ok) {
            currentUser = data.user;
            window.invoiceClassifier.updateAuthUI();
            closeRegisterModal();
            window.invoiceClassifier.showToast('Registration successful! Please check your email to verify your account.', 'success');
            
            // If user is immediately authenticated (no email verification required), show main content
            if (data.user) {
                window.invoiceClassifier.updateAuthUI();
            }
        } else {
            window.invoiceClassifier.showToast(data.message || 'Registration failed', 'error');
        }
    } catch (error) {
        console.error('Registration error:', error);
        window.invoiceClassifier.showToast('Registration failed', 'error');
    }
}

function showLoginModal() {
    document.getElementById('loginModal').style.display = 'flex';
}

function closeLoginModal() {
    document.getElementById('loginModal').style.display = 'none';
    document.getElementById('loginForm').reset();
}

function showRegisterModal() {
    document.getElementById('registerModal').style.display = 'flex';
}

function closeRegisterModal() {
    document.getElementById('registerModal').style.display = 'none';
    document.getElementById('registerForm').reset();
}

function switchToRegister() {
    closeLoginModal();
    showRegisterModal();
}

function switchToLogin() {
    closeRegisterModal();
    showLoginModal();
}

function toggleUserMenu() {
    const dropdown = document.getElementById('userDropdown');
    dropdown.style.display = dropdown.style.display === 'block' ? 'none' : 'block';
}

function showDashboard() {
    document.getElementById('dashboardModal').style.display = 'flex';
    loadDashboard();
}

function closeDashboardModal() {
    document.getElementById('dashboardModal').style.display = 'none';
}

function switchTab(tabName) {
    // Hide all tab contents
    document.querySelectorAll('.tab-content').forEach(content => {
        content.style.display = 'none';
    });
    
    // Remove active class from all tab buttons
    document.querySelectorAll('.tab-btn').forEach(btn => {
        btn.classList.remove('active');
    });
    
    // Show selected tab content
    document.getElementById(`${tabName}Tab`).style.display = 'block';
    
    // Add active class to selected tab button
    event.target.classList.add('active');
}

async function loadDashboard() {
    if (!currentUser) return;
    
    try {
        const response = await fetch('/api/batches', {
            headers: {
                'Authorization': `Bearer ${authToken}`
            }
        });
        
        if (response.ok) {
            const data = await response.json();
            displayBatches(data.batches);
        }
    } catch (error) {
        console.error('Dashboard load error:', error);
    }
}

function displayBatches(batches) {
    const batchesList = document.getElementById('batchesList');
    
    if (batches.length === 0) {
        batchesList.innerHTML = '<p>No batches found. Process some invoices to see them here.</p>';
        return;
    }
    
    batchesList.innerHTML = batches.map(batch => {
        const createdDate = new Date(batch.created_at).toLocaleDateString();
        const completedDate = batch.completed_at ? new Date(batch.completed_at).toLocaleDateString() : 'In Progress';
        
        return `
            <div class="batch-item">
                <h5>${batch.batch_name}</h5>
                <p>Status: ${batch.status}</p>
                <p>Created: ${createdDate}</p>
                ${batch.completed_at ? `<p>Completed: ${completedDate}</p>` : ''}
                <div class="batch-stats">
                    <span class="batch-stat">Invoices: ${batch.processed_invoices || 0}</span>
                    <span class="batch-stat">Parts: $${(batch.total_parts || 0).toFixed(2)}</span>
                    <span class="batch-stat">Labor: $${(batch.total_labor || 0).toFixed(2)}</span>
                    <span class="batch-stat">Tax: $${(batch.total_tax || 0).toFixed(2)}</span>
                </div>
            </div>
        `;
    }).join('');
}

function updatePieChartFromBatches(batches) {
        if (!partsLaborChart) return;
        
        let totalParts = 0;
        let totalLabor = 0;
        
        // Calculate totals from all batches using the new schema
        batches.forEach(batch => {
            totalParts += batch.total_parts || 0;
            totalLabor += batch.total_labor || 0;
        });
        
        // Update chart data
        partsLaborChart.data.datasets[0].data = [totalParts, totalLabor];
        partsLaborChart.update();
    }



async function logout() {
    try {
        const response = await fetch('/api/auth/signout', {
            method: 'POST'
        });
        
        if (response.ok) {
            window.invoiceClassifier.logout();
        } else {
            window.invoiceClassifier.showToast('Logout failed', 'error');
        }
    } catch (error) {
        console.error('Logout error:', error);
        window.invoiceClassifier.logout();
    }
}

// Initialize the application when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    window.invoiceClassifier = new InvoiceClassifier();
    window.invoiceClassifier.init();
    
    // Check authentication status on page load
    window.invoiceClassifier.checkAuthStatus();
});

// Analytics functions
function showUploadSection() {
    // Switch to upload tab
    switchContentTab('upload');
    
    // Update navigation active state
    updateNavigationActive('showUploadSection');
}

function switchContentTab(tabName) {
    // Hide all content tabs
    const contentTabs = document.querySelectorAll('.content-tab');
    contentTabs.forEach(tab => {
        tab.classList.remove('active');
    });
    
    // Remove active class from all tab buttons
    const tabButtons = document.querySelectorAll('.content-tabs .tab-btn');
    tabButtons.forEach(btn => {
        btn.classList.remove('active');
    });
    
    // Show selected tab content
    const selectedTab = document.getElementById(tabName + 'Tab');
    if (selectedTab) {
        selectedTab.classList.add('active');
    }
    
    // Add active class to selected tab button
    const selectedButton = document.querySelector(`[onclick="switchContentTab('${tabName}')"]`);
    if (selectedButton) {
        selectedButton.classList.add('active');
    }
    
    // Update analytics if switching to analytics tab
    if (tabName === 'analytics' && window.invoiceClassifier) {
        window.invoiceClassifier.updateAnalytics();
    }
}

function showDashboard() {
    // Switch to dashboard tab
    switchContentTab('dashboard');
}

function showAnalytics() {
    // Switch to analytics tab
    switchContentTab('analytics');
}





function updateNavigationActive(activePage) {
    const navLinks = document.querySelectorAll('.nav-link');
    navLinks.forEach(link => {
        link.classList.remove('active');
    });
    
    const activeLink = document.querySelector(`[onclick*="${activePage}"]`);
    if (activeLink) {
        activeLink.classList.add('active');
    }
}














    



