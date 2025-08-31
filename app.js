class MultiImageOCRTool {
    constructor() {
        this.worker = null;
        this.isProcessing = false;
        this.imageQueue = [];
        this.processedResults = [];
        this.failedImages = [];
        this.currentImageIndex = 0;
        
        this.initializeElements();
        this.checkBrowserCompatibility();
        this.setupEventListeners();
    }

    initializeElements() {
        // Upload elements
        this.uploadArea = document.getElementById('uploadArea');
        this.fileInput = document.getElementById('fileInput');
        this.languageSelect = document.getElementById('languageSelect');
        
        // Control elements
        this.controlsSection = document.getElementById('controlsSection');
        this.queueInfo = document.getElementById('queueInfo');
        this.startProcessingBtn = document.getElementById('startProcessing');
        this.clearQueueBtn = document.getElementById('clearQueue');
        
        // Queue elements
        this.queueSection = document.getElementById('queueSection');
        this.imageGrid = document.getElementById('imageGrid');
        
        // Progress elements
        this.overallProgressSection = document.getElementById('overallProgressSection');
        this.overallProgressFill = document.getElementById('overallProgressFill');
        this.overallProgressText = document.getElementById('overallProgressText');
        
        this.currentProgressSection = document.getElementById('currentProgressSection');
        this.currentImageInfo = document.getElementById('currentImageInfo');
        this.currentProgressFill = document.getElementById('currentProgressFill');
        this.currentProgressText = document.getElementById('currentProgressText');
        
        // Results elements
        this.resultsSection = document.getElementById('resultsSection');
        this.resultsSummary = document.getElementById('resultsSummary');
        this.downloadAllBtn = document.getElementById('downloadAllButton');
        this.copyAllBtn = document.getElementById('copyAllButton');
        this.resetAllBtn = document.getElementById('resetAllButton');
        this.resultsList = document.getElementById('resultsList');
        
        // Error elements
        this.errorSection = document.getElementById('errorSection');
        this.errorList = document.getElementById('errorList');
        this.retryFailedBtn = document.getElementById('retryFailedButton');
    }

    checkBrowserCompatibility() {
        const isCompatible = (
            window.File && 
            window.FileReader && 
            window.Blob && 
            window.Worker &&
            'Promise' in window &&
            window.JSZip
        );

        if (!isCompatible) {
            document.getElementById('compatibilityWarning').style.display = 'block';
        }
    }

    setupEventListeners() {
        // File input events
        this.fileInput.addEventListener('change', (e) => this.handleFileSelect(e));
        this.uploadArea.addEventListener('click', () => this.fileInput.click());

        // Drag and drop events
        this.uploadArea.addEventListener('dragover', (e) => this.handleDragOver(e));
        this.uploadArea.addEventListener('dragleave', (e) => this.handleDragLeave(e));
        this.uploadArea.addEventListener('drop', (e) => this.handleDrop(e));

        // Control buttons
        this.startProcessingBtn.addEventListener('click', () => this.startBatchProcessing());
        this.clearQueueBtn.addEventListener('click', () => this.clearQueue());

        // Action buttons
        this.downloadAllBtn.addEventListener('click', () => this.downloadAllResults());
        this.copyAllBtn.addEventListener('click', () => this.copyAllResults());
        this.resetAllBtn.addEventListener('click', () => this.resetAll());
        this.retryFailedBtn.addEventListener('click', () => this.retryFailedImages());
    }

    handleDragOver(e) {
        e.preventDefault();
        this.uploadArea.classList.add('dragover');
    }

    handleDragLeave(e) {
        e.preventDefault();
        this.uploadArea.classList.remove('dragover');
    }

    handleDrop(e) {
        e.preventDefault();
        this.uploadArea.classList.remove('dragover');
        
        const files = Array.from(e.dataTransfer.files);
        this.addFilesToQueue(files);
    }

    handleFileSelect(e) {
        const files = Array.from(e.target.files);
        this.addFilesToQueue(files);
    }

    addFilesToQueue(files) {
        const pngFiles = files.filter(file => file.type.includes('png'));
        
        if (pngFiles.length === 0) {
            this.showNotification('Please select PNG image files.', 'warning');
            return;
        }

        if (pngFiles.length !== files.length) {
            this.showNotification(`${files.length - pngFiles.length} non-PNG files were skipped.`, 'warning');
        }

        // Add files to queue
        pngFiles.forEach(file => {
            const imageItem = {
                id: Date.now() + Math.random(),
                file: file,
                status: 'pending',
                result: null,
                error: null
            };
            this.imageQueue.push(imageItem);
        });

        this.updateQueueDisplay();
        this.updateControls();
    }

    updateQueueDisplay() {
        if (this.imageQueue.length === 0) {
            this.queueSection.style.display = 'none';
            return;
        }

        this.queueSection.style.display = 'block';
        this.imageGrid.innerHTML = '';

        this.imageQueue.forEach((item, index) => {
            const imageElement = this.createImageQueueItem(item, index);
            this.imageGrid.appendChild(imageElement);
        });
    }

    createImageQueueItem(item, index) {
        const div = document.createElement('div');
        div.className = 'image-item';
        div.dataset.imageId = item.id;

        // Create image preview
        const img = document.createElement('img');
        const reader = new FileReader();
        reader.onload = (e) => {
            img.src = e.target.result;
        };
        reader.readAsDataURL(item.file);

        // Create info section
        const info = document.createElement('div');
        info.className = 'image-item-info';
        const sizeKB = (item.file.size / 1024).toFixed(1);
        const sizeMB = (item.file.size / (1024 * 1024)).toFixed(1);
        const displaySize = item.file.size > 1024 * 1024 ? `${sizeMB} MB` : `${sizeKB} KB`;
        info.textContent = `${item.file.name} (${displaySize})`;

        // Create status badge
        const status = document.createElement('div');
        status.className = `image-item-status status-${item.status}`;
        status.textContent = item.status.toUpperCase();

        // Create remove button
        const removeBtn = document.createElement('button');
        removeBtn.className = 'remove-image';
        removeBtn.textContent = '×';
        removeBtn.title = 'Remove image';
        removeBtn.addEventListener('click', () => this.removeFromQueue(item.id));

        div.appendChild(img);
        div.appendChild(info);
        div.appendChild(status);
        if (item.status === 'pending') {
            div.appendChild(removeBtn);
        }

        return div;
    }

    removeFromQueue(imageId) {
        this.imageQueue = this.imageQueue.filter(item => item.id !== imageId);
        this.updateQueueDisplay();
        this.updateControls();
    }

    updateControls() {
        const pendingCount = this.imageQueue.filter(item => item.status === 'pending').length;
        const totalCount = this.imageQueue.length;

        if (totalCount === 0) {
            this.controlsSection.style.display = 'none';
            return;
        }

        this.controlsSection.style.display = 'block';
        this.queueInfo.textContent = `${totalCount} images selected (${pendingCount} pending)`;
        
        this.startProcessingBtn.disabled = pendingCount === 0 || this.isProcessing;
        this.clearQueueBtn.disabled = this.isProcessing;
    }

    clearQueue() {
        this.imageQueue = [];
        this.processedResults = [];
        this.failedImages = [];
        this.updateQueueDisplay();
        this.updateControls();
        this.hideAllSections();
    }

    async startBatchProcessing() {
        if (this.isProcessing) return;

        this.isProcessing = true;
        this.processedResults = [];
        this.failedImages = [];
        this.currentImageIndex = 0;

        // Show progress sections
        this.overallProgressSection.style.display = 'block';
        this.currentProgressSection.style.display = 'block';
        this.resultsSection.style.display = 'none';
        this.errorSection.style.display = 'none';

        // Initialize OCR worker
        if (!this.worker) {
            this.updateCurrentProgress('Initializing OCR engine...', 0);
            try {
                this.worker = await Tesseract.createWorker(this.languageSelect.value, 1, {
                    logger: (m) => this.handleProgress(m)
                });
            } catch (error) {
                this.showError('Failed to initialize OCR engine. Please refresh and try again.');
                this.isProcessing = false;
                return;
            }
        }

        const pendingImages = this.imageQueue.filter(item => item.status === 'pending');
        
        // Process images sequentially to manage memory
        for (let i = 0; i < pendingImages.length; i++) {
            this.currentImageIndex = i;
            const item = pendingImages[i];
            
            this.updateOverallProgress(i, pendingImages.length);
            this.updateCurrentImageInfo(item);
            
            try {
                item.status = 'processing';
                this.updateImageStatus(item.id, 'processing');
                
                const result = await this.processImage(item.file);
                
                item.result = result;
                item.status = 'completed';
                this.processedResults.push({
                    filename: item.file.name,
                    text: result.data.text,
                    confidence: result.data.confidence
                });
                
                this.updateImageStatus(item.id, 'completed');
                
            } catch (error) {
                item.error = error.message;
                item.status = 'error';
                this.failedImages.push({
                    filename: item.file.name,
                    error: error.message,
                    item: item
                });
                
                this.updateImageStatus(item.id, 'error');
            }
        }

        this.updateOverallProgress(pendingImages.length, pendingImages.length);
        this.showResults();
        
        this.isProcessing = false;
        this.updateControls();
    }

    async processImage(file) {
        return new Promise((resolve, reject) => {
            this.worker.recognize(file)
                .then(result => resolve(result))
                .catch(error => reject(error));
        });
    }

    handleProgress(progress) {
        if (progress.status && progress.progress !== undefined) {
            let statusText = progress.status;
            
            switch (progress.status) {
                case 'loading tesseract core':
                    statusText = 'Loading OCR engine...';
                    break;
                case 'loading language traineddata':
                    statusText = 'Loading language data...';
                    break;
                case 'recognizing text':
                    statusText = 'Analyzing image and extracting text...';
                    break;
                case 'done':
                    statusText = 'Processing complete!';
                    break;
            }

            this.updateCurrentProgress(statusText, progress.progress);
        }
    }

    updateOverallProgress(current, total) {
        const percentage = total > 0 ? (current / total) * 100 : 0;
        this.overallProgressFill.style.width = `${percentage}%`;
        this.overallProgressText.textContent = `Processing ${current} of ${total} images (${percentage.toFixed(1)}%)`;
    }

    updateCurrentProgress(text, progress) {
        this.currentProgressText.textContent = text;
        this.currentProgressFill.style.width = `${(progress * 100)}%`;
    }

    updateCurrentImageInfo(item) {
        const sizeKB = (item.file.size / 1024).toFixed(1);
        const sizeMB = (item.file.size / (1024 * 1024)).toFixed(1);
        const displaySize = item.file.size > 1024 * 1024 ? `${sizeMB} MB` : `${sizeKB} KB`;
        
        this.currentImageInfo.textContent = `Processing: ${item.file.name} (${displaySize})`;
    }

    updateImageStatus(imageId, status) {
        const imageElement = document.querySelector(`[data-image-id="${imageId}"]`);
        if (imageElement) {
            const statusElement = imageElement.querySelector('.image-item-status');
            statusElement.className = `image-item-status status-${status}`;
            statusElement.textContent = status.toUpperCase();
            
            // Remove remove button if not pending
            if (status !== 'pending') {
                const removeBtn = imageElement.querySelector('.remove-image');
                if (removeBtn) {
                    removeBtn.remove();
                }
            }
        }
    }

    showResults() {
        this.currentProgressSection.style.display = 'none';
        
        if (this.processedResults.length > 0) {
            this.resultsSection.style.display = 'block';
            this.displayResults();
        }
        
        if (this.failedImages.length > 0) {
            this.errorSection.style.display = 'block';
            this.displayErrors();
        }
    }

    displayResults() {
        const successCount = this.processedResults.length;
        const totalCount = successCount + this.failedImages.length;
        const avgConfidence = this.processedResults.reduce((sum, r) => sum + r.confidence, 0) / successCount;
        
        this.resultsSummary.textContent = `${successCount}/${totalCount} images processed successfully | Avg confidence: ${avgConfidence.toFixed(1)}%`;
        
        this.resultsList.innerHTML = '';
        
        this.processedResults.forEach((result, index) => {
            const resultElement = this.createResultItem(result, index);
            this.resultsList.appendChild(resultElement);
        });
    }

    createResultItem(result, index) {
        const div = document.createElement('div');
        div.className = 'result-item';

        div.innerHTML = `
            <div class="result-header">
                <div class="result-filename">${result.filename}</div>
                <div class="result-confidence">Confidence: ${result.confidence.toFixed(1)}%</div>
            </div>
            <div class="result-text">${result.text || 'No text detected'}</div>
            <div class="result-actions">
                <button class="copy-individual" data-index="${index}">📋 Copy</button>
                <button class="download-individual" data-index="${index}">💾 Download</button>
            </div>
        `;

        // Add event listeners for individual actions
        const copyBtn = div.querySelector('.copy-individual');
        const downloadBtn = div.querySelector('.download-individual');
        
        copyBtn.addEventListener('click', () => this.copyIndividualResult(index));
        downloadBtn.addEventListener('click', () => this.downloadIndividualResult(index));

        return div;
    }

    displayErrors() {
        this.errorList.innerHTML = '';
        
        this.failedImages.forEach(error => {
            const errorElement = document.createElement('div');
            errorElement.className = 'error-item';
            errorElement.innerHTML = `
                <div class="error-filename">${error.filename}</div>
                <div class="error-message">${error.error}</div>
            `;
            this.errorList.appendChild(errorElement);
        });
    }

    async copyAllResults() {
        const allText = this.processedResults
            .map(r => `=== ${r.filename} ===\n${r.text}\n`)
            .join('\n');
        
        try {
            await navigator.clipboard.writeText(allText);
            this.showTemporaryMessage(this.copyAllBtn, '✓ All text copied!');
        } catch (err) {
            this.showNotification('Failed to copy text to clipboard', 'error');
        }
    }

    async copyIndividualResult(index) {
        const result = this.processedResults[index];
        
        try {
            await navigator.clipboard.writeText(result.text);
            const copyBtn = document.querySelector(`[data-index="${index}"].copy-individual`);
            this.showTemporaryMessage(copyBtn, '✓ Copied!');
        } catch (err) {
            this.showNotification('Failed to copy text to clipboard', 'error');
        }
    }

    async downloadAllResults() {
        try {
            const zip = new JSZip();
            
            this.processedResults.forEach(result => {
                const filename = result.filename.replace(/\.png$/i, '.txt');
                zip.file(filename, result.text);
            });
            
            const blob = await zip.generateAsync({type: 'blob'});
            this.downloadBlob(blob, `ocr-results-${new Date().getTime()}.zip`);
            
            this.showTemporaryMessage(this.downloadAllBtn, '✓ Downloaded!');
        } catch (error) {
            this.showNotification('Failed to create download', 'error');
        }
    }

    downloadIndividualResult(index) {
        const result = this.processedResults[index];
        const filename = result.filename.replace(/\.png$/i, '.txt');
        const blob = new Blob([result.text], { type: 'text/plain' });
        
        this.downloadBlob(blob, filename);
        
        const downloadBtn = document.querySelector(`[data-index="${index}"].download-individual`);
        this.showTemporaryMessage(downloadBtn, '✓ Downloaded!');
    }

    downloadBlob(blob, filename) {
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    }

    retryFailedImages() {
        // Reset failed images to pending status
        this.failedImages.forEach(failedItem => {
            const queueItem = this.imageQueue.find(item => item.id === failedItem.item.id);
            if (queueItem) {
                queueItem.status = 'pending';
                queueItem.error = null;
            }
        });
        
        this.failedImages = [];
        this.updateQueueDisplay();
        this.updateControls();
        this.errorSection.style.display = 'none';
    }

    resetAll() {
        this.clearQueue();
        this.fileInput.value = '';
        this.hideAllSections();
    }

    hideAllSections() {
        this.queueSection.style.display = 'none';
        this.overallProgressSection.style.display = 'none';
        this.currentProgressSection.style.display = 'none';
        this.resultsSection.style.display = 'none';
        this.errorSection.style.display = 'none';
    }

    showTemporaryMessage(button, message) {
        const originalText = button.textContent;
        button.textContent = message;
        button.disabled = true;
        
        setTimeout(() => {
            button.textContent = originalText;
            button.disabled = false;
        }, 2000);
    }

    showNotification(message, type = 'info') {
        // Simple notification system
        const notification = document.createElement('div');
        notification.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            padding: 1rem 1.5rem;
            border-radius: 6px;
            color: white;
            font-weight: 600;
            z-index: 10000;
            max-width: 300px;
        `;
        
        switch (type) {
            case 'error':
                notification.style.background = '#e74c3c';
                break;
            case 'warning':
                notification.style.background = '#f39c12';
                break;
            case 'success':
                notification.style.background = '#27ae60';
                break;
            default:
                notification.style.background = '#3498db';
        }
        
        notification.textContent = message;
        document.body.appendChild(notification);
        
        setTimeout(() => {
            if (notification.parentNode) {
                notification.parentNode.removeChild(notification);
            }
        }, 5000);
    }

    showError(message) {
        this.showNotification(message, 'error');
        this.isProcessing = false;
        this.currentProgressSection.style.display = 'none';
        this.updateControls();
    }

    async cleanup() {
        if (this.worker) {
            await this.worker.terminate();
            this.worker = null;
        }
    }
}

// Initialize the multi-image OCR tool when the page loads
document.addEventListener('DOMContentLoaded', () => {
    const ocrTool = new MultiImageOCRTool();
    
    // Cleanup on page unload
    window.addEventListener('beforeunload', () => {
        ocrTool.cleanup();
    });
});

// Service Worker for offline functionality
if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
        navigator.serviceWorker.register('sw.js').catch((error) => {
            console.log('SW registration failed');
        });
    });
}
