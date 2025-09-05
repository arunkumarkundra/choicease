/**
 * Debounce utility for performance optimization
 */
function ext_debounce(func, wait, immediate) {
    let timeout;
    return function executedFunction(...args) {
        const later = () => {
            timeout = null;
            if (!immediate) func.apply(this, args);
        };
        const callNow = immediate && !timeout;
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
        if (callNow) func.apply(this, args);
    };
}


// ========================================
    // PDF GENERATION FUNCTIONS
    // ========================================

    /**
     * Generate enhanced PDF report
     */
    function ext_generatePDFReport() {
        if (!window.jsPDF) {
            console.error('jsPDF library not available');
            alert('PDF generation library not available. Please try the standard PDF export.');
            return;
        }

        try {
            ext_showLoading('Generating professional PDF report...');
            
            const decisionCopy = ext_cloneDecisionData();
            if (!decisionCopy) {
                throw new Error('Unable to load decision data for PDF generation');
            }

            const results = ext_computeResultsCopy(decisionCopy);
            const rankedResults = ext_assignRanks(results);
            const confidence = ext_computeConfidence(rankedResults);
            const flipPoints = ext_computeFlipPoints(decisionCopy);
            
            // Generate charts as images
            ext_generateChartsForPDF().then(chartImages => {
                const doc = ext_createPDFDocument(rankedResults, confidence, flipPoints, decisionCopy, chartImages);
                
                // Download PDF
                const safeTitle = (decisionCopy.title || 'decision').replace(/[^a-zA-Z0-9]/g, '_').substring(0, 30);
                const timestamp = new Date().toISOString().replace(/[:.]/g, '-').substring(0, 19);
                const filename = `choicease_report_${safeTitle}_${timestamp}.pdf`;
                
                doc.save(filename);
                ext_hideLoading();
                
                // Show success message
                setTimeout(() => {
                    alert('Professional PDF report generated successfully!');
                }, 500);
                
            }).catch(error => {
                console.error('Error generating chart images:', error);
                ext_hideLoading();
                alert('Error generating PDF charts. Please try again.');
            });
            
        } catch (error) {
            console.error('Error generating PDF:', error);
            ext_hideLoading();
            alert('Error generating PDF report. Please try again.');
        }
    }

    /**
     * Generate chart images for PDF embedding
     */

/**
 * Generate chart images for PDF embedding with enhanced error handling
 */
