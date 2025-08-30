// Royal Clarity - Invoice Classifier Frontend JavaScript

// Global authentication state
let currentUser = null;
let authToken = localStorage.getItem('supabase.auth.token');

class InvoiceClassifier {
    constructor() {
        this.selectedFiles = [];
        this.results = [];
        this.init();
        this.checkAuthStatus();
    }

    init() {
        this.setupEventListeners();
        this.setupDragAndDrop();
    }

    setupEventListeners() {
        // Unified file input change
        document.getElementById('fileInput').addEventListener('change', (e) => {
            this.handleFileSelection(e.target.files);
        });

        // Process button
        document.getElementById('processBtn').addEventListener('click', () => {
            this.processInvoices();
        });

        // Modal close button
        document.getElementById('closeModal').addEventListener('click', () => {
            this.closeImageModal();
        });

        // Close modal when clicking outside
        document.getElementById('imageModal').addEventListener('click', (e) => {
            if (e.target.id === 'imageModal') {
                this.closeImageModal();
            }
        });
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
        document.getElementById('uploadSection').style.display = 'none';
        document.getElementById('loadingSection').style.display = 'block';
        document.getElementById('resultsSection').style.display = 'none';

        const formData = new FormData();
        this.selectedFiles.forEach(file => {
            formData.append('invoices', file);
        });

        try {
            this.updateProgress(10);
            this.updateProcessingStatus('Preparing files...');

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
        document.getElementById('resultsSection').style.display = 'block';
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
                <td>${this.formatCurrency(result.parts || 0)}</td>
                <td>${this.formatCurrency(result.labor || 0)}</td>
                <td>${typeof result.tax === 'string' ? result.tax : this.formatCurrency(result.tax || 0)}</td>
                <td><span class="status-badge ${statusClass}">${statusText}</span></td>
                <td><span class="confidence-badge ${confidenceClass}">${confidenceText}</span></td>
                <td><button class="view-btn" onclick="window.invoiceClassifier.showImageModal('${result.filename}', ${index})">
                    <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                        <path d="M8 2C11.3137 2 14 4.68629 14 8C14 11.3137 11.3137 14 8 14C4.68629 14 2 11.3137 2 8C2 4.68629 4.68629 2 8 2Z" stroke="currentColor" stroke-width="1.5" fill="none"/>
                        <path d="M8 5C6.34315 5 5 6.34315 5 8C5 9.65685 6.34315 11 8 11C9.65685 11 11 9.65685 11 8C11 6.34315 9.65685 5 8 5Z" stroke="currentColor" stroke-width="1.5" fill="none"/>
                        <path d="M8 6.5C7.17157 6.5 6.5 7.17157 6.5 8C6.5 8.82843 7.17157 9.5 8 9.5C8.82843 9.5 9.5 8.82843 9.5 8C9.5 7.17157 8.82843 6.5 8 6.5Z" fill="currentColor"/>
                    </svg>
                </button></td>
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
        document.getElementById('resultsSection').style.display = 'none';
        document.getElementById('uploadSection').style.display = 'block';
    }

    resetApp() {
        this.selectedFiles = [];
        this.results = [];
        document.getElementById('singleFileInput').value = '';
        document.getElementById('multipleFileInput').value = '';
        document.getElementById('filePreview').style.display = 'none';
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
        
        // Note: File viewing is disabled in Vercel deployment
        modalTitle.textContent = filename;
        modalImage.src = ''; // No image available in Vercel deployment
        modal.classList.add('show');
        
        // Prevent body scroll
        document.body.style.overflow = 'hidden';
        
        // Show a message that file viewing is not available
        modalImage.alt = 'File viewing not available in Vercel deployment';
        modalImage.style.display = 'none';
        const message = document.createElement('p');
        message.textContent = 'File viewing is not available in this deployment. Files are processed in memory for security.';
        message.style.textAlign = 'center';
        message.style.color = 'var(--royal-gray)';
        modal.querySelector('.modal-content').appendChild(message);
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
            const response = await fetch('/api/auth/me');
            
            if (response.ok) {
                const data = await response.json();
                currentUser = data.user;
                this.updateAuthUI();
            } else {
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

        if (currentUser) {
            authButtons.style.display = 'none';
            userMenu.style.display = 'flex';
            userName.textContent = `${currentUser.firstName} ${currentUser.lastName}`;
        } else {
            authButtons.style.display = 'flex';
            userMenu.style.display = 'none';
        }
    }

    logout() {
        currentUser = null;
        authToken = null;
        localStorage.removeItem('supabase.auth.token');
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
            }
            
            window.invoiceClassifier.updateAuthUI();
            closeLoginModal();
            window.invoiceClassifier.showToast('Login successful', 'success');
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
    
    batchesList.innerHTML = batches.map(batch => `
        <div class="batch-item">
            <h4>${batch.batch_name}</h4>
            <p>Status: ${batch.status}</p>
            <p>Invoices: ${batch.total_invoices}</p>
            <p>Created: ${new Date(batch.created_at).toLocaleDateString()}</p>
        </div>
    `).join('');
}

function showProfile() {
    // TODO: Implement profile management
    window.invoiceClassifier.showToast('Profile management coming soon', 'info');
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
});