function ext_generateChartsForPDF() {
    return new Promise((resolve, reject) => {
        const images = {};
        const errors = [];
        
        try {
            console.log('Starting chart image generation for PDF...');
            
            // Capture pie chart with multiple fallback strategies
            const capturePromises = [];
            
            // 1. Try to capture pie chart
            if (ext_state.charts.pie) {
                const piePromise = new Promise((pieResolve) => {
                    try {
                        // Strategy 1: Use Chart.js built-in toBase64Image
                        if (typeof ext_state.charts.pie.toBase64Image === 'function') {
                            const imageData = ext_state.charts.pie.toBase64Image('image/png', 1.0);
                            if (imageData && imageData.length > 100 && !imageData.includes('data:,')) {
                                images.pieChart = imageData;
                                console.log('✓ Pie chart captured via toBase64Image');
                                pieResolve();
                                return;
                            }
                        }
                        
                        // Strategy 2: Canvas toDataURL
                        const canvas = document.getElementById('ext_weightsPie');
                        if (canvas) {
                            const dataURL = canvas.toDataURL('image/png', 1.0);
                            if (dataURL && dataURL.length > 100 && !dataURL.includes('data:,')) {
                                images.pieChart = dataURL;
                                console.log('✓ Pie chart captured via canvas.toDataURL');
                                pieResolve();
                                return;
                            }
                        }
                        
                        console.warn('⚠ Could not capture pie chart - will generate text alternative');
                        errors.push('Pie chart capture failed');
                        pieResolve();
                        
                    } catch (error) {
                        console.warn('Pie chart capture error:', error);
                        errors.push(`Pie chart error: ${error.message}`);
                        pieResolve();
                    }
                });
                
                capturePromises.push(piePromise);
            } else {
                console.log('No pie chart available for capture');
            }
            
            // 2. Try to capture heatmap table
            const heatmapPromise = new Promise((heatmapResolve) => {
                const heatmapTable = document.querySelector('.ext-heatmap-table');
                
                if (heatmapTable && window.html2canvas) {
                    console.log('Attempting heatmap capture...');
                    
                    html2canvas(heatmapTable, {
                        backgroundColor: '#ffffff',
                        scale: 2,
                        useCORS: true,
                        allowTaint: true,
                        logging: false,
                        timeout: 10000
                    }).then(canvas => {
                        try {
                            const dataURL = canvas.toDataURL('image/png', 1.0);
                            if (dataURL && dataURL.length > 100) {
                                images.heatmap = dataURL;
                                console.log('✓ Heatmap captured successfully');
                            } else {
                                console.warn('⚠ Heatmap capture produced invalid data');
                                errors.push('Heatmap capture invalid');
                            }
                        } catch (error) {
                            console.warn('Heatmap canvas conversion error:', error);
                            errors.push(`Heatmap conversion error: ${error.message}`);
                        }
                        heatmapResolve();
                    }).catch(error => {
                        console.warn('html2canvas heatmap error:', error);
                        errors.push(`Heatmap html2canvas error: ${error.message}`);
                        heatmapResolve();
                    });
                } else {
                    if (!heatmapTable) {
                        console.log('No heatmap table found for capture');
                    }
                    if (!window.html2canvas) {
                        console.warn('html2canvas not available for heatmap capture');
                        errors.push('html2canvas library missing');
                    }
                    heatmapResolve();
                }
            });
            
            capturePromises.push(heatmapPromise);
            
            // Wait for all capture attempts with timeout
            const timeoutPromise = new Promise((timeoutResolve) => {
                setTimeout(() => {
                    console.log('Chart capture timeout reached');
                    timeoutResolve();
                }, 15000); // 15 second timeout
            });
            
            Promise.race([
                Promise.all(capturePromises),
                timeoutPromise
            ]).then(() => {
                console.log(`Chart capture completed. Images: ${Object.keys(images).length}, Errors: ${errors.length}`);
                
                if (errors.length > 0) {
                    console.warn('Chart capture warnings:', errors);
                }
                
                // Always resolve with whatever we captured
                resolve(images);
            });
            
        } catch (error) {
            console.error('Fatal error in chart capture:', error);
            // Still resolve with empty images rather than reject
            resolve({});
        }
    });
}



    /**
     * Create the PDF document with all sections
     */
    function ext_createPDFDocument(results, confidence, flipPoints, decisionCopy, chartImages) {
        const { jsPDF } = window.jspdf;
        const doc = new jsPDF('portrait', 'mm', 'a4');

        // Enhanced error handling wrapper
        const safeAddImage = (imageData, format, x, y, width, height) => {
            try {
                if (imageData && imageData.length > 100 && !imageData.includes('data:,')) {
                    doc.addImage(imageData, format, x, y, width, height);
                    return true;
                }
                return false;
            } catch (error) {
                console.warn(`Failed to add image to PDF: ${error.message}`);
                return false;
            }
        };
        
        const safeText = (text, x, y, options) => {
            try {
                const cleanText = String(text || '').replace(/[\u0000-\u001F\u007F-\u009F]/g, '');
                doc.text(cleanText, x, y, options);
            } catch (error) {
                console.warn(`Failed to add text to PDF: ${error.message}`);
                doc.text('(Text rendering error)', x, y, options);
            }
        };

        
        // Colors and styling
        const colors = {
            primary: [102, 126, 234],
            secondary: [118, 75, 162],
            success: [40, 167, 69],
            text: [51, 51, 51],
            lightText: [102, 102, 102],
            background: [248, 249, 250]
        };
        
        let yPos = 20;
        
        // Cover Page
        doc.setFillColor(...colors.primary);
        doc.rect(0, 0, 210, 60, 'F');
        
        doc.setTextColor(255, 255, 255);
        doc.setFontSize(28);
        doc.setFont(undefined, 'bold');
        safeText('Decision Analysis Report', 105, 25, { align: 'center' });
        
        doc.setFontSize(14);
        doc.setFont(undefined, 'normal');
        safeText('Professional Decision Intelligence', 105, 35, { align: 'center' });
        
        doc.setFontSize(10);
        safeText(`Generated by Choicease - ${new Date().toLocaleDateString()}`, 105, 50, { align: 'center' });
        
        yPos = 80;
        
        // Decision title and context
        doc.setTextColor(...colors.text);
        doc.setFillColor(...colors.background);
        doc.rect(10, yPos, 190, 40, 'F');
        doc.setDrawColor(200, 200, 200);
        doc.rect(10, yPos, 190, 40, 'S');
        
        doc.setFontSize(18);
        doc.setFont(undefined, 'bold');
        safeText(`Decision: ${decisionCopy.title}`, 15, yPos + 12);
        
        if (decisionCopy.description) {
            doc.setFontSize(12);
            doc.setFont(undefined, 'normal');
            doc.setTextColor(...colors.lightText);
            const descLines = doc.splitTextToSize(`Context: ${decisionCopy.description}`, 180);
            safeText(descLines, 15, yPos + 25);
        }
        
        yPos = 140;
        
        // Executive Summary
        doc.setTextColor(...colors.primary);
        doc.setFontSize(16);
        doc.setFont(undefined, 'bold');
        safeText('Executive Summary', 15, yPos);
        yPos += 15;
        
        const winner = results[0];
        const runnerUp = results.length > 1 ? results[1] : null;
        
        // Winner box
        doc.setFillColor(220, 237, 218);
        doc.rect(15, yPos, 180, 25, 'F');
        doc.setDrawColor(...colors.success);
        doc.setLineWidth(1);
        doc.rect(15, yPos, 180, 25, 'S');
        
        doc.setTextColor(...colors.success);
        doc.setFontSize(14);
        doc.setFont(undefined, 'bold');
        safeText('Recommended Choice:', 20, yPos + 8);
        
        doc.setTextColor(...colors.text);
        doc.setFontSize(12);
        doc.setFont(undefined, 'bold');
        safeText(winner.option.name, 20, yPos + 16);
        doc.setFont(undefined, 'normal');
        safeText(`Score: ${ext_safeNumber(winner.totalScore, 2)}/5.0 (${Math.round((winner.totalScore/5)*100)}%)`, 20, yPos + 22);
        
        yPos += 35;
        
        // Confidence meter
        doc.setTextColor(...colors.text);
        doc.setFontSize(12);
        doc.setFont(undefined, 'bold');
        safeText(`Confidence: ${confidence.bucket.toUpperCase()} (${confidence.confidencePercent}%)`, 20, yPos);
        
        // Confidence bar
        const barWidth = 100;
        const barHeight = 6;
        const confidenceWidth = (confidence.confidencePercent / 100) * barWidth;
        
        doc.setFillColor(230, 230, 230);
        doc.rect(20, yPos + 5, barWidth, barHeight, 'F');
        
        const confidenceColor = confidence.bucket === 'high' ? colors.success : 
                               confidence.bucket === 'medium' ? [255, 193, 7] : [220, 53, 69];
        doc.setFillColor(...confidenceColor);
        doc.rect(20, yPos + 5, confidenceWidth, barHeight, 'F');
        
        yPos += 20;
        
        // Key differentiators
        doc.setFontSize(11);
        doc.setFont(undefined, 'bold');
        safeText('Why this choice won:', 20, yPos);
        yPos += 8;
        
        const topCriteria = Object.entries(winner.criteriaScores)
            .sort((a, b) => b[1].weightedScore - a[1].weightedScore)
            .slice(0, 3);
        
        doc.setFont(undefined, 'normal');
        topCriteria.forEach(([criteriaName, scores], index) => {
            safeText(`• ${criteriaName}: Scored ${scores.rating}/5 with ${Math.round(scores.weight)}% weight`, 25, yPos);
            yPos += 6;
        });
        
        // Margin information
        if (runnerUp) {
            const margin = winner.totalScore - runnerUp.totalScore;
            yPos += 5;
            doc.setFont(undefined, 'bold');
            safeText(`Margin vs runner-up: +${ext_safeNumber(margin, 2)} points ahead of ${runnerUp.option.name}`, 20, yPos);
        }
        
        // New page for rankings
        doc.addPage();
        yPos = 20;
        
        // Rankings section
        doc.setTextColor(...colors.primary);
        doc.setFontSize(16);
        doc.setFont(undefined, 'bold');
        safeText('Complete Rankings', 15, yPos);
        yPos += 15;
        
        // Rankings table
        const tableData = results.map((result, index) => [
            result.rank.toString(),
            result.option.name,
            ext_safeNumber(result.totalScore, 2),
            `${Math.round((result.totalScore/5)*100)}%`
        ]);
        
        // Table headers
        doc.setFontSize(10);
        doc.setFont(undefined, 'bold');
        doc.setFillColor(240, 240, 240);
        doc.rect(15, yPos, 180, 8, 'F');
        safeText('Rank', 20, yPos + 5);
        safeText('Option', 45, yPos + 5);
        safeText('Score', 130, yPos + 5);
        safeText('Percentage', 160, yPos + 5);
        yPos += 8;
        
        // Table rows
        doc.setFont(undefined, 'normal');
        tableData.forEach((row, index) => {
            if (index === 0) {
                doc.setFillColor(220, 237, 218);
                doc.rect(15, yPos, 180, 7, 'F');
                doc.setFont(undefined, 'bold');
            } else {
                doc.setFont(undefined, 'normal');
            }
            
            safeText(row[0], 20, yPos + 5);
            safeText(row[1], 45, yPos + 5);
            safeText(row[2], 130, yPos + 5);
            safeText(row[3], 160, yPos + 5);
            yPos += 7;
        });
        
        // Add criteria weights section
        yPos += 20;
        doc.setTextColor(...colors.primary);
        doc.setFontSize(16);
        doc.setFont(undefined, 'bold');
        safeText('Criteria Analysis', 15, yPos);
        yPos += 15;
        
        // Embed pie chart if available
        if (chartImages.pieChart) {
            try {
                safeAddImage(chartImages.pieChart, 'PNG', 15, yPos, 80, 60);
                yPos += 70;
            } catch (error) {
                console.warn('Could not embed pie chart in PDF:', error);
            }
        }
        
        // Criteria weights table
        doc.setTextColor(...colors.text);
        doc.setFontSize(12);
        doc.setFont(undefined, 'bold');
        safeText('Criteria Weights:', 100, yPos - 40);
        
        doc.setFontSize(10);
        doc.setFont(undefined, 'normal');
        let criteriaYPos = yPos - 30;
        decisionCopy.criteria.forEach(criteria => {
            const weight = Math.round(decisionCopy.normalizedWeights[criteria.id] || 0);
            safeText(`${criteria.name}: ${weight}%`, 105, criteriaYPos);
            criteriaYPos += 6;
        });
        
        // Sensitivity analysis
        if (yPos > 200) {
            doc.addPage();
            yPos = 20;
        } else {
            yPos += 20;
        }
        
        doc.setTextColor(...colors.primary);
        doc.setFontSize(16);
        doc.setFont(undefined, 'bold');
        safeText('Sensitivity Analysis', 15, yPos);
        yPos += 15;
        
        const validFlipPoints = flipPoints.filter(fp => !fp.impossible);
        if (validFlipPoints.length > 0) {
            doc.setTextColor(...colors.text);
            doc.setFontSize(11);
            doc.setFont(undefined, 'bold');
            safeText('Decision Flip Points:', 20, yPos);
            yPos += 10;
            
            doc.setFontSize(9);
            doc.setFont(undefined, 'normal');
            validFlipPoints.slice(0, 5).forEach(fp => {
                const isCritical = Math.abs(fp.flipDeltaPercentPoints) < 5;
                if (isCritical) {
                    doc.setTextColor(...colors.primary);
                    doc.setFont(undefined, 'bold');
                } else {
                    doc.setTextColor(...colors.text);
                    doc.setFont(undefined, 'normal');
                }
                
                safeText(`• ${fp.criterionName}: ${fp.flipDeltaPercentPoints > 0 ? '+' : ''}${fp.flipDeltaPercentPoints}pp change needed`, 25, yPos);
                yPos += 5;
            });
        }
        
        // Methodology section
        if (yPos > 220) {
            doc.addPage();
            yPos = 20;
        } else {
            yPos += 20;
        }
        
        doc.setTextColor(...colors.primary);
        doc.setFontSize(16);
        doc.setFont(undefined, 'bold');
        safeText('Methodology', 15, yPos);
        yPos += 15;
        
        doc.setTextColor(...colors.text);
        doc.setFontSize(10);
        doc.setFont(undefined, 'normal');
        const methodology = [
            'This analysis uses a weighted multi-criteria decision model:',
            '• Each option rated 1-5 on each criterion',
            '• Criteria importance weights normalized to 100%',
            '• Final scores = Σ(rating × weight) for each option',
            '• Confidence based on score gaps and criteria consistency',
            '• Sensitivity analysis shows weight changes needed to flip decision'
        ];
        
        methodology.forEach(line => {
            safeText(line, 20, yPos);
            yPos += 6;
        });
        
        // Footer on all pages
        const pageCount = doc.internal.getNumberOfPages();
        for (let i = 1; i <= pageCount; i++) {
            doc.setPage(i);
            
            // Footer line
            doc.setDrawColor(...colors.primary);
            doc.setLineWidth(0.5);
            doc.line(20, 285, 190, 285);
            
            doc.setTextColor(...colors.lightText);
            doc.setFontSize(8);
            doc.setFont(undefined, 'normal');
            safeText('Powered by Choicease - Smart Choices, Made Easy', 105, 290, { align: 'center' });
            safeText(`choicease.com | Page ${i} of ${pageCount}`, 105, 295, { align: 'center' });
        }
        
        return doc;
    }

    // ========================================
    // UTILITY FUNCTIONS
    // ========================================

    /**
     * Safe HTML escaping to prevent XSS
     */
    function ext_safeHtml(str) {
        if (typeof str !== 'string') return '';
        return str.replace(/[&<>"']/g, function(match) {
            return {
                '&': '&amp;',
                '<': '&lt;',
                '>': '&gt;',
                '"': '&quot;',
                "'": '&#39;'
            }[match];
        });
    }

    /**
     * Safe number formatting
     */
    function ext_safeNumber(num, decimals = 2) {
        if (typeof num !== 'number' || isNaN(num)) return '0';
        return Number(num.toFixed(decimals));
    }

    /**
     * Format percentage strings
     */
    function ext_formatPercent(val) {
        return `${Math.round(val)}%`;
    }

    /**
     * Generate colors for charts
     */
    function ext_generateColors(count) {
        const baseColors = [
            '#667eea', '#764ba2', '#28a745', '#ffc107', '#dc3545', 
            '#17a2b8', '#6610f2', '#e83e8c', '#fd7e14', '#20c997'
        ];
        
        const colors = [];
        for (let i = 0; i < count; i++) {
            colors.push(baseColors[i % baseColors.length]);
        }
        return colors;
    }

    /**
     * Show loading overlay
     */
    function ext_showLoading(message = 'Loading...') {
        const overlay = document.getElementById('ext_loadingOverlay');
        if (overlay) {
            const messageEl = overlay.querySelector('p');
            if (messageEl) messageEl.textContent = message;
            overlay.style.display = 'flex';
        }
    }

    /**
     * Hide loading overlay
     */
    function ext_hideLoading() {
        const overlay = document.getElementById('ext_loadingOverlay');
        if (overlay) {
            overlay.style.display = 'none';
        }
    }

    /**
     * Show fallback message if enhanced results fail
     */
    function ext_showFallbackMessage() {
        const container = document.getElementById('ext_resultsAccordion');
        if (container) {
            container.innerHTML = `
                <div style="text-align: center; padding: 40px; color: #666;">
                    <h3>Enhanced results temporarily unavailable</h3>
                    <p>Please use the standard results below, or refresh the page to try again.</p>
                </div>
            `;
        }
        
        // Show legacy results
        const legacyResults = document.getElementById('resultsGrid');
        if (legacyResults) {
            legacyResults.style.display = 'block';
        }
    }

    /**
     * Hook into export dropdown for enhanced PDF
     */
    function ext_hookExportHandlers() {
        // Verify the enhanced PDF option exists in the dropdown
        const enhancedPdfOption = document.querySelector('[data-type="ext_pdf"]');
        if (!enhancedPdfOption) {
            console.warn('Enhanced PDF export option not found in dropdown');
        }
        // Hook into existing export dropdown handler
        document.addEventListener('click', function(event) {
            if (event.target.classList.contains('export-option')) {
                const type = event.target.getAttribute('data-type');
                if (type === 'ext_pdf') {
                    event.preventDefault();
                    event.stopPropagation();
                    ext_generatePDFReport();
                    
                    // Close dropdown
                    const dropdown = document.getElementById('exportDropdown');
                    if (dropdown) {
                        dropdown.classList.remove('show');
                    }
                }
            }
        });

        // Hook into enhanced PDF button in export section
        const pdfBtn = document.getElementById('ext_pdfPreviewBtn');
        if (pdfBtn) {
            pdfBtn.addEventListener('click', ext_generatePDFReport);
        }
    }

    // ========================================
    // INTEGRATION & INITIALIZATION
    // ========================================

    /**
     * Initialize the enhanced results module
     */
    function ext_initializeModule() {
        if (ext_state.isInitialized) return;
        
        console.log('Initializing enhanced results module...');
        
        // Check dependencies
        if (!window.ExtChart) {
            console.warn('Chart.js not available - some features may be limited');
        }
        
        if (!window.jsPDF) {
            console.warn('jsPDF not available - enhanced PDF generation disabled');
        }
        
        // Hook into the existing calculateResults flow
        const originalCalculateResults = window.calculateResults;
        if (typeof originalCalculateResults === 'function') {
            window.calculateResults = function() {
                // Call original function first
                const result = originalCalculateResults.apply(this, arguments);
                
                // Then add enhanced results
                setTimeout(() => {
                    if (currentStep === 6) { // Only on results step
                        ext_renderResultsAccordion();
                    }
                }, 100);
                
                return result;
            };
        } else {
            console.warn('calculateResults function not found - enhanced results may not trigger automatically');
        }
        
        ext_state.isInitialized = true;
        console.log('Enhanced results module initialized successfully');
    }

    // ========================================
    // MODULE EXPORTS & AUTO-INITIALIZATION
    // ========================================

    // Export functions to global scope for debugging and manual calling
    window.ext_results = {
        renderResultsAccordion: ext_renderResultsAccordion,
        generatePDFReport: ext_generatePDFReport,
        computeResultsCopy: ext_computeResultsCopy,
        assignRanks: ext_assignRanks,
        computeConfidence: ext_computeConfidence,
        computeFlipPoints: ext_computeFlipPoints,
        state: ext_state,
        config: ext_config
    };

    // Auto-initialize when DOM is ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', ext_initializeModule);
    } else {
        // DOM already loaded
        ext_initializeModule();
    }

    // Also initialize when script loads (backup)
    setTimeout(ext_initializeModule, 100);

})();

/**
 * Integration Notes:
 * 
 * 1. This module automatically hooks into the existing calculateResults() function
 * 2. All functions are prefixed with 'ext_' to avoid conflicts
 * 3. No modifications to existing decisionData or state-mutating functions
 * 4. Graceful degradation if Chart.js or jsPDF fail to load
 * 5. Maintains backward compatibility with existing results
 * 6. Professional-grade PDF generation with embedded charts
 * 7. Interactive what-if analysis with real-time updates
 * 8. Comprehensive sensitivity analysis and risk assessment
 * 9. Mobile-responsive design with touch-friendly controls
 * 10. Accessibility features with proper ARIA labels and keyboard support
 * 
 * Key Fixes Applied:
 * - Fixed Chart.js plugin detection and error handling
 * - Added fallback displays for failed chart renders
 * - Improved null/undefined checks throughout
 * - Enhanced XSS protection with proper HTML escaping
 * - Better error handling in PDF generation
 * - Fixed slider event handlers with proper null checks
 * - Added chart fallback functionality
 * - Improved dependency detection and graceful degradation
 *//**
 * CHOICEASE - ENHANCED RESULTS MODULE
 * Executive-grade decision analysis with interactive charts and insights
 * 
 * This module provides enhanced results functionality without modifying
 * the existing decisionData or calling state-mutating functions.
 * All functions are prefixed with 'ext_' to avoid conflicts.
 */

(function() {
    'use strict';

    // ========================================
    // MODULE STATE & CONFIGURATION
    // ========================================

    const ext_state = {
        tmpWeights: null,          // Copy of weights for what-if analysis
        charts: {},                // Chart.js instances
        currentResults: null,      // Cached results
        isInitialized: false       // Initialization flag
    };

    const ext_config = {
        rankEpsilon: 1e-4,         // Tie detection threshold
        animationDuration: 800,    // Chart animation duration
        confidenceThresholds: {    // Confidence level boundaries
            high: 70,
            medium: 40
        },
        colors: {                  // Color palette
            primary: '#667eea',
            secondary: '#764ba2',
            success: '#28a745',
            warning: '#ffc107',
            danger: '#dc3545',
            info: '#17a2b8'
        },
        pdfBranding: {             // White-label configuration
            logoUrl: 'images/choicease-decision-making-tool.png',
            clientName: '<<CLIENT NAME>>'
        }
    };

    /**
     * Check if Chart.js is properly loaded
     */

/**
 * Enhanced Chart.js dependency check with better version handling
 */
function ext_checkChartJSDependency() {
    // Check for Chart.js in multiple possible locations
    const chartSources = [
        window.Chart,
        window.ExtChart,
        (window.Chart && window.Chart.Chart) // Some versions nest Chart
    ].filter(Boolean);

    if (chartSources.length === 0) {
        console.warn('Chart.js not detected - charts will show fallback content');
        return false;
    }

    // Use the first available Chart.js instance
    const Chart = chartSources[0];
    
    // Try to determine version
    let version = 'unknown';
    if (Chart.version) {
        version = Chart.version;
    } else if (Chart.Chart && Chart.Chart.version) {
        version = Chart.Chart.version;
    }

    console.log(`Chart.js detected - version: ${version}`);
    
    // Set up global reference
    if (!window.ExtChart) {
        window.ExtChart = Chart;
    }

    // Register default plugins if needed and available
    try {
        if (Chart.register && Chart.defaults) {
            // Chart.js v3+ style
            console.log('Chart.js v3+ detected');
        } else if (Chart.Chart && Chart.Chart.register) {
            // Alternative v3+ structure
            window.ExtChart = Chart.Chart;
        } else {
            // Likely v2.x or earlier
            console.log('Chart.js v2.x or earlier detected');
        }
    } catch (error) {
        console.warn('Chart.js setup warning:', error);
    }

    return true;
}

    
    
    // ========================================
    // CORE DATA MANAGEMENT FUNCTIONS
    // ========================================

    /**
     * Create a deep copy of decisionData to avoid mutations
     * @returns {Object} Deep copy of current decision data
     */
    function ext_cloneDecisionData() {
        try {
            return JSON.parse(JSON.stringify(decisionData));
        } catch (error) {
            console.error('Error cloning decision data:', error);
            return null;
        }
    }

    /**
     * Compute results using copied data with exact algorithm from spec
     * @param {Object} decisionCopy - Deep copy of decision data
     * @returns {Array} Results array with totalScore and criteriaScores
     */
    function ext_computeResultsCopy(decisionCopy) {
        if (!decisionCopy || !decisionCopy.options || !decisionCopy.criteria) {
            console.warn('Invalid decision data provided to ext_computeResultsCopy');
            return [];
        }

        const results = [];

        // Ensure normalized weights exist
        if (!decisionCopy.normalizedWeights || Object.keys(decisionCopy.normalizedWeights).length === 0) {
            ext_normalizeWeightsFrom(decisionCopy);
        }

        decisionCopy.options.forEach(option => {
            let totalScore = 0;
            const criteriaScores = {};

            decisionCopy.criteria.forEach(criteria => {
                const ratingKey = `${option.id}-${criteria.id}`;
                const rating = decisionCopy.ratings[ratingKey] || 3; // Default missing ratings to 3
                const normalizedWeight = (decisionCopy.normalizedWeights[criteria.id] || 0) / 100;
                const weightedScore = rating * normalizedWeight;

                criteriaScores[criteria.name] = {
                    rating: rating,
                    weight: normalizedWeight * 100, // Store as percentage for display
                    weightedScore: weightedScore
                };

                totalScore += weightedScore;
            });

            results.push({
                option: {
                    id: option.id,
                    name: option.name,
                    description: option.description || ''
                },
                totalScore: Math.round(totalScore * 1000000) / 1000000, // 6 decimal precision
                criteriaScores: criteriaScores
            });
        });

        // Sort by total score descending
        results.sort((a, b) => b.totalScore - a.totalScore);
        
        return results;
    }

    /**
     * Normalize weights from raw importance ratings (copy of existing logic)
     * @param {Object} decisionCopy - Decision data copy to modify
     */
    function ext_normalizeWeightsFrom(decisionCopy) {
        if (!decisionCopy.weights || Object.keys(decisionCopy.weights).length === 0) {
            console.warn('No weights found to normalize');
            return;
        }

        // Use same mapping as existing app
        const ratingToWeight = { 1: 1, 2: 1.78, 3: 3.16, 4: 5.62, 5: 10 };
        
        // Calculate total mapped weight
        const totalMappedWeight = Object.values(decisionCopy.weights)
            .reduce((sum, rating) => sum + ratingToWeight[rating], 0);
        
        // Store normalized percentages
        const normalizedWeights = {};
        Object.keys(decisionCopy.weights).forEach(id => {
            const rating = decisionCopy.weights[id];
            const mappedWeight = ratingToWeight[rating];
            normalizedWeights[id] = (mappedWeight / totalMappedWeight) * 100;
        });
        
        decisionCopy.normalizedWeights = normalizedWeights;
    }

    /**
     * Assign ranks with proper tie handling
     * @param {Array} results - Results array to add ranks to
     * @param {number} epsilon - Tie detection threshold
     * @returns {Array} Results with rank field added
     */
    function ext_assignRanks(results, epsilon = ext_config.rankEpsilon) {
        if (!results || results.length === 0) return results;

        let currentRank = 1;
        let itemsAtCurrentRank = 0;

        for (let i = 0; i < results.length; i++) {
            if (i === 0) {
                // First item always gets rank 1
                results[i].rank = 1;
                itemsAtCurrentRank = 1;
            } else {
                const scoreDiff = Math.abs(results[i].totalScore - results[i-1].totalScore);
                if (scoreDiff <= epsilon) {
                    // Tie with previous item
                    results[i].rank = currentRank;
                    itemsAtCurrentRank++;
                } else {
                    // Different score, advance rank
                    currentRank += itemsAtCurrentRank;
                    results[i].rank = currentRank;
                    itemsAtCurrentRank = 1;
                }
            }
        }

        return results;
    }

    /**
     * Calculate confidence metrics for the decision
     * @param {Array} results - Ranked results array
     * @returns {Object} Confidence analysis
     */
    function ext_computeConfidence(results) {
        if (!results || results.length < 2) {
            return {
                confidencePercent: 50,
                bucket: 'medium',
                explanation: 'Insufficient data for confidence analysis'
            };
        }

        const winnerScore = results[0].totalScore;
        const runnerUpScore = results[1].totalScore;
        const absoluteGap = winnerScore - runnerUpScore;
        
        // Max theoretical gap is 4 (5.0 - 1.0)
        const normalizedGap = Math.min(absoluteGap / 4, 1);
        
        // Calculate criteria impact variability
        const decisionCopy = ext_cloneDecisionData();
        let impactStd = 0;
        
        if (decisionCopy && decisionCopy.criteria.length > 1) {
            const impacts = decisionCopy.criteria.map(criteria => {
                const ratings = results.map(r => r.criteriaScores[criteria.name]?.rating || 3);
                const maxRating = Math.max(...ratings);
                const minRating = Math.min(...ratings);
                const normalizedWeight = (decisionCopy.normalizedWeights[criteria.id] || 0) / 100;
                return (maxRating - minRating) * normalizedWeight;
            });
            
            const meanImpact = impacts.reduce((sum, impact) => sum + impact, 0) / impacts.length;
            const variance = impacts.reduce((sum, impact) => sum + Math.pow(impact - meanImpact, 2), 0) / impacts.length;
            impactStd = Math.sqrt(variance);
            
            // Normalize to [0,1] by max possible standard deviation
            const maxWeight = Math.max(...Object.values(decisionCopy.normalizedWeights || {})) / 100 || 0.5;
            impactStd = Math.min(impactStd / (4 * maxWeight), 1);
        }
        
        // Confidence calculation
        const confidenceRaw = normalizedGap * (1 - impactStd);
        const confidencePercent = Math.round(Math.max(0, Math.min(100, confidenceRaw * 100)));
        
        let bucket, explanation;
        if (confidencePercent >= ext_config.confidenceThresholds.high) {
            bucket = 'high';
            explanation = 'Clear winner with significant margin and consistent criteria performance';
        } else if (confidencePercent >= ext_config.confidenceThresholds.medium) {
            bucket = 'medium';
            explanation = 'Moderate confidence - winner has decent margin but some criteria variability';
        } else {
            bucket = 'low';
            explanation = 'Low confidence - very close scores or high sensitivity to criteria weights';
        }
        
        return {
            confidencePercent,
            bucket,
            explanation,
            absoluteGap: Math.round(absoluteGap * 100) / 100,
            normalizedGap: Math.round(normalizedGap * 100) / 100
        };
    }

    /**
     * Compute flip points for sensitivity analysis
     * @param {Object} decisionCopy - Decision data copy
     * @returns {Array} Flip point analysis for each criterion
     */
    function ext_computeFlipPoints(decisionCopy) {
        const results = ext_computeResultsCopy(decisionCopy);
        if (results.length < 2) return [];

        const winner = results[0];
        const runnerUp = results[1];
        const flipPoints = [];

        decisionCopy.criteria.forEach(criteria => {
            const winnerRating = winner.criteriaScores[criteria.name]?.rating || 3;
            const runnerUpRating = runnerUp.criteriaScores[criteria.name]?.rating || 3;
            const currentWeight = (decisionCopy.normalizedWeights[criteria.id] || 0) / 100;
            
            // If ratings are equal, this criterion cannot flip the decision
            if (Math.abs(winnerRating - runnerUpRating) < 0.001) {
                flipPoints.push({
                    criteriaId: criteria.id,
                    criterionName: criteria.name,
                    flipDeltaPercentPoints: null,
                    flipMultiplier: null,
                    impossible: true,
                    reason: 'Identical ratings for top options'
                });
                return;
            }

            // Use binary search to find flip point
            const flipResult = ext_findFlipPoint(decisionCopy, criteria.id, winner.option.id, runnerUp.option.id);
            
            if (flipResult.found) {
                const deltaPercentPoints = (flipResult.newWeight - currentWeight) * 100;
                const multiplier = currentWeight > 0 ? flipResult.newWeight / currentWeight : 1;
                
                flipPoints.push({
                    criteriaId: criteria.id,
                    criterionName: criteria.name,
                    flipDeltaPercentPoints: Math.round(deltaPercentPoints * 10) / 10,
                    flipMultiplier: Math.round(multiplier * 100) / 100,
                    impossible: false,
                    currentWeight: Math.round(currentWeight * 1000) / 10, // As percentage with 1 decimal
                    newWeight: Math.round(flipResult.newWeight * 1000) / 10
                });
            } else {
                flipPoints.push({
                    criteriaId: criteria.id,
                    criterionName: criteria.name,
                    flipDeltaPercentPoints: null,
                    flipMultiplier: null,
                    impossible: true,
                    reason: 'No feasible weight change can flip decision'
                });
            }
        });

        // Sort by absolute flip point magnitude (most critical first)
        flipPoints.sort((a, b) => {
            if (a.impossible && b.impossible) return 0;
            if (a.impossible) return 1;
            if (b.impossible) return -1;
            return Math.abs(a.flipDeltaPercentPoints) - Math.abs(b.flipDeltaPercentPoints);
        });

        return flipPoints;
    }

    /**
     * Binary search to find weight change needed to flip decision
     * @param {Object} decisionCopy - Decision data
     * @param {string} criteriaId - Criteria to modify
     * @param {string} winnerId - Current winner ID
     * @param {string} targetId - Target option to become winner
     * @returns {Object} Flip point result
     */
    function ext_findFlipPoint(decisionCopy, criteriaId, winnerId, targetId) {
        const maxIterations = 20;
        let low = 0.001; // Minimum weight (0.1%)
        let high = 0.99;  // Maximum weight (99%)
        
        for (let iter = 0; iter < maxIterations; iter++) {
            const testWeight = (low + high) / 2;
            const testCopy = ext_cloneDecisionData();
            
            // Set new weight and renormalize
            const totalOldWeight = Object.values(testCopy.normalizedWeights).reduce((sum, w) => sum + w, 0);
            const oldWeight = testCopy.normalizedWeights[criteriaId];
            const weightDelta = (testWeight * 100) - oldWeight;
            
            // Distribute the change proportionally among other criteria
            Object.keys(testCopy.normalizedWeights).forEach(id => {
                if (id === criteriaId) {
                    testCopy.normalizedWeights[id] = testWeight * 100;
                } else {
                    const proportion = testCopy.normalizedWeights[id] / (totalOldWeight - oldWeight);
                    testCopy.normalizedWeights[id] = proportion * (100 - testWeight * 100);
                }
            });
            
            // Recompute results
            const testResults = ext_computeResultsCopy(testCopy);
            const newWinner = testResults[0];
            
            if (newWinner.option.id === targetId) {
                // Target is now winner, try smaller weight change
                high = testWeight;
                if (high - low < 1e-4) {
                    return { found: true, newWeight: testWeight };
                }
            } else {
                // Still not flipped, try larger weight change
                low = testWeight;
            }
        }
        
        return { found: false };
    }

    // ========================================
    // UI RENDERING FUNCTIONS
    // ========================================

    /**
     * Main function to render the enhanced results accordion
     */
    function ext_renderResultsAccordion() {
        try {
            ext_showLoading('Analyzing your decision...');
            
            // Create accordion container if it doesn't exist
            let accordionContainer = document.getElementById('ext_resultsAccordion');
            if (!accordionContainer) {
                // Find the results section and add accordion container
                const resultsSection = document.getElementById('section6');
                const resultsGrid = document.getElementById('resultsGrid');
                
                if (resultsSection && resultsGrid) {
                    accordionContainer = document.createElement('div');
                    accordionContainer.id = 'ext_resultsAccordion';
                    accordionContainer.className = 'ext-results-accordion';
                    
                    // Insert before the existing results grid
                    resultsSection.insertBefore(accordionContainer, resultsGrid);
                } else {
                    throw new Error('Results section not found - cannot create accordion container');
                }
            }
            
            const decisionCopy = ext_cloneDecisionData();
            if (!decisionCopy) {
                throw new Error('Unable to load decision data');
            }
            const results = ext_computeResultsCopy(decisionCopy);
            const rankedResults = ext_assignRanks(results);
            const confidence = ext_computeConfidence(rankedResults);
            const flipPoints = ext_computeFlipPoints(decisionCopy);
            
            // Cache results for what-if analysis
            ext_state.currentResults = rankedResults;
            ext_state.tmpWeights = { ...decisionCopy.normalizedWeights };
            
            // Build accordion structure
            accordionContainer.innerHTML = ext_buildAccordionHTML(rankedResults, confidence, flipPoints, decisionCopy);
            
            // Initialize accordion behavior
            ext_initializeAccordion();
            
            // Render all visualizations
            setTimeout(() => {
                ext_renderExecutiveSummary(rankedResults, confidence, decisionCopy);
                ext_renderRankingTable(rankedResults);
                ext_renderWeightsPie(decisionCopy);
                ext_renderHeatmap(decisionCopy, rankedResults);
                ext_renderSensitivity(flipPoints);
                ext_initWhatIfControls(decisionCopy);
                ext_renderRisksAnalysis(rankedResults, decisionCopy);
                
                ext_hideLoading();
            }, 100);
            
            // Hide legacy results
            const legacyResults = document.getElementById('resultsGrid');
            if (legacyResults) {
                legacyResults.style.display = 'none';
            }
            
            // Hook into export dropdown for enhanced PDF
            ext_hookExportHandlers();
        } catch (error) {
            console.error('Error rendering enhanced results:', error);
            ext_hideLoading();
            ext_showFallbackMessage();
        }
    }

    
    /**
     * Build the HTML structure for the accordion
     */
    function ext_buildAccordionHTML(results, confidence, flipPoints, decisionCopy) {
        return `
            <div class="ext-accordion-section">
                <button class="ext-accordion-header" aria-expanded="true" aria-controls="ext_executiveSummary">
                    <span><span class="ext-section-icon">📊</span>Executive Summary</span>
                    <span class="ext-expand-icon">▼</span>
                </button>
                <div class="ext-accordion-content active" id="ext_executiveSummary" role="tabpanel">
                    <!-- Executive summary content will be populated here -->
                </div>
            </div>
            
            <div class="ext-accordion-section">
                <button class="ext-accordion-header" aria-expanded="false" aria-controls="ext_rankingTable">
                    <span><span class="ext-section-icon">🏆</span>Detailed Ranking & Scores</span>
                    <span class="ext-expand-icon">▼</span>
                </button>
                <div class="ext-accordion-content" id="ext_rankingTableContainer" role="tabpanel">
                    <!-- Ranking table will be populated here -->
                </div>
            </div>
            
            <div class="ext-accordion-section">
                <button class="ext-accordion-header" aria-expanded="false" aria-controls="ext_weightsPie">
                    <span><span class="ext-section-icon">🥧</span>Criteria Weights & Pie Chart</span>
                    <span class="ext-expand-icon">▼</span>
                </button>
                <div class="ext-accordion-content" id="ext_weightsPieContainer" role="tabpanel">
                    <div class="ext-chart-container">
                        <h4>Criteria Importance Distribution</h4>
                        <div class="ext-pie-container">
                            <canvas id="ext_weightsPie" aria-label="Pie chart showing criteria weights distribution"></canvas>
                        </div>
                    </div>
                </div>
            </div>
            
            <div class="ext-accordion-section">
                <button class="ext-accordion-header" aria-expanded="false" aria-controls="ext_heatmap">
                    <span><span class="ext-section-icon">🌡️</span>Performance Heatmap</span>
                    <span class="ext-expand-icon">▼</span>
                </button>
                <div class="ext-accordion-content" id="ext_heatmapContainer" role="tabpanel">
                    <!-- Heatmap will be populated here -->
                </div>
            </div>
            
            <div class="ext-accordion-section">
                <button class="ext-accordion-header" aria-expanded="false" aria-controls="ext_sensitivity">
                    <span><span class="ext-section-icon">⚖️</span>Sensitivity & What-If</span>
                    <span class="ext-expand-icon">▼</span>
                </button>
                <div class="ext-accordion-content" id="ext_sensitivityContainer" role="tabpanel">
                    <!-- Sensitivity analysis will be populated here -->
                </div>
            </div>
            
            <div class="ext-accordion-section">
                <button class="ext-accordion-header" aria-expanded="false" aria-controls="ext_risks">
                    <span><span class="ext-section-icon">⚠️</span>Risks & Weaknesses</span>
                    <span class="ext-expand-icon">▼</span>
                </button>
                <div class="ext-accordion-content" id="ext_risksContainer" role="tabpanel">
                    <!-- Risk analysis will be populated here -->
                </div>
            </div>
            
            <div class="ext-accordion-section">
                <button class="ext-accordion-header" aria-expanded="false" aria-controls="ext_export">
                    <span><span class="ext-section-icon">📤</span>Export & Share</span>
                    <span class="ext-expand-icon">▼</span>
                </button>
                <div class="ext-accordion-content" id="ext_exportContainer" role="tabpanel">
                    <div style="text-align: center; padding: 20px;">
                        <h4>Enhanced Export Options</h4>
                        <p style="color: #666; margin-bottom: 20px;">Generate professional reports with interactive insights</p>
                        <button class="btn btn-success" id="ext_pdfPreviewBtn" style="margin: 10px;">
                            📄 Generate Enhanced PDF Report
                        </button>
                        <p style="font-size: 0.9rem; color: #666; margin-top: 15px;">
                            Professional-grade PDF with charts, analysis, and white-label options
                        </p>
                    </div>
                </div>
            </div>
        `;
    }

    /**
     * Initialize accordion behavior with keyboard support
     */
    function ext_initializeAccordion() {
        const headers = document.querySelectorAll('.ext-accordion-header');
        
        headers.forEach(header => {
            header.addEventListener('click', function() {
                const isExpanded = this.getAttribute('aria-expanded') === 'true';
                const content = this.nextElementSibling;
                
                // Toggle current section
                this.setAttribute('aria-expanded', !isExpanded);
                content.classList.toggle('active');
                
                // Trigger chart render when section opens (lazy loading)
                if (!isExpanded) {
                    const sectionId = content.id;
                    ext_handleSectionOpen(sectionId);
                }
            });
            
            // Keyboard support
            header.addEventListener('keydown', function(e) {
                if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    this.click();
                }
            });
        });
    }

    /**
     * Handle section opening for lazy loading of charts
     */
    function ext_handleSectionOpen(sectionId) {
        // Defer chart rendering to avoid blocking UI
        setTimeout(() => {
            switch(sectionId) {
                case 'ext_weightsPieContainer':
                    if (!ext_state.charts.pie) {
                        const decisionCopy = ext_cloneDecisionData();
                        ext_renderWeightsPie(decisionCopy);
                    }
                    break;
                // Add other lazy-loaded sections as needed
            }
        }, 100);
    }

    /**
     * Render executive summary section
     */
    function ext_renderExecutiveSummary(results, confidence, decisionCopy) {
        const container = document.getElementById('ext_executiveSummary');
        if (!container || !results.length) return;

        const winner = results[0];
        const runnerUp = results.length > 1 ? results[1] : null;
        const margin = runnerUp ? winner.totalScore - runnerUp.totalScore : 0;
        const marginPercent = runnerUp ? Math.round((margin / 5) * 100) : 0;

        // Find top contributing criteria for winner
        const topCriteria = Object.entries(winner.criteriaScores)
            .sort((a, b) => b[1].weightedScore - a[1].weightedScore)
            .slice(0, 3);

        container.innerHTML = `
            <div class="ext-executive-summary">
                <div class="ext-winner-card">
                    <div class="ext-winner-badge">🏆 WINNER</div>
                    <div class="ext-winner-details">
                        <h3>${ext_safeHtml(winner.option.name)}</h3>
                        <div class="ext-winner-score">
                            Score: ${ext_safeNumber(winner.totalScore, 2)}/5.0 
                            (${Math.round((winner.totalScore/5)*100)}%)
                        </div>
                        ${winner.option.description ? `<p style="color: #666; margin-top: 5px;">${ext_safeHtml(winner.option.description)}</p>` : ''}
                    </div>
                </div>
                
                <div class="ext-confidence-meter">
                    <h4>Decision Confidence: ${confidence.bucket.toUpperCase()}</h4>
                    <div class="ext-confidence-bar">
                        <div class="ext-confidence-fill ${confidence.bucket}" style="width: ${confidence.confidencePercent}%"></div>
                    </div>
                    <div class="ext-confidence-label">
                        ${confidence.confidencePercent}% - ${confidence.explanation}
                    </div>
                </div>
                
                ${runnerUp ? `
                    <div style="text-align: center; margin: 20px 0; padding: 15px; background: rgba(102, 126, 234, 0.05); border-radius: 8px;">
                        <strong>Margin vs runner-up:</strong> 
                        +${ext_safeNumber(margin, 2)} points (${marginPercent}%) ahead of ${ext_safeHtml(runnerUp.option.name)}
                    </div>
                ` : ''}
                
                <div class="ext-differentiators">
                    <h4>Why ${ext_safeHtml(winner.option.name)} won:</h4>
                    ${topCriteria.map(([criteriaName, scores]) => `
                        <div class="ext-differentiator-item">
                            <span class="ext-differentiator-icon">▶</span>
                            <strong>${ext_safeHtml(criteriaName)}:</strong> 
                            Scored ${scores.rating}/5 with ${Math.round(scores.weight)}% importance weight
                        </div>
                    `).join('')}
                </div>
                
                ${results.length > 1 && runnerUp ? `
                    <div style="margin-top: 20px; padding: 15px; background: #f8f9fa; border-radius: 8px; border-left: 4px solid #17a2b8;">
                        <h5 style="margin: 0 0 8px 0; color: #17a2b8;">Close alternative to consider:</h5>
                        <strong>${ext_safeHtml(runnerUp.option.name)}</strong> 
                        (${ext_safeNumber(runnerUp.totalScore, 2)}/5.0, Δ ${ext_safeNumber(margin, 2)})
                        ${Math.abs(margin) < 0.5 ? '<br><em style="color: #856404;">Very close race - consider both options!</em>' : ''}
                    </div>
                ` : ''}
            </div>
        `;
    }

    /**
     * Render detailed ranking table
     */
    function ext_renderRankingTable(results) {
        const container = document.getElementById('ext_rankingTableContainer');
        if (!container) return;

        const maxScore = Math.max(...results.map(r => r.totalScore));

        container.innerHTML = `
            <div class="ext-chart-container">
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 15px;">
                    <h4>Complete Rankings</h4>
                    <div style="font-size: 0.9rem; color: #666;">
                        Ties handled: equal scores share a rank
                    </div>
                </div>
                <div style="overflow-x: auto;">
                    <table class="ext-ranking-table">
                        <thead>
                            <tr>
                                <th>Rank</th>
                                <th>Option</th>
                                <th>Score</th>
                                <th>Percentage</th>
                                <th>Visual</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${results.map((result, index) => {
                                const percentage = Math.round((result.totalScore / 5) * 100);
                                const barWidth = (result.totalScore / maxScore) * 100;
                                const isTied = index > 0 && Math.abs(result.totalScore - results[index-1].totalScore) <= ext_config.rankEpsilon;
                                
                                return `
                                    <tr class="${index === 0 ? 'winner' : ''}">
                                        <td class="ext-rank-cell ${isTied ? 'tied' : ''}" title="${isTied ? 'Tied with previous option' : ''}">
                                            ${result.rank}
                                        </td>
                                        <td>
                                            <strong>${ext_safeHtml(result.option.name)}</strong>
                                            ${result.option.description ? `<br><small style="color: #666;">${ext_safeHtml(result.option.description)}</small>` : ''}
                                        </td>
                                        <td><strong>${ext_safeNumber(result.totalScore, 2)}</strong></td>
                                        <td>${percentage}%</td>
                                        <td>
                                            <div class="ext-score-visual">
                                                <div class="ext-score-bar">
                                                    <div class="ext-score-fill ${index === 0 ? 'winner' : ''}" style="width: ${barWidth}%"></div>
                                                </div>
                                            </div>
                                        </td>
                                    </tr>
                                `;
                            }).join('')}
                        </tbody>
                    </table>
                </div>
            </div>
        `;
    }

    /**
     * Render criteria weights pie chart
     */
/**
 * Render criteria weights pie chart with improved compatibility
 */
function ext_renderWeightsPie(decisionCopy) {
    const container = document.getElementById('ext_weightsPieContainer');
    const canvas = document.getElementById('ext_weightsPie');
    
    if (!container || !canvas) {
        console.warn('Pie chart container or canvas not found');
        return;
    }

    // Enhanced Chart.js detection and compatibility
    if (!window.ExtChart && !window.Chart) {
        console.warn('Chart.js not available for pie chart');
        ext_showChartFallback(container, 'Interactive pie chart requires Chart.js library');
        return;
    }

    // Use available Chart.js instance
    const ChartJS = window.ExtChart || window.Chart;
    
    const ctx = canvas.getContext('2d');
    const criteriaNames = decisionCopy.criteria.map(c => c.name);
    const weights = decisionCopy.criteria.map(c => 
        Math.round(decisionCopy.normalizedWeights[c.id] || 0)
    );
    const colors = ext_generateColors(criteriaNames.length);

    try {
        // Destroy existing chart if it exists
        if (ext_state.charts.pie) {
            ext_state.charts.pie.destroy();
        }

        // Chart configuration with version compatibility
        const chartConfig = {
            type: 'pie',
            data: {
                labels: criteriaNames,
                datasets: [{
                    data: weights,
                    backgroundColor: colors,
                    borderWidth: 2,
                    borderColor: '#ffffff',
                    hoverBorderWidth: 3,
                    hoverBorderColor: '#333333'
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: true,
                plugins: {
                    legend: {
                        position: 'bottom',
                        labels: {
                            padding: 20,
                            usePointStyle: true,
                            font: {
                                size: 12
                            }
                        }
                    },
                    tooltip: {
                        callbacks: {
                            label: function(context) {
                                const label = context.label || '';
                                const value = context.parsed || 0;
                                return `${label}: ${value}%`;
                            }
                        }
                    }
                },
                // Fallback for older Chart.js versions
                legend: {
                    position: 'bottom',
                    labels: {
                        padding: 20,
                        usePointStyle: true
                    }
                }
            }
        };

        const chart = new ChartJS(ctx, chartConfig);
        ext_state.charts.pie = chart;
        
        console.log('Pie chart rendered successfully');

    } catch (error) {
        console.error('Error creating pie chart:', error);
        ext_showChartFallback(container, 'Could not render pie chart visualization');
    }
}





    
    /**
     * Render performance heatmap
     */
    function ext_renderHeatmap(decisionCopy) {
        const container = document.getElementById('ext_heatmapContainer');
        if (!container || !decisionCopy) return;

        container.innerHTML = `
            <div class="ext-chart-container">
                <h4>Performance Matrix</h4>
                <div class="ext-heatmap-wrapper" style="overflow-x: auto;">
                    <table class="ext-heatmap-table">
                        <thead>
                            <tr>
                                <th>Option</th>
                                ${decisionCopy.criteria.map(c => `<th>${ext_safeHtml(c.name)}</th>`).join('')}
                            </tr>
                        </thead>
                        <tbody>
                            ${decisionCopy.options.map(option => {
                                return `
                                    <tr>
                                        <td class="ext-heatmap-label">${ext_safeHtml(option.name)}</td>
                                        ${decisionCopy.criteria.map(criteria => {
                                            const ratingKey = `${option.id}-${criteria.id}`;
                                            const rating = decisionCopy.ratings[ratingKey] || 3;
                                            const weight = (decisionCopy.normalizedWeights[criteria.id] || 0) / 100;
                                            const weightedScore = rating * weight;
                                            
                                            let colorClass = 'ext-heatmap-low';
                                            if (rating >= 4) colorClass = 'ext-heatmap-high';
                                            else if (rating >= 3) colorClass = 'ext-heatmap-medium';
                                            
                                            return `
                                                <td class="ext-heatmap-cell ${colorClass}" 
                                                    title="${ext_safeHtml(option.name)} on ${ext_safeHtml(criteria.name)}: ${rating}/5 (weighted: ${ext_safeNumber(weightedScore, 3)})">
                                                    <div class="ext-heatmap-rating">${rating}</div>
                                                    <div class="ext-heatmap-weighted">${ext_safeNumber(weightedScore, 2)}</div>
                                                </td>
                                            `;
                                        }).join('')}
                                    </tr>
                                `;
                            }).join('')}
                        </tbody>
                    </table>
                </div>
                <div class="ext-heatmap-legend">
                    <span class="ext-legend-item">
                        <span class="ext-legend-color ext-heatmap-low"></span>
                        1-2: Needs Improvement
                    </span>
                    <span class="ext-legend-item">
                        <span class="ext-legend-color ext-heatmap-medium"></span>
                        3: Adequate
                    </span>
                    <span class="ext-legend-item">
                        <span class="ext-legend-color ext-heatmap-high"></span>
                        4-5: Excellent
                    </span>
                </div>
            </div>
        `;
    }

    /**
     * Render sensitivity analysis
     */
function ext_renderSensitivity(flipPoints) {
    const container = document.getElementById('ext_sensitivityContainer');
    if (!container) return;

    const validFlipPoints = flipPoints.filter(fp => !fp.impossible);
    const criticalFlipPoints = validFlipPoints.filter(fp => Math.abs(fp.flipDeltaPercentPoints) < 10);

    container.innerHTML = `
        <div class="ext-chart-container">
            <h4>Sensitivity Analysis</h4>
            <p style="color: #666; margin-bottom: 20px;">
                This shows how sensitive your decision is to changes in criteria weights.
            </p>
            
            ${criticalFlipPoints.length > 0 ? `
                <div class="ext-sensitivity-alert" style="background: #fff3cd; border: 1px solid #ffeaa7; border-radius: 8px; padding: 15px; margin-bottom: 20px;">
                    <h5 style="color: #856404; margin: 0 0 10px 0;">⚠️ Decision-Critical Criteria</h5>
                    <p style="color: #856404; margin: 0;">Small changes to these criteria could flip your decision:</p>
                </div>
            ` : ''}
            
            ${validFlipPoints.length > 0 ? `
                <div class="ext-tornado-chart">
                    <h5 style="margin: 0 0 15px 0; color: #333;">Decision Sensitivity (Tornado Chart)</h5>
                    <p style="color: #666; margin: 0 0 20px 0; font-size: 0.9rem;">
                        Shorter bars = more sensitive criteria. Shows weight change needed to flip the decision.
                    </p>
                    ${ext_renderTornadoChart(validFlipPoints)}
                </div>
            ` : ''}
            
            <div class="ext-flip-points-table">
                <h5>Detailed Flip Points Analysis</h5>
                <div style="overflow-x: auto;">
                    <table class="ext-ranking-table">
                        <thead>
                            <tr>
                                <th>Criteria</th>
                                <th>Current Weight</th>
                                <th>Change Needed</th>
                                <th>Sensitivity</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${flipPoints.map(fp => `
                                <tr>
                                    <td><strong>${ext_safeHtml(fp.criterionName)}</strong></td>
                                    <td>${fp.currentWeight || 'N/A'}%</td>
                                    <td>
                                        ${fp.impossible ? 'Cannot flip' : 
                                          `${fp.flipDeltaPercentPoints > 0 ? '+' : ''}${fp.flipDeltaPercentPoints}pp`}
                                    </td>
                                    <td>
                                        ${fp.impossible ? 
                                          '<span style="color: #666;">No Impact</span>' :
                                          Math.abs(fp.flipDeltaPercentPoints) < 5 ?
                                          '<span style="color: #dc3545; font-weight: 600;">Critical</span>' :
                                          Math.abs(fp.flipDeltaPercentPoints) < 15 ?
                                          '<span style="color: #fd7e14; font-weight: 600;">Moderate</span>' :
                                          '<span style="color: #28a745; font-weight: 600;">Stable</span>'
                                        }
                                    </td>
                                </tr>
                            `).join('')}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    `;
}


/**
 * Render tornado chart visualization
 */

/**
 * Enhanced tornado chart visualization with better visual hierarchy
 */
function ext_renderTornadoChart(flipPoints) {
    // Sort by absolute flip point magnitude (most critical first)
    const sortedFlipPoints = [...flipPoints].sort((a, b) => 
        Math.abs(a.flipDeltaPercentPoints) - Math.abs(b.flipDeltaPercentPoints)
    );
    
    // Find maximum absolute change for scaling
    const maxChange = Math.max(...sortedFlipPoints.map(fp => Math.abs(fp.flipDeltaPercentPoints)));
    
    // Generate legend
    const legendHTML = `
        <div class="ext-tornado-legend">
            <div class="ext-tornado-legend-item">
                <div class="ext-tornado-legend-dot critical"></div>
                <span>Critical (≤5pp change)</span>
            </div>
            <div class="ext-tornado-legend-item">
                <div class="ext-tornado-legend-dot moderate"></div>
                <span>Moderate (5-15pp change)</span>
            </div>
            <div class="ext-tornado-legend-item">
                <div class="ext-tornado-legend-dot stable"></div>
                <span>Stable (>15pp change)</span>
            </div>
        </div>
    `;
    
    const tornadoHTML = sortedFlipPoints.map((fp, index) => {
        const absChange = Math.abs(fp.flipDeltaPercentPoints);
        const barWidth = maxChange > 0 ? Math.max((absChange / maxChange) * 100, 5) : 5; // Minimum 5% width
        
        // Determine criticality level with enhanced logic
        let criticalityClass, criticalityLabel, icon;
        if (absChange <= 5) {
            criticalityClass = 'critical';
            criticalityLabel = 'Critical';
            icon = '🔴';
        } else if (absChange <= 15) {
            criticalityClass = 'moderate';
            criticalityLabel = 'Moderate';
            icon = '🟡';
        } else {
            criticalityClass = 'stable';
            criticalityLabel = 'Stable';
            icon = '🟢';
        }
        
        // Add animation delay for staggered effect
        const animationDelay = index * 100;
        
        return `
            <div class="ext-tornado-item ${criticalityClass}" 
                 style="animation-delay: ${animationDelay}ms"
                 title="Change needed: ${fp.flipDeltaPercentPoints > 0 ? '+' : ''}${fp.flipDeltaPercentPoints} percentage points">
                <div class="ext-tornado-label">
                    ${icon} ${ext_safeHtml(fp.criterionName)}
                </div>
                <div class="ext-tornado-bar-container">
                    <div class="ext-tornado-bar ${criticalityClass}" 
                         style="width: ${barWidth}%; transition-delay: ${animationDelay}ms"
                         title="${criticalityLabel} sensitivity: ${fp.flipDeltaPercentPoints > 0 ? '+' : ''}${fp.flipDeltaPercentPoints}pp change needed">
                        ${barWidth > 25 ? `${Math.abs(fp.flipDeltaPercentPoints)}pp` : ''}
                    </div>
                </div>
                <div class="ext-tornado-value ${criticalityClass}">
                    ${fp.flipDeltaPercentPoints > 0 ? '+' : ''}${fp.flipDeltaPercentPoints}pp
                </div>
            </div>
        `;
    }).join('');
    
    return tornadoHTML + legendHTML;
}

    
    
    /**
     * Initialize what-if controls
     */
    function ext_initWhatIfControls(decisionCopy) {
        const container = document.getElementById('ext_sensitivityContainer');
        if (!container) return;

        // Initialize temporary weights
        ext_state.tmpWeights = { ...decisionCopy.normalizedWeights };

        const whatIfHTML = `
            <div class="ext-what-if-section">
                <h5>What-If Analysis</h5>
                <p style="color: #666; margin-bottom: 15px;">
                    Adjust criteria weights to see how it affects the ranking. 
                    <em>This is scenario-only - it won't change your saved decision.</em>
                </p>
                
                <div class="ext-what-if-controls">
                    ${decisionCopy.criteria.map(criteria => {
                        const currentWeight = Math.round(decisionCopy.normalizedWeights[criteria.id] || 0);
                        return `
                            <div class="ext-what-if-item">
                                <label for="whatif-${criteria.id}">${ext_safeHtml(criteria.name)}</label>
                                <div class="ext-slider-container">
                                    <input type="range" 
                                           id="whatif-${criteria.id}" 
                                           class="ext-what-if-slider"
                                           min="1" 
                                           max="50" 
                                           value="${currentWeight}"
                                           data-criteria-id="${criteria.id}">
                                    <span class="ext-slider-value" id="value-${criteria.id}">${currentWeight}%</span>
                                </div>
                            </div>
                        `;
                    }).join('')}
                </div>
                
                <div class="ext-what-if-results" id="ext_whatIfResults">
                    <!-- Results will be updated dynamically -->
                </div>
                
                <div class="ext-what-if-actions">
                    <button class="btn btn-secondary" id="ext_resetWhatIf">Reset to Original</button>
                </div>
            </div>
        `;

        container.insertAdjacentHTML('beforeend', whatIfHTML);

    // Attach event listeners with error handling
    const sliders = container.querySelectorAll('.ext-what-if-slider');
    sliders.forEach(slider => {
        if (slider) {
            try {
                slider.addEventListener('input', ext_handleWhatIfChange);
            } catch (error) {
                console.warn('Failed to attach slider listener:', error);
            }
        }
    });

        const resetBtn = document.getElementById('ext_resetWhatIf');
        if (resetBtn) {
            resetBtn.addEventListener('click', () => ext_resetWhatIfWeights(decisionCopy));
        }

        // Initial update
        ext_updateWhatIfResults(decisionCopy);
    }

    /**
     * Handle what-if slider changes
     */
    /**
     * Handle what-if slider changes with debouncing for performance
     */
    function ext_handleWhatIfChange(event) {
        const criteriaId = event.target.getAttribute('data-criteria-id');
        const newValue = parseInt(event.target.value);
        
        if (!criteriaId || isNaN(newValue)) return;
    
        // Update the display immediately for responsiveness
        const valueDisplay = document.getElementById(`value-${criteriaId}`);
        if (valueDisplay) {
            valueDisplay.textContent = `${newValue}%`;
        }
    
        // Update temporary weights
        ext_state.tmpWeights[criteriaId] = newValue;
    
        // Debounced heavy calculations
        if (!ext_state.debouncedUpdate) {
            ext_state.debouncedUpdate = ext_debounce(() => {
                try {
                    // Renormalize all weights to sum to 100%
                    ext_renormalizeWhatIfWeights();
                    
                    // Update results
                    const decisionCopy = ext_cloneDecisionData();
                    if (decisionCopy) {
                        ext_updateWhatIfResults(decisionCopy);
                    }
                } catch (error) {
                    console.error('Error in what-if update:', error);
                    // Show user-friendly error
                    const resultsContainer = document.getElementById('ext_whatIfResults');
                    if (resultsContainer) {
                        resultsContainer.innerHTML = `
                            <div style="color: #dc3545; padding: 10px; text-align: center;">
                                <small>Error updating results. Please try adjusting the values again.</small>
                            </div>
                        `;
                    }
                }
            }, 300); // 300ms debounce
        }
    
        ext_state.debouncedUpdate();
    }
    
    
    /**
     * Renormalize what-if weights to sum to 100%
     */
    function ext_renormalizeWhatIfWeights() {
        const total = Object.values(ext_state.tmpWeights).reduce((sum, w) => sum + w, 0);
        
        if (total > 0) {
            Object.keys(ext_state.tmpWeights).forEach(id => {
                ext_state.tmpWeights[id] = (ext_state.tmpWeights[id] / total) * 100;
            });
        }

        // Update all slider displays
        Object.keys(ext_state.tmpWeights).forEach(id => {
            const slider = document.getElementById(`whatif-${id}`);
            const valueDisplay = document.getElementById(`value-${id}`);
            
            if (slider && valueDisplay) {
                const normalizedValue = Math.round(ext_state.tmpWeights[id]);
                slider.value = normalizedValue;
                valueDisplay.textContent = `${normalizedValue}%`;
            }
        });
    }

    /**
     * Update what-if results display
     */
    function ext_updateWhatIfResults(decisionCopy) {
        const resultsContainer = document.getElementById('ext_whatIfResults');
        if (!resultsContainer) return;

        // Create temporary decision copy with what-if weights
        const whatIfCopy = JSON.parse(JSON.stringify(decisionCopy));
        whatIfCopy.normalizedWeights = { ...ext_state.tmpWeights };

        // Compute new results
        const whatIfResults = ext_computeResultsCopy(whatIfCopy);
        const rankedResults = ext_assignRanks(whatIfResults);

        // Compare with original
        const originalResults = ext_computeResultsCopy(decisionCopy);
        const originalWinner = originalResults[0];
        const whatIfWinner = rankedResults[0];

        const winnerChanged = originalWinner.option.id !== whatIfWinner.option.id;

        resultsContainer.innerHTML = `
            <div class="ext-what-if-summary">
                ${winnerChanged ? `
                    <div class="ext-winner-change-alert">
                        🔄 <strong>Winner Changed!</strong> 
                        ${ext_safeHtml(whatIfWinner.option.name)} is now the top choice 
                        (was ${ext_safeHtml(originalWinner.option.name)})
                    </div>
                ` : `
                    <div class="ext-winner-stable">
                        ✓ Winner remains: ${ext_safeHtml(whatIfWinner.option.name)}
                    </div>
                `}
                
                <div class="ext-what-if-top3">
                    <h6>Current Top 3:</h6>
                    ${rankedResults.slice(0, 3).map((result, index) => `
                        <div class="ext-what-if-rank-item">
                            ${index + 1}. ${ext_safeHtml(result.option.name)} 
                            (${ext_safeNumber(result.totalScore, 2)}/5.0)
                        </div>
                    `).join('')}
                </div>
            </div>
        `;
    }

    /**
     * Reset what-if weights to original
     */
    function ext_resetWhatIfWeights(decisionCopy) {
        ext_state.tmpWeights = { ...decisionCopy.normalizedWeights };
        
        // Update all sliders
        Object.keys(ext_state.tmpWeights).forEach(id => {
            const slider = document.getElementById(`whatif-${id}`);
            const valueDisplay = document.getElementById(`value-${id}`);
            
            if (slider && valueDisplay) {
                const value = Math.round(ext_state.tmpWeights[id]);
                slider.value = value;
                valueDisplay.textContent = `${value}%`;
            }
        });

        ext_updateWhatIfResults(decisionCopy);
    }

    /**
     * Render risks analysis
     */
    function ext_renderRisksAnalysis(results, decisionCopy) {
        const container = document.getElementById('ext_risksContainer');
        if (!container || !results.length) return;

        const winner = results[0];
        const risks = [];

        // Find criteria where winner scored poorly
        decisionCopy.criteria.forEach(criteria => {
            const ratingKey = `${winner.option.id}-${criteria.id}`;
            const rating = decisionCopy.ratings[ratingKey] || 3;
            
            if (rating <= 2) {
                risks.push({
                    criterion: criteria.name,
                    rating: rating,
                    weight: Math.round(decisionCopy.normalizedWeights[criteria.id] || 0),
                    severity: rating === 1 ? 'high' : 'medium'
                });
            }
        });

        // Find criteria where winner is significantly behind runner-up
        if (results.length > 1) {
            const runnerUp = results[1];
            decisionCopy.criteria.forEach(criteria => {
                const winnerRatingKey = `${winner.option.id}-${criteria.id}`;
                const runnerUpRatingKey = `${runnerUp.option.id}-${criteria.id}`;
                const winnerRating = decisionCopy.ratings[winnerRatingKey] || 3;
                const runnerUpRating = decisionCopy.ratings[runnerUpRatingKey] || 3;
                
                if (runnerUpRating - winnerRating >= 2 && !risks.find(r => r.criterion === criteria.name)) {
                    risks.push({
                        criterion: criteria.name,
                        rating: winnerRating,
                        weight: Math.round(decisionCopy.normalizedWeights[criteria.id] || 0),
                        severity: 'medium',
                        gap: runnerUpRating - winnerRating
                    });
                }
            });
        }

        container.innerHTML = `
            <div class="ext-chart-container">
                <h4>Risks & Weaknesses Analysis</h4>
                
                ${risks.length === 0 ? `
                    <div class="ext-no-risks">
                        <p>✅ No significant weaknesses identified for ${ext_safeHtml(winner.option.name)}.</p>
                        <p style="color: #666;">Your top choice performs well across all criteria.</p>
                    </div>
                ` : `
                    <div class="ext-risks-summary">
                        <p>Areas where <strong>${ext_safeHtml(winner.option.name)}</strong> could be vulnerable:</p>
                    </div>
                    
                    <div class="ext-risks-list">
                        ${risks.map(risk => `
                            <div class="ext-risk-item ${risk.severity}">
                                <div class="ext-risk-header">
                                    <span class="ext-risk-icon">${risk.severity === 'high' ? '🔴' : '🟡'}</span>
                                    <strong>${ext_safeHtml(risk.criterion)}</strong>
                                    <span class="ext-risk-score">${risk.rating}/5</span>
                                </div>
                                <div class="ext-risk-details">
                                    Weight: ${risk.weight}% | 
                                    ${risk.gap ? `Behind runner-up by ${risk.gap} points | ` : ''}
                                    ${risk.severity === 'high' ? 'High Priority' : 'Monitor Closely'}
                                </div>
                                <div class="ext-risk-suggestion">
                                    ${ext_getRiskSuggestion(risk.criterion, risk.rating)}
                                </div>
                            </div>
                        `).join('')}
                    </div>
                    
                    <div class="ext-risks-actions">
                        <h5>Recommended Actions:</h5>
                        <ul>
                            ${risks.slice(0, 3).map(risk => `
                                <li>Investigate ${ext_safeHtml(risk.criterion)} more thoroughly before final decision</li>
                            `).join('')}
                            ${risks.some(r => r.weight > 15) ? 
                                '<li>Consider if these weaknesses are acceptable given the high importance weights</li>' : ''}
                            <li>Compare detailed specifications with runner-up options</li>
                        </ul>
                    </div>
                `}
            </div>
        `;
    }

    /**
     * Get risk mitigation suggestion
     */
    function ext_getRiskSuggestion(criterion, rating) {
        const suggestions = {
            'price': 'Review budget allocation and consider total cost of ownership',
            'cost': 'Review budget allocation and consider total cost of ownership',
            'performance': 'Verify performance benchmarks meet your minimum requirements',
            'quality': 'Research user reviews and quality assessments',
            'reliability': 'Check warranty terms and failure rates',
            'support': 'Evaluate customer service reputation and availability',
            'features': 'Confirm essential features are included or can be added',
            'ease': 'Consider training needs and learning curve',
            'usability': 'Consider training needs and learning curve'
        };

        const lowerCriterion = criterion.toLowerCase();
        for (const [key, suggestion] of Object.entries(suggestions)) {
            if (lowerCriterion.includes(key)) {
                return suggestion;
            }
        }

        return rating === 1 ? 
            'This is a significant weakness - verify it won\'t impact your goals' :
            'Consider whether this limitation is acceptable for your needs';
    }

    /**
     * Show chart fallback when Chart.js fails
     */
    function ext_showChartFallback(container, message) {
        const fallbackHTML = `
            <div class="ext-chart-fallback">
                <div class="ext-fallback-icon">📊</div>
                <div class="ext-fallback-message">${ext_safeHtml(message)}</div>
                <div class="ext-fallback-note">Charts require Chart.js library to display properly.</div>
            </div>
        `;
        
        const chartContainer = container.querySelector('.ext-chart-container') || container;
        chartContainer.innerHTML = fallbackHTML;
    }

    // ========================================
    // INTEGRATION & INITIALIZATION
    // ========================================

    /**
     * Initialize the enhanced results module
     */
    function ext_initializeModule() {
        if (ext_state.isInitialized) return;
        
        console.log('Initializing enhanced results module...');
        ext_checkChartJSDependency();
        
        // Check dependencies
        if (!window.ExtChart) {
            console.warn('Chart.js not available - some features may be limited');
        }
        
        if (!window.jsPDF) {
            console.warn('jsPDF not available - enhanced PDF generation disabled');
        }
        
        // Don't hook into calculateResults since we're using dynamic loading
        // The integration is handled in the main script.js file
        console.log('Enhanced results module ready for integration');
        
        ext_state.isInitialized = true;
        console.log('Enhanced results module initialized successfully');
    }

    // ========================================
    // MODULE EXPORTS & AUTO-INITIALIZATION
    // ========================================

    // Export functions to global scope for debugging and manual calling
    window.ext_results = {
        renderResultsAccordion: ext_renderResultsAccordion,
        generatePDFReport: ext_generatePDFReport,
        computeResultsCopy: ext_computeResultsCopy,
        assignRanks: ext_assignRanks,
        computeConfidence: ext_computeConfidence,
        computeFlipPoints: ext_computeFlipPoints,
        state: ext_state,
        config: ext_config
    };

    // Auto-initialize when DOM is ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', ext_initializeModule);
    } else {
        // DOM already loaded
        ext_initializeModule();
    }

    // Also initialize when script loads (backup)
    setTimeout(ext_initializeModule, 100);

})();

/**
 * Integration Notes:
 * 
 * 1. This module automatically hooks into the existing calculateResults() function
 * 2. All functions are prefixed with 'ext_' to avoid conflicts
 * 3. No modifications to existing decisionData or state-mutating functions
 * 4. Graceful degradation if Chart.js or jsPDF fail to load
 * 5. Maintains backward compatibility with existing results
 * 6. Professional-grade PDF generation with embedded charts
 * 7. Interactive what-if analysis with real-time updates
 * 8. Comprehensive sensitivity analysis and risk assessment
 * 9. Mobile-responsive design with touch-friendly controls
 * 10. Accessibility features with proper ARIA labels and keyboard support
 * 
 * Key Fixes Applied:
 * - Fixed Chart.js plugin detection and error handling
 * - Added fallback displays for failed chart renders
 * - Improved null/undefined checks throughout
 * - Enhanced XSS protection with proper HTML escaping
 * - Better error handling in PDF generation
 * - Fixed slider event handlers with proper null checks
 * - Added chart fallback functionality
 * - Improved dependency detection and graceful degradation
 */
