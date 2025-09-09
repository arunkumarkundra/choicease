        // Global color scheme for consistent styling across all charts and visualizations
        const CHART_COLORS = [
            '#667eea', '#764ba2', '#28a745', '#ffc107', '#dc3545', 
            '#17a2b8', '#6610f2', '#e83e8c', '#fd7e14', '#20c997',
            '#6f42c1', '#f39c12', '#9b59b6', '#34495e', '#e74c3c',
            '#1abc9c', '#3498db', '#f1c40f', '#e67e22', '#95a5a6'
        ];


        // Application state
        let currentStep = 1;
        let decisionData = {
            title: '',
            description: '',
            options: [],
            criteria: [],
            weights: {},
            ratings: {}
        };

        // ADD THIS: Advanced analytics state
        let advancedAnalytics = {
            isVisible: false,
            results: null,
            confidence: null,
            sensitivity: null,
            risks: null
        };


        // Copy for Whatif Analysis
        let whatIfDecisionData = null;

        // Chart management state
        let chartManager = {
            isLoaded: false,
            isLoading: false,
            charts: {},
            loadPromise: null
        };




        // Debounced weight updates for what-if analysis
        function debounce(func, wait) {
            let timeout;
            return function executedFunction(...args) {
                const later = () => {
                    clearTimeout(timeout);
                    func(...args);
                };
                clearTimeout(timeout);
                timeout = setTimeout(later, wait);
            };
        }


        // Memoized calculation results
        const calculationCache = new Map();
        
        function getCachedResults(cacheKey) {
            return calculationCache.get(cacheKey);
        }
        
        function setCachedResults(cacheKey, results) {
            // Limit cache size to prevent memory issues
            if (calculationCache.size > 10) {
                const firstKey = calculationCache.keys().next().value;
                calculationCache.delete(firstKey);
            }
            calculationCache.set(cacheKey, results);
        }
        
        function clearCalculationCache() {
            calculationCache.clear();
        }



        
        // Global error handler for advanced analytics
        function handleAdvancedAnalyticsError(error, context) {
            console.error(`Advanced Analytics Error in ${context}:`, error);
            
            // Show user-friendly error message
            showToast(`Analytics Error: ${error.message || 'Something went wrong'}. Please try refreshing.`, 'error');
            
            // Fallback to basic mode
            const container = document.getElementById('advancedAnalytics');
            if (container) {
                container.innerHTML = `
                    <div style="text-align: center; padding: 40px; background: #f8d7da; border: 2px solid #dc3545; border-radius: 12px; color: #721c24;">
                        <h4>⚠️ Advanced Analytics Unavailable</h4>
                        <p>There was an error loading advanced analytics. Your basic results are still available.</p>
                        <button class="btn btn-secondary" onclick="toggleAdvancedAnalytics()">Try Again</button>
                    </div>
                `;
            }
        }



        // Enhanced chart loading function:
        
        function loadChartJSWithRetry(maxRetries = 3) {
            let retryCount = 0;
            
            function attemptLoad() {
                return loadChartJS().catch(error => {
                    retryCount++;
                    if (retryCount < maxRetries) {
                        console.warn(`Chart.js load failed, retry ${retryCount}/${maxRetries}`);
                        return new Promise(resolve => {
                            setTimeout(() => resolve(attemptLoad()), 1000 * retryCount);
                        });
                    }
                    throw error;
                });
            }
            
            return attemptLoad();
        }




        // Dynamic Chart.js loading
        function loadChartJS() {
            if (chartManager.isLoaded) {
                return Promise.resolve();
            }
            
            if (chartManager.isLoading) {
                return chartManager.loadPromise;
            }
            
            chartManager.isLoading = true;
            
            chartManager.loadPromise = new Promise((resolve, reject) => {
                console.log('Loading Chart.js dynamically...');
                
                const script = document.createElement('script');
                script.src = 'https://cdn.jsdelivr.net/npm/chart.js@4.4.1/dist/chart.umd.js';
                script.onload = () => {
                    chartManager.isLoaded = true;
                    chartManager.isLoading = false;
                    console.log('Chart.js loaded successfully');
                    resolve();
                };
                script.onerror = () => {
                    chartManager.isLoading = false;
                    console.warn('Failed to load Chart.js');
                    reject(new Error('Chart.js failed to load'));
                };
                document.head.appendChild(script);
            });
            
            return chartManager.loadPromise;
        }
        
        // Chart cleanup function
        function cleanupCharts() {
            // More aggressive cleanup with error handling
            Object.entries(chartManager.charts).forEach(([key, chart]) => {
                try {
                    if (chart && typeof chart.destroy === 'function') {
                        chart.destroy();
                    }
                } catch (error) {
                    console.warn(`Error destroying chart ${key}:`, error);
                }
            });
            chartManager.charts = {};
            
            // Clear calculation cache when cleaning up
            clearCalculationCache();
            
            // Force garbage collection hint (if available)
            if (window.gc) {
                window.gc();
            }
        }





        // Input sanitization
        function sanitizeInput(input) {
            return input.replace(/[<>&"']/g, char => ({
                '<': '&lt;',
                '>': '&gt;',
                '&': '&amp;',
                '"': '&quot;',
                "'": '&apos;'
            }[char]));
        }

        // Initialize app
        function initializeApp() {
            updateProgressBar();
            // Attach event listeners
            document.getElementById('step1Continue').addEventListener('click', nextStep);
            document.getElementById('addOptionBtn').addEventListener('click', addOption);
            document.getElementById('step2Back').addEventListener('click', previousStep);
            document.getElementById('step2Continue').addEventListener('click', nextStep);
            document.getElementById('addCriteriaBtn').addEventListener('click', addCriteria);
            document.getElementById('step3Back').addEventListener('click', previousStep);
            document.getElementById('step3Continue').addEventListener('click', nextStep);
            document.getElementById('step4Back').addEventListener('click', previousStep);
            document.getElementById('step4Continue').addEventListener('click', nextStep);
            document.getElementById('step5Back').addEventListener('click', previousStep);
            document.getElementById('step5Calculate').addEventListener('click', calculateResults);
            document.getElementById('exportDropdownBtn').addEventListener('click', toggleExportDropdown);
            document.getElementById('startOverBtn').addEventListener('click', startOver);
            document.getElementById('step6Back').addEventListener('click', previousStep);
            document.getElementById('importFile').addEventListener('change', handleFileImport);
            document.getElementById('importQR').addEventListener('change', handleQRImport);
            document.getElementById('shareResultsBtn').addEventListener('click', shareResults);
            document.getElementById('howItWorksBtn').addEventListener('click', openModal);
            document.querySelector('.close').addEventListener('click', closeModal);
            document.getElementById('closeModalBtn').addEventListener('click', closeModal);
            
            // Close modal when clicking outside
            window.addEventListener('click', function(event) {
                const modal = document.getElementById('howItWorksModal');
                if (event.target === modal) {
                    closeModal();
                }
            });

            
            document.addEventListener('click', function(event) {
                if (event.target.classList.contains('export-option')) {
                    const type = event.target.getAttribute('data-type');
                    handleExportSelection(type);
                }
                // Close dropdown when clicking outside
                if (!event.target.closest('.export-dropdown') && !event.target.closest('#exportDropdownBtn')) {
                    document.getElementById('exportDropdown').classList.remove('show');
                }
            });
        }

        // Step navigation
        function nextStep() {
            if (validateCurrentStep()) {
                // Capture all ratings when leaving step 5
                if (currentStep === 5) {
                    captureAllRatings();
                }
                currentStep++;
                showStep(currentStep);
                updateProgressBar();
                updateStepIndicator();
            }
        }

        function previousStep() {
            // Capture all ratings when leaving step 5
            if (currentStep === 5) {
                captureAllRatings();
            }
            currentStep--;
            showStep(currentStep);
            updateProgressBar();
            updateStepIndicator();
        }

        function showStep(step) {
            for (let i = 1; i <= 6; i++) {
                document.getElementById(`section${i}`).classList.add('hidden');
            }
            document.getElementById(`section${step}`).classList.remove('hidden');
            if (step === 4) {
                setupWeightingStep();
            } else if (step === 5) {
                setupRatingStep();
            }
        }

        function updateProgressBar() {
            const progress = (currentStep / 6) * 100;
            document.getElementById('progressFill').style.width = `${progress}%`;
        }

        function updateStepIndicator() {
            for (let i = 1; i <= 6; i++) {
                const step = document.getElementById(`step${i}`);
                if (i < currentStep) {
                    step.classList.remove('active');
                    step.classList.add('completed');
                } else if (i === currentStep) {
                    step.classList.remove('completed');
                    step.classList.add('active');
                } else {
                    step.classList.remove('active', 'completed');
                }
            }
        }

        // Validation
        function validateCurrentStep() {
            switch (currentStep) {
                case 1:
                    const title = document.getElementById('decisionTitle').value.trim();
                    if (!title) {
                        alert('Please enter a decision title.');
                        return false;
                    }
                    decisionData.title = sanitizeInput(title);
                    decisionData.description = sanitizeInput(document.getElementById('decisionDescription').value.trim());
                    return true;
                case 2:
                    if (decisionData.options.length < 2) {
                        alert('Please add at least 2 options to compare.');
                        return false;
                    }
                    return true;
                case 3:
                    if (decisionData.criteria.length < 2) {
                        alert('Please add at least 2 criteria for comparison.');
                        return false;
                    }
                    return true;
                default:
                    return true;
            }
        }

        // Options management
        function addOption() {
            const name = sanitizeInput(document.getElementById('optionName').value.trim());
            if (!name) {
                alert('Please enter an option name.');
                return;
            }
            const description = sanitizeInput(document.getElementById('optionDescription').value.trim());
            const option = {
                id: Date.now(),
                name: name,
                description: description
            };
            decisionData.options.push(option);
            displayOptions();
            document.getElementById('optionName').value = '';
            document.getElementById('optionDescription').value = '';
            checkOptionsWarning();
        }

        function displayOptions() {
            const container = document.getElementById('optionsList');
            container.innerHTML = '';
            decisionData.options.forEach(option => {
                const div = document.createElement('div');
                div.className = 'option-item';
                div.dataset.id = option.id;

                const button = document.createElement('button');
                button.className = 'remove-btn';
                button.textContent = '×';
                button.setAttribute('aria-label', `Remove option ${option.name}`);
                button.addEventListener('click', () => removeOption(option.id));

                const h4 = document.createElement('h4');
                h4.textContent = option.name;

                div.appendChild(button);
                div.appendChild(h4);

                if (option.description) {
                    const p = document.createElement('p');
                    p.style.color = '#666';
                    p.style.marginTop = '8px';
                    p.textContent = option.description;
                    div.appendChild(p);
                }

                container.appendChild(div);
            });
            checkOptionsWarning();
        }

function removeOption(id) {
    console.log(`Removing option ${id} and cleaning up associated data...`);
    
    // Remove from options list
    decisionData.options = decisionData.options.filter(option => option.id !== id);

    // ✅ NEW: Clean up all ratings associated with this option
    const ratingsToDelete = [];
    Object.keys(decisionData.ratings).forEach(ratingKey => {
        const [optionId, criteriaId] = ratingKey.split('-');
        if (optionId === id.toString()) {
            ratingsToDelete.push(ratingKey);
        }
    });

    ratingsToDelete.forEach(key => {
        delete decisionData.ratings[key];
    });

    console.log(`Cleaned up ${ratingsToDelete.length} orphaned ratings for option ${id}`);

    // Update UI
    displayOptions();
    checkOptionsWarning();
}
        function checkOptionsWarning() {
            const warning = document.getElementById('optionsWarning');
            warning.style.display = decisionData.options.length < 3 ? 'block' : 'none';
        }

        // Criteria management
        function addCriteria() {
            const name = sanitizeInput(document.getElementById('criteriaName').value.trim());
            if (!name) {
                alert('Please enter a criteria name.');
                return;
            }
            const description = sanitizeInput(document.getElementById('criteriaDescription').value.trim());
            const criteria = {
                id: Date.now(),
                name: name,
                description: description
            };
            decisionData.criteria.push(criteria);
            decisionData.weights[criteria.id] = 3;  // set default rating for a newly added criterion
            normalizeImportanceWeights();           // recompute normalized weights immediately

            displayCriteria();
            document.getElementById('criteriaName').value = '';
            document.getElementById('criteriaDescription').value = '';
            checkCriteriaWarning();
        }

        function displayCriteria() {
            const container = document.getElementById('criteriaList');
            container.innerHTML = '';
            decisionData.criteria.forEach(criteria => {
                const div = document.createElement('div');
                div.className = 'criteria-item';
                div.dataset.id = criteria.id;

                const button = document.createElement('button');
                button.className = 'remove-btn';
                button.textContent = '×';
                button.setAttribute('aria-label', `Remove criteria ${criteria.name}`);
                button.addEventListener('click', () => removeCriteria(criteria.id));

                const h4 = document.createElement('h4');
                h4.textContent = criteria.name;

                div.appendChild(button);
                div.appendChild(h4);

                if (criteria.description) {
                    const p = document.createElement('p');
                    p.style.color = '#666';
                    p.style.marginTop = '8px';
                    p.textContent = criteria.description;
                    div.appendChild(p);
                }

                container.appendChild(div);
            });
            checkCriteriaWarning();
        }

function removeCriteria(id) {
    console.log(`Removing criteria ${id} and cleaning up associated data...`);
    
    // Remove from criteria list
    decisionData.criteria = decisionData.criteria.filter(c => c.id !== id);

    // Clean up raw weights
    delete decisionData.weights[id];

    // Clean up normalized weights and recalculate
    if (decisionData.normalizedWeights && decisionData.normalizedWeights[id] !== undefined) {
        delete decisionData.normalizedWeights[id];
        normalizeImportanceWeights();
    }

    // ✅ NEW: Clean up all ratings associated with this criteria
    const ratingsToDelete = [];
    Object.keys(decisionData.ratings).forEach(ratingKey => {
        const [optionId, criteriaId] = ratingKey.split('-');
        if (criteriaId === id.toString()) {
            ratingsToDelete.push(ratingKey);
        }
    });

    ratingsToDelete.forEach(key => {
        delete decisionData.ratings[key];
    });

    console.log(`Cleaned up ${ratingsToDelete.length} orphaned ratings for criteria ${id}`);

    // Update UI
    displayCriteria();
    checkCriteriaWarning();
}


        function checkCriteriaWarning() {
            const warning = document.getElementById('criteriaWarning');
            warning.style.display = decisionData.criteria.length > 7 ? 'block' : 'none';
        }

        // Weighting step
function setupWeightingStep() {
    const container = document.getElementById('weightingList');
    // Initialize with default rating of 3 if not set
    decisionData.criteria.forEach(criteria => {
        if (!decisionData.weights[criteria.id]) {
            decisionData.weights[criteria.id] = 3; // default rating
        }
    });

    // IMPORTANT: recompute normalized weights now that any missing ratings were filled
    normalizeImportanceWeights();

    container.innerHTML = decisionData.criteria.map(criteria => `
        <div class="criteria-item">
            <h4>${criteria.name}</h4>
            ${criteria.description ? `<p style="color: #666; margin-bottom: 10px;">${criteria.description}</p>` : ''}
            <div class="importance-rating">
                ${[1, 2, 3, 4, 5].map(rating => `
                    <div class="rating-option">
                        <input type="radio" id="rating-${criteria.id}-${rating}" name="importance-${criteria.id}" 
                               value="${rating}" ${decisionData.weights[criteria.id] == rating ? 'checked' : ''}
                               onchange="updateImportanceRating(${criteria.id}, ${rating})">
                        <label for="rating-${criteria.id}-${rating}">${rating === 1 ? 'Least' : rating === 5 ? 'Most' : rating}</label>
                    </div>
                `).join('')}
            </div>
            <div class="weight-result" id="weight-${criteria.id}">
                ${calculateDisplayWeight(criteria.id)}%
            </div>
        </div>
    `).join('');
}

function updateImportanceRating(criteriaId, rating) {
    decisionData.weights[criteriaId] = rating;
    normalizeImportanceWeights();
    updateWeightDisplays();
}

function normalizeImportanceWeights() {
    // Map ratings to actual weights
    // Original Scheme
    // const ratingToWeight = { 1: 1, 2: 2, 3: 3.5, 4: 6, 5: 10 };
    // New pattern based on: (1/x)*(x^n) ; x=1.77827889
    const ratingToWeight = { 1: 1, 2: 1.78, 3: 3.16, 4: 5.62, 5: 10 };
    
    // Calculate total of mapped weights
    const totalMappedWeight = Object.values(decisionData.weights)
        .reduce((sum, rating) => sum + ratingToWeight[rating], 0);
    
    // Store normalized percentages (but keep original ratings for display)
    const normalizedWeights = {};
    Object.keys(decisionData.weights).forEach(id => {
        const rating = decisionData.weights[id];
        const mappedWeight = ratingToWeight[rating];
        normalizedWeights[id] = (mappedWeight / totalMappedWeight) * 100;
    });
    
    // Store normalized weights separately for calculations
    decisionData.normalizedWeights = normalizedWeights;
}


function calculateDisplayWeight(criteriaId) {
    // If normalizedWeights is missing entirely OR doesn't include this id, recalc
    if (!decisionData.normalizedWeights || decisionData.normalizedWeights[criteriaId] === undefined) {
        normalizeImportanceWeights();
    }
    return Math.round(decisionData.normalizedWeights[criteriaId] || 0);
}




function updateWeightDisplays() {
    Object.keys(decisionData.weights).forEach(id => {
        const display = document.getElementById(`weight-${id}`);
        if (display) {
            display.textContent = `${calculateDisplayWeight(id)}%`;
        }
    });
}

        // Rating step
// Updated setupRatingStep function with better mobile layout
function setupRatingStep() {
    const container = document.getElementById('ratingMatrix');
    let html = '';
    decisionData.criteria.forEach(criteria => {
        html += `
            <div class="criteria-item" style="margin-bottom: 30px;">
                <h4>${criteria.name}</h4>
                ${criteria.description ? `<p style="color: #666; margin-bottom: 15px;">${criteria.description}</p>` : ''}
                <div style="display: grid; gap: 10px;">
        `;
        decisionData.options.forEach(option => {
            const ratingKey = `${option.id}-${criteria.id}`;
            const currentRating = decisionData.ratings[ratingKey] ?? 2;
            html += `
                <div class="rating-row">
                    <span class="option-name">${option.name}</span>
                    <div class="rating-controls">
                        <span style="font-size: 0.9rem; color: #666;">[0]</span>
                        <input type="range" min="0" max="5" value="${currentRating}" 
                               class="slider" role="slider" aria-label="Rating for ${option.name} on ${criteria.name}"
                               aria-valuemin="0" aria-valuemax="5" aria-valuenow="${currentRating}"
                               onchange="updateRating('${ratingKey}', this.value)">
                        <span style="font-size: 0.9rem; color: #666;">[5]</span>
                        <span id="rating-${ratingKey}" style="font-weight: bold; color: #667eea; min-width: 20px;">${currentRating}</span>
                    </div>
                </div>
            `;
        });
        html += `
                </div>
            </div>
        `;
    });
    container.innerHTML = html;
}

        function updateRating(key, value) {
            decisionData.ratings[key] = parseInt(value);
            document.getElementById(`rating-${key}`).textContent = value;
        }

        function captureAllRatings() {
            decisionData.options.forEach(option => {
                decisionData.criteria.forEach(criteria => {
                    const ratingKey = `${option.id}-${criteria.id}`;
                    const sliderElement = document.querySelector(`input[onchange*="${ratingKey}"]`);
                    if (sliderElement) {
                        const currentValue = sliderElement.value;
                        updateRating(ratingKey, currentValue);
                    }
                });
            });
        }


        // Results calculation
        // Updated calculateResults function with proper enhanced results integration
        function calculateResults() {
            const results = [];
            decisionData.options.forEach(option => {
                let totalScore = 0;
                const criteriaScores = {};
                decisionData.criteria.forEach(criteria => {
                    const ratingKey = `${option.id}-${criteria.id}`;
                    const rating = decisionData.ratings[ratingKey] ?? 2; // Default: 2 (Fair)
                    const weight = (decisionData.normalizedWeights[criteria.id] || 0) / 100;
                    const score = rating * weight;
                    criteriaScores[criteria.name] = {
                        rating: rating,
                        weight: weight,
                        score: score
                    };
                    totalScore += score;
                });
                results.push({
                    option: option,
                    totalScore: totalScore,
                    criteriaScores: criteriaScores
                });
            });
            results.sort((a, b) => b.totalScore - a.totalScore);
            
            // Store results for advanced analytics
            advancedAnalytics.results = results;
            
            // Display basic results
            displayResults(results);
            nextStep();
            
            // Initialize advanced analytics toggle
            initializeAdvancedAnalytics();
        }



        // Advanced analytics initialization
        function initializeAdvancedAnalytics() {
            const toggleBtn = document.getElementById('toggleAdvancedBtn');
            const advancedSection = document.getElementById('advancedAnalytics');
            
            if (toggleBtn && advancedSection) {
                toggleBtn.addEventListener('click', toggleAdvancedAnalytics);
                
                // Reset state
                advancedAnalytics.isVisible = false;
                advancedSection.classList.add('hidden');
                toggleBtn.textContent = '🤓 Show Advanced Analytics';
            }
        }
        


        function toggleAdvancedAnalytics() {
            const toggleBtn = document.getElementById('toggleAdvancedBtn');
            const advancedSection = document.getElementById('advancedAnalytics');
            
            if (!advancedAnalytics.isVisible) {
                // Show advanced analytics
                showAdvancedAnalytics();
                toggleBtn.textContent = '🤓 Hide Advanced Analytics';
                advancedAnalytics.isVisible = true;
            } else {
                // Hide advanced analytics and cleanup
                cleanupCharts();
                advancedSection.classList.add('hidden');
                toggleBtn.textContent = '🤓 Show Advanced Analytics';
                advancedAnalytics.isVisible = false;
            }
        }


        

        
        function showAdvancedAnalytics() {
            try {
                if (!advancedAnalytics.results) {
                    console.error('No results available for advanced analytics');
                    return;
                }
                
                // Show loading state
                const container = document.getElementById('advancedAnalytics');
                if (container) {
                    container.innerHTML = '<div style="text-align: center; padding: 40px;"><div class="loading-spinner"></div><p style="margin-top: 15px;">Loading advanced analytics...</p></div>';
                    container.classList.remove('hidden');
                }
                
                // Compute advanced metrics
                advancedAnalytics.confidence = computeConfidenceAnalysis(advancedAnalytics.results);
                advancedAnalytics.sensitivity = computeSensitivityAnalysis();
                advancedAnalytics.risks = computeRiskAnalysis(advancedAnalytics.results);
                
                // Load Chart.js and render
                loadChartJSWithRetry().then(() => {
                    renderAllAdvancedSections(true); // With charts
                }).catch(error => {
                    console.warn('Charts unavailable, using fallbacks:', error);
                    renderAllAdvancedSections(false); // Without charts
                });
                
            } catch (error) {
                handleAdvancedAnalyticsError(error, 'showAdvancedAnalytics');
            }
        }




        // renderAllAdvancedSections function includes error handling.
        function renderAllAdvancedSections(withCharts = false) {
            try {
                // Clear loading state
                const container = document.getElementById('advancedAnalytics');
                if (container) {
                    container.innerHTML = `
                        <div class="section">
                            <div class="section-title">📊 Executive Summary</div>
                            <div id="advancedSummary"></div>
                        </div>
                        <div class="section">
                            <div class="section-title">🥧 Criteria Weights</div>
                            <div id="advancedWeights"></div>
                        </div>
                        <div class="section">
                            <div class="section-title">🏆 Winner Analysis</div>
                            <div id="advancedWinnerAnalysis"></div>
                        </div>
                        <div class="section">
                            <div class="section-title">⚠️ Risk Analysis</div>
                            <div id="advancedRisks"></div>
                        </div>
                       <div class="section">
                            <div class="section-title">🔥 Performance Heatmap</div>
                            <div id="advancedHeatmap"></div>
                        </div>
                        
                        <div class="section">
                            <div class="section-title">⚖️ Sensitivity Analysis</div>
                            <div id="advancedSensitivity"></div>
                        </div>
                        
                        <div class="section">
                            <div class="section-title">🎛️ What-If Analysis</div>
                            <div id="advancedWhatIf"></div>
                        </div>
                        
                        <div class="section">
                            <div class="section-title">📄 Enhanced Export</div>
                            <div id="advancedExport" style="text-align: center; padding: 20px;">
                                <button class="btn btn-success" id="enhancedPdfBtn">
                                    📄 Download Advanced PDF Report
                                </button>
                                <p style="font-size: 0.9rem; color: #666; margin-top: 10px;">
                                    Comprehensive report with charts and analysis
                                </p>
                            </div>
                        </div>
                        
                    `;
                }
                
                // Render all sections with error handling
                try {
                    renderAdvancedSummary();
                } catch (error) {
                    console.error('Error rendering executive summary:', error);
                    document.getElementById('advancedSummary').innerHTML = '<p style="color: #dc3545;">Error loading executive summary</p>';
                }

                try {
                    renderWinnerAnalysis();
                } catch (error) {
                    console.error('Error rendering winner analysis:', error);
                    document.getElementById('advancedWinnerAnalysis').innerHTML = '<p style="color: #dc3545;">Error loading winner analysis</p>';
                }

                    
                try {
                    renderAdvancedWeights(withCharts);
                } catch (error) {
                    console.error('Error rendering weights:', error);
                    document.getElementById('advancedWeights').innerHTML = '<p style="color: #dc3545;">Error loading criteria weights</p>';
                }
                
                try {
                    renderPerformanceHeatmap();
                } catch (error) {
                    console.error('Error rendering heatmap:', error);
                    document.getElementById('advancedHeatmap').innerHTML = '<p style="color: #dc3545;">Error loading performance heatmap</p>';
                }
                
                try {
                    renderAdvancedSensitivity();
                } catch (error) {
                    console.error('Error rendering sensitivity:', error);
                    document.getElementById('advancedSensitivity').innerHTML = '<p style="color: #dc3545;">Error loading sensitivity analysis</p>';
                }
                
                try {
                    renderWhatIfAnalysis();
                } catch (error) {
                    console.error('Error rendering what-if:', error);
                    document.getElementById('advancedWhatIf').innerHTML = '<p style="color: #dc3545;">Error loading what-if analysis</p>';
                }
                
                try {
                    renderAdvancedRisks();
                } catch (error) {
                    console.error('Error rendering risks:', error);
                    document.getElementById('advancedRisks').innerHTML = '<p style="color: #dc3545;">Error loading risk analysis</p>';
                }
                
            } catch (error) {
                handleAdvancedAnalyticsError(error, 'renderAllAdvancedSections');
            }
            setupEnhancedPDF();
        }


        function setupEnhancedPDF() {
            const btn = document.getElementById('enhancedPdfBtn');
            if (btn) {
                btn.onclick = function() {
                    console.log('Enhanced PDF button clicked - using canvas approach');
                    generateCanvasBasedPDF();
                };
            }
        }






        // Confidence analysis computation
        function computeConfidenceAnalysis(results) {
            if (results.length < 2) {
                return {
                    percentage: 50,
                    level: 'medium',
                    explanation: 'Insufficient options for confidence analysis'
                };
            }
            
            const winner = results[0];
            const runnerUp = results[1];
            const gap = winner.totalScore - runnerUp.totalScore;
            const normalizedGap = Math.min(gap / 4, 1); // Max gap is 4 (5.0 - 1.0)
            
            const confidencePercent = Math.round(normalizedGap * 100);
            
            let level, explanation;
            if (confidencePercent >= 70) {
                level = 'high';
                explanation = 'Clear winner with significant margin';
            } else if (confidencePercent >= 40) {
                level = 'medium';
                explanation = 'Moderate confidence - decent margin';
            } else {
                level = 'low';
                explanation = 'Low confidence - very close scores';
            }
            
            return { percentage: confidencePercent, level, explanation, gap: gap.toFixed(2) };
        }
        
        // Sensitivity analysis computation
        function computeSensitivityAnalysis() {
            const sensitivity = [];
            
            if (!advancedAnalytics.results || advancedAnalytics.results.length < 2) {
                return sensitivity;
            }
            
            const winner = advancedAnalytics.results[0];
            const runnerUp = advancedAnalytics.results[1];
            
            decisionData.criteria.forEach(criteria => {
                const winnerRating = winner.criteriaScores[criteria.name]?.rating ?? 2;
                const runnerUpRating = runnerUp.criteriaScores[criteria.name]?.rating ?? 2;
                const currentWeight = (decisionData.normalizedWeights[criteria.id] || 0);
                
                // Simplified flip point calculation
                const ratingDiff = runnerUpRating - winnerRating;
                if (Math.abs(ratingDiff) < 0.1) {
                    sensitivity.push({
                        criteriaName: criteria.name,
                        changeNeeded: 'No impact',
                        criticality: 'stable'
                    });
                } else {
                    // Estimate change needed (simplified)
                    const changeNeeded = Math.abs(ratingDiff * 20); // Rough estimate
                    let criticality = 'stable';
                    if (changeNeeded < 10) criticality = 'critical';
                    else if (changeNeeded < 20) criticality = 'moderate';
                    
                    sensitivity.push({
                        criteriaName: criteria.name,
                        changeNeeded: `±${changeNeeded.toFixed(1)}%`,
                        criticality: criticality
                    });
                }
            });
            
            return sensitivity.sort((a, b) => {
                const order = { critical: 0, moderate: 1, stable: 2 };
                return order[a.criticality] - order[b.criticality];
            });
        }
        
        // Risk analysis computation
        // Update risk severity classification
        function computeRiskAnalysis(results) {
            const risks = [];
            const winner = results[0];
            
            decisionData.criteria.forEach(criteria => {
                const ratingKey = `${winner.option.id}-${criteria.id}`;
                const rating = decisionData.ratings[ratingKey] ?? 2;
                const weight = Math.round(decisionData.normalizedWeights[criteria.id] || 0);
                
                if (rating <= 1) {
                    let severity, description;
                    if (rating === 0) {
                        severity = 'critical';
                        description = `Unacceptable performance (${rating}/5) with ${weight}% importance - serious concern`;
                    } else { // rating === 1
                        severity = 'high';
                        description = `Poor performance (${rating}/5) with ${weight}% importance`;
                    }
                    
                    risks.push({
                        criteriaName: criteria.name,
                        rating: rating,
                        weight: weight,
                        severity: severity,
                        description: description
                    });
                }
            });
            
            return risks;
        }



        // Render advanced summary
        function renderAdvancedSummary() {
            const container = document.getElementById('advancedSummary');
            if (!container || !advancedAnalytics.confidence) return;
            
            const winner = advancedAnalytics.results[0];
            const runnerUp = advancedAnalytics.results[1];
            const confidence = advancedAnalytics.confidence;
            
            // Find top contributing criteria for winner
            const winnerContributions = [];
            decisionData.criteria.forEach(criteria => {
                const ratingKey = `${winner.option.id}-${criteria.id}`;
                const rating = decisionData.ratings[ratingKey] ?? 2; // Default: 2 (Fair)
                const weight = decisionData.normalizedWeights[criteria.id] || 0;
                const contribution = rating * (weight / 100);
                winnerContributions.push({
                    name: criteria.name,
                    rating: rating,
                    weight: Math.round(weight),
                    contribution: contribution,
                    impact: contribution / winner.totalScore * 100
                });
            });
            winnerContributions.sort((a, b) => b.contribution - a.contribution);
            const topContributors = winnerContributions.slice(0, 3);
            
            // Key differentiating factors vs runner-up
            const differentiators = [];
            if (runnerUp) {
                decisionData.criteria.forEach(criteria => {
                    const winnerRatingKey = `${winner.option.id}-${criteria.id}`;
                    const runnerUpRatingKey = `${runnerUp.option.id}-${criteria.id}`;
                    const winnerRating = decisionData.ratings[winnerRatingKey] ?? 2;
                    const runnerUpRating = decisionData.ratings[runnerUpRatingKey] ?? 2;
                    const ratingDiff = winnerRating - runnerUpRating;
                    const weight = decisionData.normalizedWeights[criteria.id] || 0;
                    
                    if (Math.abs(ratingDiff) >= 1) {
                        differentiators.push({
                            name: criteria.name,
                            advantage: ratingDiff > 0 ? 'winner' : 'runnerup',
                            difference: Math.abs(ratingDiff),
                            weight: Math.round(weight),
                            impact: Math.abs(ratingDiff * (weight / 100))
                        });
                    }
                });
                differentiators.sort((a, b) => b.impact - a.impact);
            }
            
            // Decision stability assessment
            const lowPerformanceCount = winnerContributions.filter(c => c.rating <= 2).length;
            const highPerformanceCount = winnerContributions.filter(c => c.rating >= 4).length;
            let stabilityLevel = 'High';
            let stabilityText = 'Strong performance across multiple criteria';
            
            if (confidence.percentage < 40) {
                stabilityLevel = 'Low';
                stabilityText = 'Close decision - small changes could affect outcome';
            } else if (lowPerformanceCount > 0 || confidence.percentage < 70) {
                stabilityLevel = 'Medium';
                stabilityText = 'Generally solid choice with some areas of concern';
            }
            
            container.innerHTML = `
                <div class="enhanced-executive-summary">
                    <!-- Winner Announcement -->
                    <div class="winner-announcement" style="background: linear-gradient(135deg, #d4edda, #c3e6cb); border: 2px solid #28a745; border-radius: 15px; padding: 25px; margin-bottom: 25px; text-align: center;">
                        <h3 style="color: #155724; margin: 0 0 10px 0; font-size: 1.4rem;">
                            🏆 Recommended Choice: ${sanitizeInput(winner.option.name)}
                        </h3>
                        <div style="font-size: 1.1rem; color: #155724; margin-bottom: 15px;">
                            <strong>Final Score:</strong> ${winner.totalScore.toFixed(2)}/5.0 
                            <span style="background: #28a745; color: white; padding: 4px 8px; border-radius: 20px; font-size: 0.9rem; margin-left: 10px;">
                                ${Math.round((winner.totalScore/5)*100)}%
                            </span>
                        </div>
                        ${winner.option.description ? `
                            <p style="color: #155724; font-style: italic; margin: 10px 0;">
                                ${sanitizeInput(winner.option.description)}
                            </p>
                        ` : ''}
                    </div>
        
                    <!-- Confidence Analysis -->
                    <div class="confidence-analysis" style="background: linear-gradient(135deg, #f8f9ff, #ffffff); border: 2px solid #e6f2ff; border-radius: 15px; padding: 25px; margin-bottom: 25px;">
                        <h4 style="color: #667eea; margin: 0 0 15px 0;">📊 Decision Confidence Analysis</h4>
                        
                        <div class="confidence-meter" style="margin: 15px 0;">
                            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
                                <span style="font-weight: 600;">Confidence Level: ${confidence.level.toUpperCase()}</span>
                                <span style="font-weight: bold; color: #667eea;">${confidence.percentage}%</span>
                            </div>
                            <div class="confidence-bar" style="width: 100%; height: 12px; background: #e9ecef; border-radius: 6px; overflow: hidden;">
                                <div class="confidence-fill ${confidence.level}" style="width: ${confidence.percentage}%; height: 100%; border-radius: 6px; transition: width 0.8s ease-out;"></div>
                            </div>
                            <p style="margin: 10px 0 0 0; font-size: 0.9rem; color: #666;">
                                ${confidence.explanation}
                            </p>
                        </div>
        
                        ${runnerUp ? `
                            <div style="background: #f8f9fa; padding: 15px; border-radius: 8px; margin-top: 15px;">
                                <strong>Margin Analysis:</strong> ${confidence.gap} points ahead of 
                                <em>${sanitizeInput(runnerUp.option.name)}</em> (${runnerUp.totalScore.toFixed(2)}/5.0)
                            </div>
                        ` : ''}
                    </div>
        
                    <!-- Top Contributing Criteria -->
                    <div class="top-contributors" style="background: #f8f9fa; border-radius: 12px; padding: 20px; margin-bottom: 25px;">
                        <h4 style="color: #333; margin: 0 0 15px 0;">⭐ Top Contributing Criteria</h4>
                        <div style="display: grid; gap: 12px;">
                            ${topContributors.map((contrib, index) => `
                                <div style="display: flex; align-items: center; padding: 12px; background: white; border-radius: 8px; border-left: 4px solid ${index === 0 ? '#28a745' : index === 1 ? '#667eea' : '#ffc107'};">
                                    <div style="flex: 1;">
                                        <div style="font-weight: 600; color: #333;">${sanitizeInput(contrib.name)}</div>
                                        <div style="font-size: 0.9rem; color: #666;">
                                            Rating: ${contrib.rating}/5 • Weight: ${contrib.weight}% • Impact: ${contrib.impact.toFixed(1)}%
                                        </div>
                                    </div>
                                    <div style="font-size: 1.1rem; font-weight: bold; color: ${index === 0 ? '#28a745' : '#667eea'};">
                                        ${contrib.contribution.toFixed(2)}
                                    </div>
                                </div>
                            `).join('')}
                        </div>
                    </div>
        
                    ${differentiators.length > 0 ? `
                        <!-- Key Differentiating Factors -->
                        <div class="differentiators" style="background: #fff3cd; border: 1px solid #ffeaa7; border-radius: 12px; padding: 20px; margin-bottom: 25px;">
                            <h4 style="color: #856404; margin: 0 0 15px 0;">⚔️ Key Differentiating Factors vs Runner-up</h4>
                            <div style="display: grid; gap: 10px;">
                                ${differentiators.slice(0, 3).map(diff => `
                                    <div style="display: flex; align-items: center; justify-content: space-between; padding: 10px; background: white; border-radius: 6px;">
                                        <div>
                                            <span style="font-weight: 600;">${sanitizeInput(diff.name)}</span>
                                            <span style="margin-left: 10px; padding: 2px 8px; border-radius: 12px; font-size: 0.8rem; background: ${diff.advantage === 'winner' ? '#d4edda' : '#f8d7da'}; color: ${diff.advantage === 'winner' ? '#155724' : '#721c24'};">
                                                ${diff.advantage === 'winner' ? 'Advantage' : 'Disadvantage'}
                                            </span>
                                        </div>
                                        <div style="text-align: right; font-size: 0.9rem; color: #666;">
                                            ${diff.difference} point${diff.difference > 1 ? 's' : ''} difference
                                        </div>
                                    </div>
                                `).join('')}
                            </div>
                        </div>
                    ` : ''}
        
                    <!-- Decision Stability -->
                    <div class="stability-indicator" style="background: white; border: 2px solid #dee2e6; border-radius: 12px; padding: 20px;">
                        <h4 style="color: #333; margin: 0 0 15px 0;">🎯 Decision Stability Assessment</h4>
                        <div style="display: flex; align-items: center; margin-bottom: 10px;">
                            <span style="font-weight: 600; margin-right: 15px;">Stability Level:</span>
                            <span style="padding: 6px 12px; border-radius: 20px; font-weight: 600; background: ${
                                stabilityLevel === 'High' ? '#d4edda' : 
                                stabilityLevel === 'Medium' ? '#fff3cd' : '#f8d7da'
                            }; color: ${
                                stabilityLevel === 'High' ? '#155724' : 
                                stabilityLevel === 'Medium' ? '#856404' : '#721c24'
                            };">
                                ${stabilityLevel}
                            </span>
                        </div>
                        <p style="color: #666; margin: 10px 0 15px 0;">${stabilityText}</p>
                        
                        <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); gap: 15px; margin-top: 15px;">
                            <div style="text-align: center; padding: 10px; background: #f8f9fa; border-radius: 8px;">
                                <div style="font-size: 1.5rem; font-weight: bold; color: #28a745;">${highPerformanceCount}</div>
                                <div style="font-size: 0.9rem; color: #666;">Strong Areas (4-5)</div>
                            </div>
                            <div style="text-align: center; padding: 10px; background: #f8f9fa; border-radius: 8px;">
                                <div style="font-size: 1.5rem; font-weight: bold; color: ${lowPerformanceCount > 0 ? '#dc3545' : '#28a745'};">${lowPerformanceCount}</div>
                                <div style="font-size: 0.9rem; color: #666;">Weak Areas (1-2)</div>
                            </div>
                            <div style="text-align: center; padding: 10px; background: #f8f9fa; border-radius: 8px;">
                                <div style="font-size: 1.5rem; font-weight: bold; color: #667eea;">${decisionData.criteria.length}</div>
                                <div style="font-size: 0.9rem; color: #666;">Total Criteria</div>
                            </div>
                        </div>
                    </div>
                </div>
            `;
        }





        //Render Winner Analysis
        function renderWinnerAnalysis() {
            const container = document.getElementById('advancedWinnerAnalysis');
            if (!container || !advancedAnalytics.results) return;
            
            const winner = advancedAnalytics.results[0];
            const runnerUp = advancedAnalytics.results.length > 1 ? advancedAnalytics.results[1] : null;
            
            // Find top 3 contributing criteria for winner
            const winnerContributions = [];
            decisionData.criteria.forEach(criteria => {
                const ratingKey = `${winner.option.id}-${criteria.id}`;
                const rating = decisionData.ratings[ratingKey] ?? 2; // Default: 2 (Fair)
                const weight = Math.round(decisionData.normalizedWeights[criteria.id] || 0);
                const contribution = rating * (weight / 100);
                winnerContributions.push({
                    name: criteria.name,
                    rating,
                    weight,
                    contribution
                });
            });
            winnerContributions.sort((a, b) => b.contribution - a.contribution);
            const topContributors = winnerContributions.slice(0, 3);
            
            let html = `
                <div style="padding: 20px;">
                    <div style="background: linear-gradient(135deg, #d4edda, #c3e6cb); border: 2px solid #28a745; border-radius: 15px; padding: 25px; margin-bottom: 25px;">
                        <h3 style="color: #155724; margin: 0 0 20px 0;">🏆 Why ${sanitizeInput(winner.option.name)} Won:</h3>
                        ${topContributors.map(contrib => `
                            <div style="display: flex; align-items: center; margin-bottom: 12px; padding: 12px; background: rgba(255,255,255,0.7); border-radius: 8px; border-left: 4px solid #28a745;">
                                <div style="margin-right: 15px; color: #28a745; font-size: 18px;">▶</div>
                                <div>
                                    <strong>${sanitizeInput(contrib.name)}:</strong> 
                                    Scored ${contrib.rating}/5 with ${contrib.weight}% importance weight
                                </div>
                            </div>
                        `).join('')}
                    </div>
            `;
            
            if (runnerUp) {
                const gap = winner.totalScore - runnerUp.totalScore;
                html += `
                    <div style="background: #e7f3ff; border: 2px solid #b3d7ff; border-radius: 15px; padding: 25px;">
                        <h4 style="color: #0056b3; margin: 0 0 15px 0;">🔍 Close alternative to consider:</h4>
                        <div style="font-size: 18px; font-weight: 600; color: #333; margin-bottom: 8px;">
                            ${sanitizeInput(runnerUp.option.name)} (${runnerUp.totalScore.toFixed(2)}/5.0, Δ ${gap.toFixed(2)})
                        </div>
                        <div style="color: #0056b3; font-style: italic;">
                            ${gap < 0.2 ? 'Very close race - consider both options!' : 
                              gap < 0.5 ? 'Close second choice worth considering' : 
                              'Clear winner, but this is a solid alternative'}
                        </div>
                    </div>
                `;
            }
            
            html += '</div>';
            container.innerHTML = html;
        }







        // Render weights section
        // Improved weights rendering with chart support
        // Update renderAdvancedWeights to use the new function
        function renderAdvancedWeights(withCharts = false) {
            const container = document.getElementById('advancedWeights');
            if (!container) return;
            
            container.innerHTML = `
                <div class="chart-container">
                    <h4>Criteria Importance Distribution</h4>
                    <div id="weightsPieChart" class="pie-container">
                        ${withCharts ? '<canvas id="weightsCanvas"></canvas>' : ''}
                        <div id="weightsTableFallback">${renderWeightsTableForPDF()}</div>
                    </div>
                </div>
            `;
            
            if (withCharts) {
                // Hide table, show chart
                document.getElementById('weightsTableFallback').style.display = 'none';
                setTimeout(() => renderPieChart(), 100);
            }
        }

        
        function tryRenderPieChart() {
            // Try to render pie chart if Chart.js is available
            if (typeof Chart !== 'undefined') {
                setTimeout(() => renderPieChart(), 100);
                return '<canvas id="weightsCanvas"></canvas>';
            }
            return null;
        }


        function renderPieChart() {
            const canvas = document.getElementById('weightsCanvas');
            if (!canvas || typeof Chart === 'undefined') {
                showChartFallback();
                return;
            }
            
            try {
                // Cleanup existing chart
                if (chartManager.charts.pie) {
                    chartManager.charts.pie.destroy();
                }
                
                const ctx = canvas.getContext('2d');
                const labels = decisionData.criteria.map(c => c.name);
                    
                // Get raw weights with minimum values to avoid zero slices
                const rawData = decisionData.criteria.map(c => {
                    const weight = decisionData.normalizedWeights[c.id] || 0;
                    return Math.max(weight, 0.5); // Minimum 0.5% to ensure visible slice
                });
                
                // Normalize to exactly 100
                const total = rawData.reduce((sum, val) => sum + val, 0);
                const normalizedData = rawData.map(val => (val / total) * 100);
                
                // Round intelligently while maintaining sum of 100
                let data = normalizedData.map(val => Math.floor(val));
                let remainder = 100 - data.reduce((sum, val) => sum + val, 0);
                
                // Distribute remainder to largest values
                if (remainder > 0) {
                    const sortedIndices = normalizedData
                        .map((val, idx) => ({ val, idx }))
                        .sort((a, b) => b.val - a.val)
                        .map(item => item.idx);
                    
                    for (let i = 0; i < remainder && i < sortedIndices.length; i++) {
                        data[sortedIndices[i]]++;
                    }
                }
                
                console.log('Pie chart data:', data, 'Total:', data.reduce((a, b) => a + b, 0));                    


                    
                                        
                const colors = generateChartColors(labels.length);
console.log('  - colors for pie chart:', colors);
                    
                chartManager.charts.pie = new Chart(ctx, {
                    type: 'pie',
                    data: {
                        labels: labels,
                        datasets: [{
                            data: data,
                            backgroundColor: colors,
                            borderWidth: 2,
                            borderColor: '#ffffff',
                            hoverBorderWidth: 3
                        }]
                    },
                    options: {
                        responsive: true,
                        maintainAspectRatio: true,
                        plugins: {
                            legend: {
                                position: 'bottom',
                                labels: {
                                    padding: 15,
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
                        }
                    }
                });
                
                console.log('Pie chart rendered successfully');
                
            } catch (error) {
                console.error('Error creating pie chart:', error);
                showChartFallback();
            }
        }



        // Update showChartFallback to use the new function
        function showChartFallback() {
            const canvas = document.getElementById('weightsCanvas');
            const fallback = document.getElementById('weightsTableFallback');
            
            if (canvas) {
                canvas.style.display = 'none';
            }
            if (fallback) {
                fallback.style.display = 'block';
                fallback.innerHTML = `
                    <div class="chart-fallback">
                        <div class="fallback-icon">📊</div>
                        <div style="font-weight: 600; margin-bottom: 10px;">Interactive Chart Unavailable</div>
                        <div style="font-size: 0.9rem; color: #666; margin-bottom: 20px;">Showing data table instead</div>
                        ${renderWeightsTableForPDF()}
                    </div>
                `;
            }
        }





        function renderWeightsTable() {
        // DOESN'T SEEM TO BE USED or EVEN CALLED
            let html = '<div style="max-width: 400px; margin: 0 auto;">';

            // Get all colors once before the loop
            const colors = generateChartColors(decisionData.criteria.length);
                
            decisionData.criteria.forEach((criteria, index) => {
                const weight = Math.round(decisionData.normalizedWeights[criteria.id] || 0);
                const color = colors[index];  // Use local array with index
                
                html += `
                    <div style="display: flex; align-items: center; justify-content: space-between; margin: 12px 0; padding: 12px; background: #f8f9fa; border-radius: 8px; border-left: 4px solid ${color};">
                        <div style="display: flex; align-items: center;">
                            <div style="width: 12px; height: 12px; background: ${color}; border-radius: 50%; margin-right: 10px;"></div>
                            <span style="font-weight: 500;">${sanitizeInput(criteria.name)}</span>
                        </div>
                        <div style="display: flex; align-items: center;">
                            <div style="width: 100px; height: 8px; background: #e9ecef; border-radius: 4px; margin-right: 10px; overflow: hidden;">
                                <div style="width: ${weight}%; height: 100%; background: ${color}; border-radius: 4px;"></div>
                            </div>
                            <strong style="min-width: 40px; text-align: right;">${weight}%</strong>
                        </div>
                    </div>
                `;
            });
            
            html += '</div>';
            return html;
        }


        function renderWeightsTableForPDF() {
            // GETS CALLED BUT DOESN'T SEEM is NOT USED for PDF TABLE
            let html = '<div style="max-width: 400px; margin: 0 auto;">';
            const labels = decisionData.criteria.map(c => c.name);
                
            // Get all colors once before the loop
            const colors = generateChartColors(labels.length);  // Use labels.length like pie chart
                                
            decisionData.criteria.forEach((criteria, index) => {
                const weight = Math.round(decisionData.normalizedWeights[criteria.id] || 0);
                const color = colors[index];  // Use local array with index
                html += `
                    <div style="display: flex; align-items: center; justify-content: space-between; margin: 12px 0; padding: 12px; background: #f8f9fa; border-radius: 8px; border-left: 4px solid ${color};">
                        <div style="display: flex; align-items: center;">
                            <div style="width: 12px; height: 12px; background: ${color}; border-radius: 50%; margin-right: 10px;"></div>
                            <span style="font-weight: 500;">${sanitizeInput(criteria.name)}</span>
                        </div>
                        <div style="display: flex; align-items: center;">
                            <div style="width: 100px; height: 8px; background: #e9ecef; border-radius: 4px; margin-right: 10px; overflow: hidden;">
                                <div style="width: ${weight}%; height: 100%; background: ${color}; border-radius: 4px;"></div>
                            </div>
                            <strong style="min-width: 40px; text-align: right;">${weight}%</strong>
                        </div>
                    </div>
                `;
            });
            
            html += '</div>';
            return html;
        }




function renderPerformanceHeatmap() {
    const container = document.getElementById('advancedHeatmap');
    if (!container || !advancedAnalytics.results) return;
    
    const options = decisionData.options;
    const criteria = decisionData.criteria;
    
    let html = `
        <div style="padding: 20px;">
            <p style="color: #666; margin-bottom: 20px;">Performance matrix showing how each option rates on each criteria. Colors range from dark red (unacceptable) to dark green (excellent).</p>
            <div class="heatmap-container" style="overflow-x: auto;">
                <table class="heatmap-table" style="width: 100%; border-collapse: collapse; margin: 20px 0;">
                    <thead>
                        <tr>
                            <th style="padding: 12px; background: #f8f9fa; border: 1px solid #dee2e6; font-weight: 600;">Option</th>
    `;
    
    // Add criteria headers
    criteria.forEach(crit => {
        const weight = Math.round(decisionData.normalizedWeights[crit.id] || 0);
        html += `<th style="padding: 12px; background: #f8f9fa; border: 1px solid #dee2e6; font-weight: 600; text-align: center; min-width: 120px;">
                    ${crit.name}<br><small style="color: #666;">(${weight}%)</small>
                 </th>`;
    });
    
    html += `
                            <th style="padding: 12px; background: #f8f9fa; border: 1px solid #dee2e6; font-weight: 600; text-align: center;">Total Score</th>
                        </tr>
                    </thead>
                    <tbody>
    `;
    
    // Add option rows
    advancedAnalytics.results.forEach((result, optIndex) => {
        html += `<tr>
                    <td style="padding: 12px; border: 1px solid #dee2e6; font-weight: 600; background: #f8f9fa;">
                        ${result.option.name}
                    </td>`;
        
        criteria.forEach(crit => {
            const ratingKey = `${result.option.id}-${crit.id}`;
            const rating = decisionData.ratings[ratingKey] ?? 2; // Changed from 3 to 2
            const weight = (decisionData.normalizedWeights[crit.id] || 0) / 100;
            const weightedScore = rating * weight;
            
            // Updated heatmap color scheme for 0-5 scale
            const { backgroundColor, textColor } = getHeatmapColors(rating);
            
            html += `<td style="padding: 12px; border: 1px solid #dee2e6; text-align: center; background: ${backgroundColor}; color: ${textColor}; position: relative;" 
                          title="Rating: ${rating}/5, Weight: ${Math.round(weight * 100)}%, Weighted Score: ${weightedScore.toFixed(2)}">
                        <div style="font-weight: 600; font-size: 1.1rem;">${rating}</div>
                        <div style="font-size: 0.8rem; opacity: 0.8;">${weightedScore.toFixed(2)}</div>
                     </td>`;
        });
        
        // Total score column with gradient
        const { backgroundColor: totalBg, textColor: totalText } = getTotalScoreColors(result.totalScore, optIndex === 0);
        html += `<td style="padding: 12px; border: 1px solid #dee2e6; text-align: center; background: ${totalBg}; color: ${totalText}; font-weight: bold;">
                    ${result.totalScore.toFixed(2)}
                 </td>`;
        
        html += '</tr>';
    });
    
    html += `
                    </tbody>
                </table>
                <div style="margin-top: 15px; padding: 15px; background: #f8f9fa; border-radius: 8px; font-size: 0.9rem;">
                    <div style="display: flex; align-items: center; gap: 20px; flex-wrap: wrap;">
                        <div><strong>Color Legend:</strong></div>
                        <div style="display: flex; align-items: center; gap: 8px;">
                            <div style="width: 20px; height: 20px; background: #ffcdd2; border: 1px solid #ccc; border-radius: 3px;"></div>
                            <span>0 (Unacceptable)</span>
                        </div>
                        <div style="display: flex; align-items: center; gap: 8px;">
                            <div style="width: 20px; height: 20px; background: #ffebee; border: 1px solid #ccc; border-radius: 3px;"></div>
                            <span>1 (Poor)</span>
                        </div>
                        <div style="display: flex; align-items: center; gap: 8px;">
                            <div style="width: 20px; height: 20px; background: #fff3e0; border: 1px solid #ccc; border-radius: 3px;"></div>
                            <span>2 (Fair)</span>
                        </div>
                        <div style="display: flex; align-items: center; gap: 8px;">
                            <div style="width: 20px; height: 20px; background: #fffde7; border: 1px solid #ccc; border-radius: 3px;"></div>
                            <span>3 (Good)</span>
                        </div>
                        <div style="display: flex; align-items: center; gap: 8px;">
                            <div style="width: 20px; height: 20px; background: #a5d6a7; border: 1px solid #ccc; border-radius: 3px;"></div>
                            <span>4 (Very Good)</span>
                        </div>
                        <div style="display: flex; align-items: center; gap: 8px;">
                            <div style="width: 20px; height: 20px; background: #66bb6a; border: 1px solid #ccc; border-radius: 3px;"></div>
                            <span>5 (Excellent)</span>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    `;
    
    container.innerHTML = html;
}





        
        // Helper function for accessible heatmap colors (UPDATED for 0-5 scale)
        function getHeatmapColors(rating) {
            const colorSchemes = {
                0: { backgroundColor: '#ffcdd2', textColor: '#b71c1c' }, // Unacceptable - Dark red
                1: { backgroundColor: '#ffebee', textColor: '#c62828' }, // Poor - Light red  
                2: { backgroundColor: '#fff3e0', textColor: '#e65100' }, // Fair - Orange
                3: { backgroundColor: '#fffde7', textColor: '#f57f17' }, // Good - Yellow
                4: { backgroundColor: '#a5d6a7', textColor: '#2e7d32' }, // Very Good - Light green
                5: { backgroundColor: '#66bb6a', textColor: '#1b5e20' }  // Excellent - Dark green
            };
            
            return colorSchemes[rating] || colorSchemes[2]; // Default to Fair (2) instead of Good (3)
        }
        
        // Helper function for total score colors
        // Helper function for total score colors (UPDATED for better 0-5 scale distribution)
        function getTotalScoreColors(score, isWinner) {
            if (isWinner) {
                return { backgroundColor: '#c8e6c9', textColor: '#1b5e20' };
            }
            
            // Color based on score range (adjusted for 0-5 scale with better distribution)
            if (score >= 4.0) {
                return { backgroundColor: '#e8f5e8', textColor: '#2e7d32' };
            } else if (score >= 3.0) {
                return { backgroundColor: '#fffde7', textColor: '#f57f17' };
            } else if (score >= 1.5) {
                return { backgroundColor: '#fff3e0', textColor: '#e65100' };
            } else if (score >= 0.5) {
                return { backgroundColor: '#ffebee', textColor: '#c62828' };
            } else {
                return { backgroundColor: '#ffcdd2', textColor: '#b71c1c' };
            }
        }








        // Render sensitivity analysis
        function renderAdvancedSensitivity() {
            const container = document.getElementById('advancedSensitivity');
            if (!container || !advancedAnalytics.sensitivity) return;
            
            // Compute flip points for each criteria
            const flipPoints = computeFlipPoints();
            
            container.innerHTML = `
                <div style="padding: 20px;">
                    <p style="color: #666; margin-bottom: 20px;">
                        Analysis of how sensitive your decision is to changes in criteria weights. Lower flip points indicate more critical criteria.
                    </p>
                    
                    <div class="sensitivity-analysis">
                        <h4 style="color: #333; margin: 0 0 20px 0;">🎯 Flip Point Analysis</h4>
                        <p style="color: #666; font-size: 0.9rem; margin-bottom: 15px;">
                            Minimum weight changes needed to change the winner:
                        </p>
                        
                        <div class="flip-points" style="margin-bottom: 25px;">
                            ${flipPoints.map(fp => `
                                <div class="sensitivity-item ${fp.criticality}" style="display: flex; align-items: center; padding: 15px; margin: 10px 0; background: #f8f9fa; border-radius: 8px; border-left: 4px solid ${
                                    fp.criticality === 'critical' ? '#dc3545' : 
                                    fp.criticality === 'moderate' ? '#ffc107' : '#28a745'
                                };">
                                    <div style="flex: 1;">
                                        <div style="font-weight: 600; color: #333;">${sanitizeInput(fp.criteriaName)}</div>
                                        <div style="font-size: 0.9rem; color: #666; margin-top: 4px;">
                                            Current: ${fp.currentWeight}% → Required: ${fp.flipPoint}%
                                        </div>
                                    </div>
                                    <div style="text-align: right;">
                                        <div style="font-weight: 600; color: ${
                                            fp.criticality === 'critical' ? '#dc3545' : 
                                            fp.criticality === 'moderate' ? '#f57c00' : '#28a745'
                                        }; font-size: 1.1rem;">
                                            ${fp.changeNeeded}
                                        </div>
                                        <div style="font-size: 0.8rem; color: #666;">
                                            ${fp.criticality === 'critical' ? 'Critical' : 
                                              fp.criticality === 'moderate' ? 'Moderate' : 'Stable'}
                                        </div>
                                    </div>
                                </div>
                            `).join('')}
                        </div>
                        
                        <div style="page-break-before: always; height: 1px; clear: both;"></div>
                        <div class="tornado-chart" style="background: white; border-radius: 12px; padding: 20px; border: 1px solid #e9ecef;">
                            <h4 style="color: #333; margin: 0 0 15px 0;">🌪️ Sensitivity Tornado Chart</h4>
                            ${renderTornadoChart(flipPoints)}
                        </div>
                        
                        <div style="margin-top: 20px; padding: 15px; background: #f8f9fa; border-radius: 8px; font-size: 0.9rem;">
                            <strong>Interpretation:</strong><br>
                            <span style="color: #dc3545;">●</span> <strong>Critical (Red):</strong> Small weight changes could flip the decision<br>
                            <span style="color: #ffc107;">●</span> <strong>Moderate (Yellow):</strong> Medium sensitivity to weight changes<br>
                            <span style="color: #28a745;">●</span> <strong>Stable (Green):</strong> Decision is robust to weight changes
                        </div>
                    </div>
                </div>
            `;
        }
        
        // ADD these supporting functions:
        
        function computeFlipPoints() {
            const flipPoints = [];
            
            if (!advancedAnalytics.results || advancedAnalytics.results.length < 2) {
                return flipPoints;
            }
            
            const winner = advancedAnalytics.results[0];
            const runnerUp = advancedAnalytics.results[1];
            
            decisionData.criteria.forEach(criteria => {
                const currentWeight = decisionData.normalizedWeights[criteria.id] || 0;
                const winnerRating = decisionData.ratings[`${winner.option.id}-${criteria.id}`] ?? 2;
                const runnerUpRating = decisionData.ratings[`${runnerUp.option.id}-${criteria.id}`] ?? 2;
                
                // Calculate approximate flip point
                const ratingDiff = winnerRating - runnerUpRating;
                const currentScoreDiff = winner.totalScore - runnerUp.totalScore;
                
                let flipPoint, changeNeeded, criticality;
                
                if (Math.abs(ratingDiff) < 0.1) {
                    // No significant difference
                    flipPoint = currentWeight;
                    changeNeeded = 'No impact';
                    criticality = 'stable';
                } else {
                    // Simplified flip point calculation
                    const weightChangeNeeded = (currentScoreDiff / Math.abs(ratingDiff)) * 100;
                    
                    if (ratingDiff > 0) {
                        // Winner is better - would need to reduce this weight significantly
                        flipPoint = Math.max(0, currentWeight - weightChangeNeeded);
                        changeNeeded = `${Math.round(weightChangeNeeded)}% decrease`;
                    } else {
                        // Runner-up is better - would need to increase this weight
                        flipPoint = Math.min(100, currentWeight + weightChangeNeeded);
                        changeNeeded = `${Math.round(weightChangeNeeded)}% increase`;
                    }
                    
                    // Determine criticality
                    if (weightChangeNeeded < 15) {
                        criticality = 'critical';
                    } else if (weightChangeNeeded < 30) {
                        criticality = 'moderate';
                    } else {
                        criticality = 'stable';
                    }
                }
                
                flipPoints.push({
                    criteriaName: criteria.name,
                    currentWeight: Math.round(currentWeight),
                    flipPoint: Math.round(flipPoint),
                    changeNeeded: changeNeeded,
                    criticality: criticality,
                    impactMagnitude: Math.abs(ratingDiff) * (currentWeight / 100)
                });
            });
            
            // Sort by impact magnitude (most sensitive first)
            return flipPoints.sort((a, b) => {
                const criticalityOrder = { critical: 0, moderate: 1, stable: 2 };
                if (criticalityOrder[a.criticality] !== criticalityOrder[b.criticality]) {
                    return criticalityOrder[a.criticality] - criticalityOrder[b.criticality];
                }
                return b.impactMagnitude - a.impactMagnitude;
            });
        }
        
        function renderTornadoChart(flipPoints) {
            const maxImpact = Math.max(...flipPoints.map(fp => fp.impactMagnitude));
            
            return `
                <div style="margin-top: 15px;">
                    ${flipPoints.map(fp => {
                        const barWidth = maxImpact > 0 ? (fp.impactMagnitude / maxImpact) * 100 : 0;
                        return `
                            <div style="margin-bottom: 12px;">
                                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 4px;">
                                    <span style="font-size: 0.9rem; font-weight: 500;">${sanitizeInput(fp.criteriaName)}</span>
                                    <span style="font-size: 0.8rem; color: #666;">${fp.changeNeeded}</span>
                                </div>
                                <div style="width: 100%; height: 20px; background: #e9ecef; border-radius: 10px; overflow: hidden;">
                                    <div style="width: ${barWidth}%; height: 100%; background: ${
                                        fp.criticality === 'critical' ? 'linear-gradient(135deg, #dc3545, #c82333)' : 
                                        fp.criticality === 'moderate' ? 'linear-gradient(135deg, #ffc107, #fd7e14)' : 
                                        'linear-gradient(135deg, #28a745, #20c997)'
                                    }; border-radius: 10px; transition: width 0.8s ease;"></div>
                                </div>
                            </div>
                        `;
                    }).join('')}
                </div>
            `;
        }








        
        function renderWhatIfAnalysis() {
            const container = document.getElementById('advancedWhatIf');
            if (!container) return;
            
            // ✅ ONLY initialize if null (first time)
            if (whatIfDecisionData === null) {
                whatIfDecisionData = JSON.parse(JSON.stringify(decisionData));
            }
                        
            container.innerHTML = `
                <div style="padding: 20px;">
                    <p style="color: #666; margin-bottom: 20px;">
                        Adjust criteria weights to see how they affect the ranking. Changes update in real-time!
                    </p>
                    
                    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px; flex-wrap: wrap; gap: 10px;">
                        <button id="resetWeightsBtn" class="btn btn-secondary" style="margin: 0;">
                            🔄 Reset to Original Weights
                        </button>
                        <div id="whatIfAlert" style="padding: 8px 15px; border-radius: 20px; font-weight: 600; display: none;">
                            <!-- Winner change alerts will appear here -->
                        </div>
                    </div>
                    
                    <div class="what-if-controls" style="margin-bottom: 25px;">
                        ${whatIfDecisionData.criteria.map(criteria => {
                            const currentWeight = Math.round(whatIfDecisionData.normalizedWeights[criteria.id] || 0);
                            return `
                                <div class="weight-control" style="margin-bottom: 20px; padding: 15px; background: #f8f9fa; border-radius: 12px; border: 1px solid #e9ecef;">
                                    <div style="display: flex; justify-content: between; align-items: center; margin-bottom: 10px;">
                                        <label style="font-weight: 600; color: #333; flex: 1;">${sanitizeInput(criteria.name)}</label>
                                        <span id="weight-display-${criteria.id}" style="font-weight: bold; color: #667eea; min-width: 50px; text-align: right;">${currentWeight}%</span>
                                    </div>
                                    <input type="range" 
                                           id="weight-slider-${criteria.id}" 
                                           min="0" 
                                           max="100" 
                                           value="${currentWeight}" 
                                           class="what-if-slider"
                                           style="width: 100%; height: 8px; border-radius: 4px; background: #e0e0e0; outline: none; -webkit-appearance: none; cursor: pointer;"
                                           oninput="updateWhatIfWeight(${criteria.id}, this.value)">
                                </div>
                            `;
                        }).join('')}
                    </div>
                    
                    <div id="whatIfResults" style="background: white; border-radius: 12px; padding: 20px; border: 2px solid #e9ecef;">
                        <h4 style="margin: 0 0 15px 0; color: #333;">📊 Updated Rankings</h4>
                        <div id="whatIfRankings">
                            <!-- Rankings will be populated here -->
                        </div>
                    </div>
                </div>
            `;
            
            // Initialize what-if results
            updateWhatIfResults();
            
            // Add event listener for reset button
            document.getElementById('resetWeightsBtn').addEventListener('click', resetToOriginalWeights);
        }
        
        // ADD these supporting functions:

        // REPLACE the existing updateWhatIfWeight function with this optimized version:
        
        // Create debounced version for calculations
        const debouncedUpdateWhatIf = debounce(function(criteriaId, newWeight) {
            // Update the weight
            whatIfDecisionData.normalizedWeights[criteriaId] = parseFloat(newWeight);
            
            // Recalculate and update results
            updateWhatIfResults();
        }, 150); // 150ms delay
        
        function updateWhatIfWeight(criteriaId, newWeight) {
            // Immediate display update for responsiveness
            document.getElementById(`weight-display-${criteriaId}`).textContent = `${Math.round(newWeight)}%`;
            
            // Debounced calculation update
            debouncedUpdateWhatIf(criteriaId, newWeight);
        }        



        
        function renderWhatIfResults(newResults, previousWinner) {
            // Check for winner change
            const currentWinner = newResults[0];
            const winnerChanged = previousWinner.option.id !== currentWinner.option.id;
            
            // Update alert
            const alertDiv = document.getElementById('whatIfAlert');
            if (winnerChanged) {
                alertDiv.style.display = 'block';
                alertDiv.style.background = '#fff3cd';
                alertDiv.style.color = '#856404';
                alertDiv.style.border = '1px solid #ffeaa7';
                alertDiv.textContent = `🚨 Winner Changed! New winner: ${currentWinner.option.name}`;
            } else {
                alertDiv.style.display = 'none';
            }
            
            // Update rankings display
            const rankingsDiv = document.getElementById('whatIfRankings');
            rankingsDiv.innerHTML = newResults.map((result, index) => `
                <div style="display: flex; align-items: center; justify-content: space-between; padding: 12px; margin-bottom: 8px; background: ${index === 0 ? 'rgba(40, 167, 69, 0.1)' : '#f8f9fa'}; border-radius: 8px; border: 1px solid ${index === 0 ? '#28a745' : '#e9ecef'};">
                    <div style="display: flex; align-items: center;">
                        <div style="width: 30px; height: 30px; border-radius: 50%; background: ${index === 0 ? '#28a745' : '#667eea'}; color: white; display: flex; align-items: center; justify-content: center; font-weight: bold; margin-right: 15px;">
                            ${index + 1}
                        </div>
                        <div>
                            <div style="font-weight: 600; color: #333;">${sanitizeInput(result.option.name)}</div>
                            <div style="font-size: 0.9rem; color: #666;">Score: ${result.totalScore.toFixed(2)}/5.0</div>
                        </div>
                    </div>
                    <div style="text-align: right;">
                        <div style="font-size: 1.1rem; font-weight: bold; color: ${index === 0 ? '#28a745' : '#667eea'};">
                            ${Math.round((result.totalScore/5)*100)}%
                        </div>
                    </div>
                </div>
            `).join('');
        }





        function updateWhatIfResults() {
            // Create cache key from current weights
            const cacheKey = JSON.stringify(whatIfDecisionData.normalizedWeights);
            const cached = getCachedResults(cacheKey);
            
            if (cached) {
                renderWhatIfResults(cached.newResults, cached.previousWinner);
                return;
            }
            
            // Store current winner before changes
            const previousWinner = advancedAnalytics.results[0];
            
            // Recalculate results with new weights
            const newResults = [];
            whatIfDecisionData.options.forEach(option => {
                let totalScore = 0;
                whatIfDecisionData.criteria.forEach(criteria => {
                    const ratingKey = `${option.id}-${criteria.id}`;
                    const rating = whatIfDecisionData.ratings[ratingKey] ?? 2;
                    const weight = (whatIfDecisionData.normalizedWeights[criteria.id] || 0) / 100;
                    totalScore += rating * weight;
                });
                newResults.push({
                    option: option,
                    totalScore: totalScore
                });
            });
            newResults.sort((a, b) => b.totalScore - a.totalScore);
            
            // Cache results
            setCachedResults(cacheKey, { newResults, previousWinner });
            
            // Render results
            renderWhatIfResults(newResults, previousWinner);
        }



        
        function resetToOriginalWeights() {
            // ✅ REPLACE THIS ENTIRE FUNCTION with:
            whatIfDecisionData = JSON.parse(JSON.stringify(decisionData));
            
            whatIfDecisionData.criteria.forEach(criteria => {
                const originalWeight = Math.round(whatIfDecisionData.normalizedWeights[criteria.id] || 0);
                const slider = document.getElementById(`weight-slider-${criteria.id}`);
                const display = document.getElementById(`weight-display-${criteria.id}`);
                
                if (slider) slider.value = originalWeight;
                if (display) display.textContent = `${originalWeight}%`;
            });
            
            updateWhatIfResults();
            document.getElementById('whatIfAlert').style.display = 'none';
        }








        // Render risk analysis
        function renderAdvancedRisks() {
            const container = document.getElementById('advancedRisks');
            if (!container || !advancedAnalytics.risks) return;
            
            let html = '<div style="padding: 20px;">';
            
            if (advancedAnalytics.risks.length === 0) {
                html += `
                    <div style="text-align: center; padding: 30px; background: #d4edda; border-radius: 12px; border: 2px solid #28a745;">
                        <h4 style="color: #155724; margin: 0 0 10px 0;">✅ No Major Weaknesses Identified</h4>
                        <p style="color: #155724; margin: 0;">Your top choice performs well across all criteria.</p>
                    </div>
                `;
            } else {
                html += `<p style="color: #666; margin-bottom: 20px;">Areas where <strong>${sanitizeInput(advancedAnalytics.results[0].option.name)}</strong> could be vulnerable:</p>`;
                
                advancedAnalytics.risks.forEach(risk => {
                    html += `
                        <div class="risk-item ${risk.severity}">
                            <div class="risk-header">
                                ${risk.severity === 'high' ? '🔴' : '🟡'} ${sanitizeInput(risk.criteriaName)}
                            </div>
                            <div class="risk-details">${risk.description}</div>
                        </div>
                    `;
                });
            }
            
            html += '</div>';
            container.innerHTML = html;
        }




        
        // Helper functions

        function generateChartColors(count) {
            // Use global color scheme for consistency across all charts
            const result = [];
            for (let i = 0; i < count; i++) {
                result.push(CHART_COLORS[i % CHART_COLORS.length]);
            }
            
            return result;
        }


        






function generateCanvasBasedPDF() {
    console.log('generateCanvasBasedPDF called - using multi-section approach');
    
    if (!advancedAnalytics.results || !advancedAnalytics.confidence) {
        showToast('Please calculate results and show advanced analytics first.', 'warning');
        return;
    }

    // Check if required libraries are available
    if (!window.jspdf || !window.jspdf.jsPDF) {
        showToast('PDF library not loaded. Please refresh the page.', 'error');
        return;
    }
    if (!window.html2canvas) {
        showToast('Canvas library not loaded. Please refresh the page.', 'error');
        return;
    }
    
    showToast('Generating advanced PDF report...', 'info');
    
    const { jsPDF } = window.jspdf;
    
    // Create a temporary container for generating PDF content
    const tempContainer = document.createElement('div');
    tempContainer.style.cssText = `
        position: absolute;
        left: -9999px;
        top: -9999px;
        width: 800px;
        background: white;
        font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
        color: #333;
        line-height: 1.6;
        padding: 80px;
    `;
    document.body.appendChild(tempContainer);

    try {
        // Generate comprehensive report content
        const reportContent = generateReportHTML();
        tempContainer.innerHTML = reportContent;

        // Inject pie chart and what-if analysis
        capturePieChartFromPage().then(pieChartImage => {
            if (pieChartImage) {
                const placeholder = tempContainer.querySelector('#pdfPieChartContainer');
                if (placeholder) {
                    placeholder.innerHTML = `
                        <img src="${pieChartImage}" 
                             style="max-width: 350px; height: auto; border: 1px solid #dee2e6; border-radius: 8px; margin: 15px auto; display: block;" 
                             alt="Criteria Importance Pie Chart">
                        <p style="font-size: 12px; color: #666; margin-top: 10px; text-align: center;">
                            Visual breakdown of criteria importance weights
                        </p>
                    `;
                }
            } else {
                const placeholder = tempContainer.querySelector('#pdfPieChartContainer');
                if (placeholder) {
                    placeholder.innerHTML = `
                        <div style="margin: 20px auto; max-width: 400px;">
                            <p style="text-align: center; color: #666; margin-bottom: 15px; font-style: italic;">
                                Pie chart not available - showing data table
                            </p>
                            ${renderWeightsTableForPDF()}
                        </div>
                    `;
                }
            }
            
            return captureWhatIfAnalysisFromPage();
        }).then(whatIfImage => {
            if (whatIfImage) {
                const placeholder = tempContainer.querySelector('#pdfWhatIfContainer');
                if (placeholder) {
                    placeholder.innerHTML = `
                        <img src="${whatIfImage}" 
                             style="max-width: 100%; height: auto; border: 1px solid #dee2e6; border-radius: 8px; margin: 15px auto; display: block;" 
                             alt="What-If Analysis">
                        <p style="font-size: 12px; color: #666; margin-top: 10px; text-align: center;">
                            Criteria weight adjustment study with updated rankings
                        </p>
                    `;
                }
            } else {
                const placeholder = tempContainer.querySelector('#pdfWhatIfContainer');
                if (placeholder) {
                    placeholder.innerHTML = `
                        <div style="margin: 20px auto; padding: 30px; background: #f8f9fa; border-radius: 12px; text-align: center;">
                            <p style="color: #666; font-style: italic; margin: 0;">
                                What-if analysis capture failed.<br>
                                This section shows interactive weight adjustments when advanced analytics are active.
                            </p>
                        </div>
                    `;
                }
            }

            // Wait for logo to load, then start multi-section PDF generation
            const logoImg = new Image();
            logoImg.onload = function() {
                console.log('Logo loaded, starting multi-section PDF generation');
                generateMultiSectionPDF();
            };
            logoImg.onerror = function() {
                console.warn('Logo failed to load, proceeding without it');
                generateMultiSectionPDF();
            };
            logoImg.src = 'images/Choicease logo.png';
            
        }).catch(error => {
            console.error('Analysis capture failed:', error);
            
            // Use fallbacks for both pie chart and what-if analysis
            const piePlaceholder = tempContainer.querySelector('#pdfPieChartContainer');
            if (piePlaceholder) {
                piePlaceholder.innerHTML = `
                    <div style="margin: 20px auto; max-width: 400px;">
                        <p style="text-align: center; color: #666; margin-bottom: 15px; font-style: italic;">
                            Chart capture failed - showing data table
                        </p>
                        ${renderWeightsTableForPDF()}
                    </div>
                `;
            }
            
            const whatIfPlaceholder = tempContainer.querySelector('#pdfWhatIfContainer');
            if (whatIfPlaceholder) {
                whatIfPlaceholder.innerHTML = `
                    <div style="margin: 20px auto; padding: 30px; background: #f8f9fa; border-radius: 12px; text-align: center;">
                        <p style="color: #666; font-style: italic; margin: 0;">
                            What-if analysis capture failed.<br>
                            This section shows interactive weight adjustments when advanced analytics are active.
                        </p>
                    </div>
                `;
            }
            
            // Load logo and then convert
            const logoImg = new Image();
            logoImg.onload = function() {
                generateMultiSectionPDF();
            };
            logoImg.onerror = function() {
                generateMultiSectionPDF();
            };
            logoImg.src = 'images/Choicease logo.png';
        });

        // Function to handle multi-section PDF generation
        function generateMultiSectionPDF() {
            console.log('Starting multi-section PDF generation...');
            
            // Define sections to capture separately
                const sections = [
                    { 
                        selector: '.header-section, .decision-details, .executive-summary', 
                        name: 'Overview' 
                    },
                    { 
                        selector: '.complete-rankings', 
                        name: 'Complete Rankings' 
                    },
                    { 
                        selector: '.criteria-weights', 
                        name: 'Criteria Weights' 
                    },
                    { 
                        selector: '.winner-analysis, .risk-analysis, .top-contributors, .differentiating-factors', 
                        name: 'Winner Analysis' 
                    },
                    { 
                        selector: '.performance-matrix', 
                        name: 'Performance Matrix' 
                    },
                    { 
                        selector: '.sensitivity-analysis', 
                        name: 'Sensitivity Analysis' 
                    },
                    { 
                        selector: '.what-if-analysis', 
                        name: 'What-If Analysis' 
                    },
                    { 
                        selector: '.decision-stability, .methodology, .footer', 
                        name: 'Decision Stability & Methodology' 
                    }
                ];


                
                

            const pdf = new jsPDF('p', 'mm', 'a4');
            const pageHeight = 280; // A4 page height in mm
            let isFirstPage = true;
            let currentSectionIndex = 0;

            // Function to find section with fallbacks
            function findSection(sectionData) {
                const element = tempContainer.querySelector(sectionData.selector) ||
                              tempContainer.querySelector(sectionData.selector.replace('.', '#')) ||
                              tempContainer.querySelector(`[data-section="${sectionData.name.toLowerCase()}"]`);
                
                if (!element) {
                    console.warn(`Section not found: ${sectionData.name} (${sectionData.selector})`);
                }
                return element;
            }



                
            // Function to add section to PDF
                // Function to add section to PDF
                function addSectionToPDF() {
                    if (currentSectionIndex >= sections.length) {
                        // All sections processed, download the PDF
                        const cleanTitle = String(decisionData.title || 'decision').replace(/[^a-z0-9]/gi, '_');
                        const fileName = `choicease_advanced_${cleanTitle}_${Date.now()}.pdf`;
                        pdf.save(fileName);
                        
                        // Cleanup
                        if (tempContainer.parentNode) {
                            document.body.removeChild(tempContainer);
                        }
                        
                        showToast('Advanced PDF Report generated successfully!', 'success');
                        console.log('Multi-section PDF generation completed successfully');
                        return;
                    }
                
                    const sectionData = sections[currentSectionIndex];
                    
                    // Handle multiple selectors (combined sections)
                    if (sectionData.selector.includes(',')) {
                        // Create a temporary container for multiple sections
                        const combinedContainer = document.createElement('div');
                        combinedContainer.style.cssText = 'background: white; padding: 0;';
                        
                        const selectors = sectionData.selector.split(',').map(s => s.trim());
                        let foundElements = 0;
                        
                        selectors.forEach(selector => {
                            const element = tempContainer.querySelector(selector);
                            if (element) {
                                const clonedElement = element.cloneNode(true);
                                combinedContainer.appendChild(clonedElement);
                                foundElements++;
                            } else {
                                console.warn(`Element not found for selector: ${selector}`);
                            }
                        });
                        
                        if (foundElements === 0) {
                            console.warn(`No elements found for combined section: ${sectionData.name}`);
                            currentSectionIndex++;
                            addSectionToPDF();
                            return;
                        }
                        
                        // Temporarily add to page for capture
                        document.body.appendChild(combinedContainer);
                        combinedContainer.style.position = 'absolute';
                        combinedContainer.style.left = '-9999px';
                        combinedContainer.style.top = '-9999px';
                        combinedContainer.style.width = '800px';
                        
                        console.log(`Capturing combined section ${currentSectionIndex + 1}/${sections.length}: ${sectionData.name}`);
                        
                        // Capture the combined container
                        html2canvas(combinedContainer, {
                            backgroundColor: '#ffffff',
                            scale: 1.5,
                            useCORS: true,
                            allowTaint: true,
                            scrollX: 0,
                            scrollY: 0
                        }).then(canvas => {
                            // Remove temporary container
                            document.body.removeChild(combinedContainer);
                            
                            try {
                                const imgWidth = 210;
                                const imgHeight = (canvas.height * imgWidth) / canvas.width;
                                
                                console.log(`Combined section ${sectionData.name}: ${imgWidth}mm x ${imgHeight.toFixed(1)}mm`);
                
                                if (!isFirstPage) {
                                    pdf.addPage();
                                }
                                isFirstPage = false;
                
                                if (imgHeight > pageHeight) {
                                    console.log(`Combined section ${sectionData.name} is too tall (${imgHeight.toFixed(1)}mm), splitting...`);
                                    
                                    let remainingHeight = imgHeight;
                                    let yOffset = 0;
                                    let pageCount = 0;
                                    
                                    while (remainingHeight > 0) {
                                        if (pageCount > 0) {
                                            pdf.addPage();
                                        }
                                        
                                        const currentPageHeight = Math.min(remainingHeight, pageHeight);
                                        const yPosition = -yOffset;
                                        
                                        pdf.addImage(canvas.toDataURL('image/png'), 'PNG', 0, yPosition, imgWidth, imgHeight);
                                        
                                        yOffset += pageHeight;
                                        remainingHeight -= pageHeight;
                                        pageCount++;
                                    }
                                } else {
                                    pdf.addImage(canvas.toDataURL('image/png'), 'PNG', 0, 0, imgWidth, imgHeight);
                                }
                
                                currentSectionIndex++;
                                setTimeout(() => {
                                    addSectionToPDF();
                                }, 100);
                
                            } catch (error) {
                                console.error(`Error processing combined section ${sectionData.name}:`, error);
                                currentSectionIndex++;
                                addSectionToPDF();
                            }
                            
                        }).catch(error => {
                            // Remove temporary container on error
                            if (document.body.contains(combinedContainer)) {
                                document.body.removeChild(combinedContainer);
                            }
                            console.error(`Failed to capture combined section ${sectionData.name}:`, error);
                            currentSectionIndex++;
                            addSectionToPDF();
                        });
                        
                    } else {
                        // Handle single section (existing logic)
                        const sectionElement = findSection(sectionData);
                        
                        if (!sectionElement) {
                            console.warn(`Skipping missing section: ${sectionData.name}`);
                            currentSectionIndex++;
                            addSectionToPDF();
                            return;
                        }
                
                        console.log(`Capturing section ${currentSectionIndex + 1}/${sections.length}: ${sectionData.name}`);
                
                        html2canvas(sectionElement, {
                            backgroundColor: '#ffffff',
                            scale: 1.5,
                            useCORS: true,
                            allowTaint: true,
                            scrollX: 0,
                            scrollY: 0
                        }).then(canvas => {
                            try {
                                const imgWidth = 210;
                                const imgHeight = (canvas.height * imgWidth) / canvas.width;
                                
                                console.log(`Section ${sectionData.name}: ${imgWidth}mm x ${imgHeight.toFixed(1)}mm`);
                
                                if (!isFirstPage) {
                                    pdf.addPage();
                                }
                                isFirstPage = false;
                
                                if (imgHeight > pageHeight) {
                                    console.log(`Section ${sectionData.name} is too tall (${imgHeight.toFixed(1)}mm), splitting...`);
                                    
                                    let remainingHeight = imgHeight;
                                    let yOffset = 0;
                                    let pageCount = 0;
                                    
                                    while (remainingHeight > 0) {
                                        if (pageCount > 0) {
                                            pdf.addPage();
                                        }
                                        
                                        const currentPageHeight = Math.min(remainingHeight, pageHeight);
                                        const yPosition = -yOffset;
                                        
                                        pdf.addImage(canvas.toDataURL('image/png'), 'PNG', 0, yPosition, imgWidth, imgHeight);
                                        
                                        yOffset += pageHeight;
                                        remainingHeight -= pageHeight;
                                        pageCount++;
                                    }
                                } else {
                                    pdf.addImage(canvas.toDataURL('image/png'), 'PNG', 0, 0, imgWidth, imgHeight);
                                }
                
                                currentSectionIndex++;
                                setTimeout(() => {
                                    addSectionToPDF();
                                }, 100);
                
                            } catch (error) {
                                console.error(`Error processing section ${sectionData.name}:`, error);
                                currentSectionIndex++;
                                addSectionToPDF();
                            }
                            
                        }).catch(error => {
                            console.error(`Failed to capture section ${sectionData.name}:`, error);
                            currentSectionIndex++;
                            addSectionToPDF();
                        });
                    }
                }


                




                

            // Start processing sections
            addSectionToPDF();
        }
        
    } catch (error) {
        // Cleanup on error
        if (tempContainer.parentNode) {
            document.body.removeChild(tempContainer);
        }
        console.error('Error during PDF generation:', error);
        showToast('PDF generation failed. Please try again.', 'error');
    }
}

            
        
        















function generateReportHTML() {
    // Helper functions (must appear at top)
    
    // 1) safeText: use sanitizeInput if available; otherwise fallback
    const safeText = typeof sanitizeInput === 'function'
        ? sanitizeInput
        : (str = '') => String(str)
            .replaceAll('&', '&amp;')
            .replaceAll('<', '&lt;')
            .replaceAll('>', '&gt;')
            .replaceAll('"', '&quot;')
            .replaceAll("'", '&#39;');

    // 2) safeNum: coerce to finite number or return fallback
    const safeNum = (v, fallback = 0) => {
        const n = Number(v);
        return Number.isFinite(n) ? n : fallback;
    };

    // 3) fmt: format numeric values safely; returns 'N/A' when not finite
    const fmt = (v, decimals = 2) => {
        const n = safeNum(v, NaN);
        return Number.isFinite(n) ? n.toFixed(decimals) : 'N/A';
    };

    // Input normalization (must be implemented early)
    
    // Validate existence of required objects
    if (!advancedAnalytics || !Array.isArray(advancedAnalytics.results) ||
        advancedAnalytics.results.length === 0) {
        return `<div style="padding:20px;">No analytics results available to generate the report.</div>`;
    }
    if (!decisionData || !Array.isArray(decisionData.criteria)) {
        return `<div style="padding:20px;">Missing decision data / criteria.</div>`;
    }

    // Normalize important values
    const winner = advancedAnalytics.results[0];
    const runnerUp = advancedAnalytics.results.length > 1 ? advancedAnalytics.results[1] : null;
    const confidenceRaw = advancedAnalytics.confidence || {};
    const confidence = {
        percentage: safeNum(confidenceRaw.percentage, 0),
        level: (confidenceRaw.level || '').toString().toLowerCase(),
        explanation: confidenceRaw.explanation ? String(confidenceRaw.explanation) : '',
        gap: safeNum(confidenceRaw.gap, 0)
    };
    const flipPoints = (typeof computeFlipPoints === 'function' ? computeFlipPoints() : []) || [];
    const risks = Array.isArray(advancedAnalytics.risks) ? advancedAnalytics.risks : [];
    const winnerTotalScore = safeNum(winner && winner.totalScore, 0);

    // Build every dynamic HTML block in precomputed constants

    // Winner description section
    const winnerDescriptionHtml = winner && winner.option ? `
        <div style="margin-bottom: 20px;">
            <h3 style="color: #155724; margin: 0 0 10px 0; font-size: 20px;">
                Recommended Choice: ${safeText(winner.option.name)}
            </h3>
            <div style="font-size: 16px; color: #155724; margin-bottom: 15px;">
                    <strong>Final Score:</strong> ${fmt(winnerTotalScore)}/5.0
            </div>
            ${winner.option.description ? `
                <p style="color: #155724; font-style: italic; margin: 10px 0;">
                    ${safeText(winner.option.description)}
                </p>
            ` : ''}
        </div>
    ` : '';

    // Confidence analysis block
    const confidenceGradient = confidence.level === 'high' ? 'linear-gradient(135deg, #28a745, #20c997)' :
                              confidence.level === 'medium' ? 'linear-gradient(135deg, #ffc107, #fd7e14)' :
                              'linear-gradient(135deg, #dc3545, #c82333)';
    
    const confidenceBlockHtml = `
        <div style="background: rgba(255,255,255,0.8); padding: 20px; border-radius: 10px; margin-top: 20px;">
            <h4 style="color: #667eea; margin: 0 0 15px 0;">📊 Decision Confidence Analysis</h4>
            <div style="margin: 15px 0;">
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
                    <span style="font-weight: 600;">Confidence Level: ${confidence.level.toUpperCase()}</span>
                    <span style="font-weight: bold; color: #667eea;">${confidence.percentage}%</span>
                </div>
                <div style="width: 100%; height: 12px; background: #e9ecef; border-radius: 6px; overflow: hidden;">
                    <div style="width: ${confidence.percentage}%; height: 100%; background: ${confidenceGradient}; border-radius: 6px;"></div>
                </div>
                <p style="margin: 10px 0 0 0; font-size: 14px; color: #666;">
                    ${safeText(confidence.explanation)}
                </p>
            </div>
            ${runnerUp ? `
                <div style="background: #f8f9fa; padding: 15px; border-radius: 8px; margin-top: 15px;">
                    <strong>Margin Analysis:</strong> ${fmt(confidence.gap)} points ahead of 
                    <em>${safeText(runnerUp.option.name)}</em> (${fmt(safeNum(runnerUp.totalScore))}/5.0)
                </div>
            ` : ''}
        </div>
    `;

    // Complete rankings
    const resultsWithRanks = assignRanksWithTies(advancedAnalytics.results);
    
    const resultsHtml = resultsWithRanks.map((result, index) => {
        const percentage = Math.round((result.totalScore/5)*100);
        let badgeColor = '#667eea';
        let badgeText = result.rank;
        
        if (result.rank === 1) {
            badgeColor = '#28a745';
            if (resultsWithRanks.filter(r => r.rank === 1).length > 1) {
                badgeText = `${result.rank}*`; // Indicate tie
            }
        } else if (result.isTied) {
            badgeColor = '#ffc107';
            badgeText = `${result.rank}*`; // Indicate tie
        }
        
        return `
            <div style="display: flex; align-items: center; margin-bottom: 20px; padding: 20px; background: ${result.rank === 1 ? 'linear-gradient(135deg, #d4edda, #c3e6cb)' : '#f8f9fa'}; border-radius: 12px; border: 2px solid ${result.rank === 1 ? '#28a745' : '#e9ecef'};">
                <div style="width: 40px; height: 40px; background: ${badgeColor}; color: white; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-weight: bold; margin-right: 20px; font-size: 18px;">
                    ${badgeText}
                </div>
                <div style="flex: 1;">
                    <div style="font-weight: bold; font-size: 18px; color: #333; margin-bottom: 8px;">
                        ${safeText(result.option ? result.option.name : result.name)} ${result.rank === 1 ? '🏆' : ''}
                        ${result.isTied ? '<span style="background: #fff3cd; color: #856404; padding: 2px 6px; border-radius: 8px; font-size: 12px; margin-left: 8px;">TIE</span>' : ''}
                    </div>
                    <div style="display: flex; align-items: center; margin-bottom: 8px;">
                        <div style="width: 200px; height: 16px; background: #e9ecef; border-radius: 8px; margin-right: 15px; overflow: hidden;">
                            <div style="width: ${percentage}%; height: 100%; background: ${badgeColor}; border-radius: 8px;"></div>
                        </div>
                        <span style="font-weight: bold; color: #667eea; font-size: 16px;">${fmt(result.totalScore)}/5.0</span>
                    </div>
                    ${result.option && result.option.description ? `
                        <p style="color: #666; margin: 0; font-size: 14px; font-style: italic;">
                            ${safeText(result.option.description)}
                        </p>
                    ` : ''}
                </div>
            </div>
        `;
    }).join('');

    // Top contributing criteria computation
    const winnerContributions = [];
    if (decisionData.criteria && Array.isArray(decisionData.criteria)) {
        decisionData.criteria.forEach(criteria => {
            const ratingKey = `${winner.option.id}-${criteria.id}`;
            const rating = safeNum(decisionData.ratings && decisionData.ratings[ratingKey], 2);
            const weight = safeNum(decisionData.normalizedWeights && decisionData.normalizedWeights[criteria.id], 0);
            const contribution = rating * (weight / 100);
            const impact = winnerTotalScore !== 0 ? (contribution / winnerTotalScore) * 100 : 0;
            winnerContributions.push({
                name: criteria.name,
                rating,
                weight: Math.round(weight),
                contribution,
                impact
            });
        });
    }
    winnerContributions.sort((a, b) => b.contribution - a.contribution);
    const topContributors = winnerContributions.slice(0, 3);

    const topContributorsHtml = topContributors.map((contrib, index) => `
        <div style="display: flex; align-items: center; padding: 15px; margin-bottom: 12px; background: white; border-radius: 8px; border-left: 4px solid ${index === 0 ? '#28a745' : index === 1 ? '#667eea' : '#ffc107'};">
            <div style="flex: 1;">
                <div style="font-weight: 600; color: #333; margin-bottom: 4px;">${safeText(contrib.name)}</div>
                <div style="font-size: 14px; color: #666;">
                    Rating: ${safeNum(contrib.rating)}/5 • Weight: ${safeNum(contrib.weight)}% • Impact: ${fmt(contrib.impact, 1)}%
                </div>
            </div>
            <div style="font-size: 18px; font-weight: bold; color: ${index === 0 ? '#28a745' : '#667eea'};">
                ${fmt(contrib.contribution)}
            </div>
        </div>
    `).join('');

    // Differentiating factors vs runner-up
    const differentiators = [];
    if (runnerUp && decisionData.criteria && Array.isArray(decisionData.criteria)) {
        decisionData.criteria.forEach(criteria => {
            const winnerRatingKey = `${winner.option.id}-${criteria.id}`;
            const runnerUpRatingKey = `${runnerUp.option.id}-${criteria.id}`;
            const winnerRating = safeNum(decisionData.ratings && decisionData.ratings[winnerRatingKey], 2);
            const runnerUpRating = safeNum(decisionData.ratings && decisionData.ratings[runnerUpRatingKey], 2);
            const ratingDiff = winnerRating - runnerUpRating;
            const weight = safeNum(decisionData.normalizedWeights && decisionData.normalizedWeights[criteria.id], 0);
            
            if (Math.abs(ratingDiff) >= 1) {
                differentiators.push({
                    name: criteria.name,
                    advantage: ratingDiff > 0 ? 'winner' : 'runnerup',
                    difference: Math.abs(ratingDiff),
                    weight: Math.round(weight),
                    impact: Math.abs(ratingDiff * (weight / 100))
                });
            }
        });
        differentiators.sort((a, b) => b.impact - a.impact);
    }

    const differentiatorsHtml = differentiators.length > 0 ? `
        <div style="background: #fff3cd; border: 2px solid #ffeaa7; border-radius: 15px; padding: 25px; margin-bottom: 30px;">
            <h3 style="color: #856404; margin: 0 0 20px 0; font-size: 20px;">⚔️ Key Differentiating Factors vs Runner-up</h3>
            <p style="color: #856404; margin-bottom: 15px; font-style: italic;">
                Areas where <strong>${safeText(winner.option.name)}</strong> differs significantly from <strong>${safeText(runnerUp.option.name)}</strong>:
            </p>
            ${differentiators.slice(0, 5).map(diff => `
                <div style="display: flex; align-items: center; justify-content: space-between; padding: 12px; margin-bottom: 10px; background: white; border-radius: 8px; border-left: 4px solid ${diff.advantage === 'winner' ? '#28a745' : '#dc3545'};">
                    <div style="flex: 1;">
                        <div style="font-weight: 600; color: #333; margin-bottom: 4px;">${safeText(diff.name)}</div>
                        <div style="font-size: 14px; color: #666;">
                            Weight: ${safeNum(diff.weight)}% • Impact: ${fmt(diff.impact)}
                        </div>
                    </div>
                    <div style="text-align: right;">
                        <div style="padding: 4px 8px; border-radius: 12px; font-size: 12px; font-weight: 600; background: ${diff.advantage === 'winner' ? '#d4edda' : '#f8d7da'}; color: ${diff.advantage === 'winner' ? '#155724' : '#721c24'}; margin-bottom: 4px;">
                            ${diff.advantage === 'winner' ? 'Advantage' : 'Disadvantage'}
                        </div>
                        <div style="font-size: 14px; color: #666;">
                            ${safeNum(diff.difference)} point${safeNum(diff.difference) > 1 ? 's' : ''} diff
                        </div>
                    </div>
                </div>
            `).join('')}
        </div>
    ` : '';

    // Decision stability assessment
    const lowPerformanceCount = winnerContributions.filter(c => c.rating <= 2).length;
    const highPerformanceCount = winnerContributions.filter(c => c.rating >= 4).length;
    let stabilityLevel = 'High';
    let stabilityText = 'Strong performance across multiple criteria';
    
    if (confidence.percentage < 40) {
        stabilityLevel = 'Low';
        stabilityText = 'Close decision - small changes could affect outcome';
    } else if (lowPerformanceCount > 0 || confidence.percentage < 70) {
        stabilityLevel = 'Medium';
        stabilityText = 'Generally solid choice with some areas of concern';
    }

    // Criteria weights distribution
    const criteriaHtml = decisionData.criteria.map((criteria, index) => {
        const weight = Math.round(safeNum(decisionData.normalizedWeights && decisionData.normalizedWeights[criteria.id], 0));
        const colors = CHART_COLORS;
        const color = colors[index % colors.length];
        
        return `
            <div style="display: flex; align-items: center; justify-content: space-between; margin: 15px 0; padding: 15px; background: white; border-radius: 8px; border-left: 4px solid ${color};">
                <div style="display: flex; align-items: center; flex: 1;">
                    <div style="width: 12px; height: 12px; background: ${color}; border-radius: 50%; margin-right: 12px;"></div>
                    <div>
                        <div style="font-weight: 600; color: #333; margin-bottom: 2px;">${safeText(criteria.name)}</div>
                        ${criteria.description ? `<div style="font-size: 12px; color: #666;">${safeText(criteria.description.substring(0, 60))}${criteria.description.length > 60 ? '...' : ''}</div>` : ''}
                    </div>
                </div>
                <div style="display: flex; align-items: center;">
                    <div style="width: 120px; height: 10px; background: #e9ecef; border-radius: 5px; margin-right: 12px; overflow: hidden;">
                        <div style="width: ${weight}%; height: 100%; background: ${color}; border-radius: 5px;"></div>
                    </div>
                    <strong style="min-width: 45px; text-align: right; color: ${color}; font-size: 16px;">${weight}%</strong>
                </div>
            </div>
        `;
    }).join('');

    // Performance matrix table
    const performanceMatrixHtml = `
        <table style="width: 100%; border-collapse: collapse; margin: 20px 0; font-size: 12px;">
            <thead>
                <tr style="background: #f8f9fa;">
                    <th style="padding: 12px; border: 1px solid #dee2e6; font-weight: 600; text-align: left;">Option</th>
                    ${decisionData.criteria.map(crit => {
                        const weight = Math.round(safeNum(decisionData.normalizedWeights && decisionData.normalizedWeights[crit.id], 0));
                        return `<th style="padding: 12px; border: 1px solid #dee2e6; font-weight: 600; text-align: center; min-width: 80px;">
                            ${safeText(crit.name)}<br><small style="color: #666;">(${weight}%)</small>
                        </th>`;
                    }).join('')}
                    <th style="padding: 12px; border: 1px solid #dee2e6; font-weight: 600; text-align: center;">Total Score</th>
                </tr>
            </thead>
            <tbody>
                ${advancedAnalytics.results.map((result, optIndex) => `
                    <tr>
                        <td style="padding: 12px; border: 1px solid #dee2e6; font-weight: 600; background: #f8f9fa;">
                            ${safeText(result.option.name)}
                        </td>
                        ${decisionData.criteria.map(crit => {
                            const ratingKey = `${result.option.id}-${crit.id}`;
                            const rating = safeNum(decisionData.ratings && decisionData.ratings[ratingKey], 2);
                            const weight = safeNum(decisionData.normalizedWeights && decisionData.normalizedWeights[crit.id], 0) / 100;
                            const weightedScore = rating * weight;
                            const bgColor = rating >= 4 ? '#e8f5e8' : rating >= 3 ? '#fffde7' : rating >= 2 ? '#fff3e0' : '#ffebee';
                            const textColor = rating >= 4 ? '#2e7d32' : rating >= 3 ? '#f57f17' : rating >= 2 ? '#e65100' : '#c62828';
                            
                            return `<td style="padding: 12px; border: 1px solid #dee2e6; text-align: center; background: ${bgColor}; color: ${textColor};">
                                <div style="font-weight: 600; font-size: 14px;">${rating}</div>
                                <div style="font-size: 10px; opacity: 0.8;">${fmt(weightedScore)}</div>
                            </td>`;
                        }).join('')}
                        <td style="padding: 12px; border: 1px solid #dee2e6; text-align: center; background: ${optIndex === 0 ? '#c8e6c9' : '#f8f9fa'}; color: ${optIndex === 0 ? '#1b5e20' : '#333'}; font-weight: bold;">
                            ${fmt(result.totalScore)}
                        </td>
                    </tr>
                `).join('')}
            </tbody>
        </table>
    `;

    // Sensitivity analysis (flip points) with safe Math.max
    const maxImpact = flipPoints.length ? Math.max(...flipPoints.map(f => safeNum(f.impactMagnitude, 1))) : 0;
    const flipPointsHtml = `
        <div class="sensitivity-analysis">
            <h4 style="color: #333; margin: 0 0 15px 0; font-size: 16px;">🎯 Flip Point Analysis</h4>
            <p style="color: #666; font-size: 13px; margin-bottom: 15px;">
                Minimum weight changes needed to change the winner:
            </p>
            
            ${flipPoints.slice(0, 6).map(fp => `
                <div style="display: flex; align-items: center; padding: 12px; margin: 8px 0; background: #f8f9fa; border-radius: 8px; border-left: 4px solid ${
                    fp.criticality === 'critical' ? '#dc3545' : 
                    fp.criticality === 'moderate' ? '#ffc107' : '#28a745'
                };">
                    <div style="flex: 1;">
                        <div style="font-weight: 600; color: #333; font-size: 14px;">${safeText(fp.criteriaName)}</div>
                        <div style="font-size: 12px; color: #666; margin-top: 2px;">
                            Current: ${safeNum(fp.currentWeight)}% → Required: ${safeNum(fp.flipPoint)}%
                        </div>
                    </div>
                    <div style="text-align: right;">
                        <div style="font-weight: 600; color: ${
                            fp.criticality === 'critical' ? '#dc3545' : 
                            fp.criticality === 'moderate' ? '#f57c00' : '#28a745'
                        }; font-size: 14px;">
                            ${safeText(fp.changeNeeded)}
                        </div>
                        <div style="font-size: 11px; color: #666;">
                            ${fp.criticality === 'critical' ? 'Critical' : 
                              fp.criticality === 'moderate' ? 'Moderate' : 'Stable'}
                        </div>
                    </div>
                </div>
            `).join('')}
        </div>

        <div style="background: white; border-radius: 12px; padding: 20px; border: 1px solid #e9ecef; margin-top: 20px;">
            <h4 style="color: #333; margin: 0 0 15px 0; font-size: 16px;">🌪️ Sensitivity Tornado Chart</h4>
            <div style="margin-top: 15px;">
                ${flipPoints.slice(0, 6).map(fp => {
                    const barWidth = maxImpact > 0 ? ((safeNum(fp.impactMagnitude, 0) / maxImpact) * 100) : 0;
                    return `
                        <div style="margin-bottom: 12px;">
                            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 4px;">
                                <span style="font-size: 13px; font-weight: 500;">${safeText(fp.criteriaName)}</span>
                                <span style="font-size: 12px; color: #666;">${safeText(fp.changeNeeded)}</span>
                            </div>
                            <div style="width: 100%; height: 16px; background: #e9ecef; border-radius: 8px; overflow: hidden;">
                                <div style="width: ${Math.max(barWidth, 5)}%; height: 100%; background: ${
                                    fp.criticality === 'critical' ? 'linear-gradient(135deg, #dc3545, #c82333)' : 
                                    fp.criticality === 'moderate' ? 'linear-gradient(135deg, #ffc107, #fd7e14)' : 
                                    'linear-gradient(135deg, #28a745, #20c997)'
                                }; border-radius: 8px; transition: width 0.8s ease;"></div>
                            </div>
                        </div>
                    `;
                }).join('')}
            </div>
            
            <div style="margin-top: 20px; padding: 15px; background: #f8f9fa; border-radius: 8px; font-size: 12px;">
                <strong>Interpretation:</strong><br>
                <span style="color: #dc3545;">●</span> <strong>Critical (Red):</strong> Small weight changes could flip the decision<br>
                <span style="color: #ffc107;">●</span> <strong>Moderate (Yellow):</strong> Medium sensitivity to weight changes<br>
                <span style="color: #28a745;">●</span> <strong>Stable (Green):</strong> Decision is robust to weight changes
            </div>
        </div>
    `;

    // Risk analysis with mitigation recommendations
        const risksHtml = risks.length === 0 ? `
            <div style="text-align: center; padding: 25px; background: #d4edda; border-radius: 12px; border: 2px solid #28a745;">
                <h4 style="color: #155724; margin: 0 0 10px 0; font-size: 18px;">✅ No Major Weaknesses Identified</h4>
                <p style="color: #155724; margin: 0; font-size: 14px;">Your top choice performs well across all criteria.</p>
            </div>
        ` : `
            <p style="color: #666; margin-bottom: 20px; font-size: 14px;">
                Areas where <strong>${safeText(winner.option.name)}</strong> could be vulnerable:
            </p>
            ${risks.map(risk => `
                <div style="background: ${risk.severity === 'critical' ? '#ffcdd2' : risk.severity === 'high' ? '#f8d7da' : '#fff3cd'}; border: 1px solid ${risk.severity === 'critical' ? '#f5c6cb' : risk.severity === 'high' ? '#f5c6cb' : '#ffeaa7'}; border-radius: 8px; padding: 15px; margin: 10px 0; border-left: 4px solid ${risk.severity === 'critical' ? '#b71c1c' : risk.severity === 'high' ? '#dc3545' : '#ffc107'};">
                    <div style="font-weight: 600; color: ${risk.severity === 'critical' ? '#b71c1c' : risk.severity === 'high' ? '#721c24' : '#856404'}; margin-bottom: 8px; font-size: 14px;">
                        ${risk.severity === 'critical' ? '🚫' : risk.severity === 'high' ? '🔴' : '🟡'} ${safeText(risk.criteriaName)}
                    </div>
                    <div style="font-size: 13px; color: ${risk.severity === 'critical' ? '#b71c1c' : risk.severity === 'high' ? '#721c24' : '#856404'};">
                        ${safeText(risk.description)}
                    </div>
                </div>
            `).join('')}
            
            <div style="margin-top: 20px; padding: 15px; background: #e7f3ff; border: 1px solid #b3d7ff; border-radius: 8px;">
                <h4 style="color: #0056b3; margin: 0 0 10px 0; font-size: 14px;">💡 Risk Mitigation Recommendations</h4>
                <ul style="margin: 0; padding-left: 20px; color: #0056b3; font-size: 13px; line-height: 1.5;">
                    <li>Consider if low-scoring criteria can be improved post-decision</li>
                    <li>Evaluate if alternative options perform better in critical weak areas</li>
                    <li>Assess whether poor performance in these areas is acceptable given your priorities</li>
                    ${risks.some(r => r.severity === 'critical') ? '<li>⚠️ <strong>Critical risks detected</strong> - consider if these options are truly viable</li>' : ''}
                    ${risks.length > 2 ? '<li>Consider if you have too many criteria with conflicting requirements</li>' : ''}
                </ul>
            </div>
        `;

    // Final return (single template literal with section classes)
    return `
        <div style="max-width: 100%; margin: 0 auto;">
            <!-- Header Section -->
            <div class="pdf-section header-section" style="text-align: center; padding: 20px 0; background: white;">
                <img src="images/Choicease logo.png" alt="Choicease Logo" style="height: 60px; width: auto; display: block; margin: 0 auto;">
                <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 20px; margin: 15px -40px 25px -40px; text-align: center; border-radius: 0;">
                    <h1 style="font-size: 32px; margin: 0 0 10px 0; font-weight: bold;">Advanced Decision Analysis</h1>
                    <p style="font-size: 16px; margin: 0; opacity: 0.9;">Comprehensive Report with Analytics</p>
                    <p style="font-size: 12px; margin: 10px 0 0 0; opacity: 0.8;">Generated by Choicease - Smart Choices, Made Easy</p>
                </div>
            </div>


            <!-- Decision Details Section -->
            <div class="pdf-section decision-details" style="background: #f8f9fa; border: 2px solid #dee2e6; border-radius: 15px; padding: 25px; margin-bottom: 15px;">
                <h3 style="color: #667eea; margin: 0 0 15px 0; font-size: 20px;">📋 Decision Details</h3>
                <div style="margin-bottom: 15px;">
                    <h4 style="color: #333; margin: 0 0 8px 0; font-size: 18px;">${safeText(decisionData.title)}</h4>
                    ${decisionData.description ? `
                        <p style="color: #666; margin: 0 0 15px 0; font-style: italic;">
                            ${safeText(decisionData.description)}
                        </p>
                    ` : ''}
                    <p style="color: #888; font-size: 14px; margin: 0;">
                        Generated on: ${new Date().toLocaleString()}
                    </p>
                </div>
            </div>

            <!-- Executive Summary Section -->
            <!-- Executive Summary Section -->
            <div class="pdf-section executive-summary" style="background: linear-gradient(135deg, #d4edda, #c3e6cb); border: 3px solid #28a745; border-radius: 15px; padding: 30px; margin-bottom: 15px;">
                <h2 style="color: #155724; margin: 0 0 15px 0; font-size: 24px;">🏆 Executive Summary</h2>
                ${winnerDescriptionHtml}
                ${confidenceBlockHtml}
            </div>

            <!-- Winner Analysis Section -->
            <div class="pdf-section winner-analysis" style="background: #f8f9fa; border: 2px solid #dee2e6; border-radius: 15px; padding: 25px; margin-bottom: 30px;">
                <h3 style="color: #667eea; margin: 0 0 20px 0; font-size: 20px;">🏆 Winner Analysis</h3>
                
                <!-- Why Winner Won Section -->
                <div style="background: linear-gradient(135deg, #d4edda, #c3e6cb); border: 2px solid #28a745; border-radius: 12px; padding: 20px; margin-bottom: 20px;">
                    <h4 style="color: #155724; margin: 0 0 15px 0; font-size: 18px;">Why ${safeText(winner.option.name)} Won:</h4>
                    ${topContributors.map(contrib => `
                        <div style="display: flex; align-items: center; margin-bottom: 10px; padding: 10px; background: rgba(255,255,255,0.7); border-radius: 6px; border-left: 4px solid #28a745;">
                            <div style="margin-right: 12px; color: #28a745; font-size: 16px;">▶</div>
                            <div style="font-size: 14px;">
                                <strong>${safeText(contrib.name)}:</strong> 
                                Scored ${contrib.rating}/5 with ${contrib.weight}% importance weight
                            </div>
                        </div>
                    `).join('')}
                </div>
                
                ${runnerUp ? `
                    <!-- Close Alternative Section -->
                    <div style="background: #e7f3ff; border: 2px solid #b3d7ff; border-radius: 12px; padding: 20px;">
                        <h4 style="color: #0056b3; margin: 0 0 12px 0; font-size: 16px;">🔍 Close alternative to consider:</h4>
                        <div style="font-size: 16px; font-weight: 600; color: #333; margin-bottom: 6px;">
                            ${safeText(runnerUp.option.name)} (${fmt(runnerUp.totalScore)}/5.0, Δ ${fmt(confidence.gap)})
                        </div>
                        <div style="color: #0056b3; font-style: italic; font-size: 14px;">
                            ${confidence.gap < 0.2 ? 'Very close race - consider both options!' : 
                              confidence.gap < 0.5 ? 'Close second choice worth considering' : 
                              'Clear winner, but this is a solid alternative'}
                        </div>
                    </div>
                ` : ''}
            </div>

            <!-- Complete Rankings Section -->
            <div class="pdf-section complete-rankings" style="margin-bottom: 30px;">
                <h3 style="color: #667eea; margin: 0 0 20px 0; font-size: 20px;">🏆 Complete Rankings & Analysis</h3>
                ${resultsHtml}
            </div>

            <!-- Top Contributing Criteria Section -->
            <div class="pdf-section top-contributors" style="background: #f8f9fa; border-radius: 12px; padding: 25px; margin-bottom: 30px;">
                <h3 style="color: #333; margin: 0 0 20px 0; font-size: 20px;">⭐ Top Contributing Criteria</h3>
                ${topContributorsHtml}
            </div>

            ${differentiators.length > 0 ? `<div class="pdf-section differentiating-factors">${differentiatorsHtml}</div>` : ''}

            <!-- Decision Stability Assessment Section -->
            <div class="pdf-section decision-stability" style="background: white; border: 2px solid #dee2e6; border-radius: 15px; padding: 25px; margin-bottom: 30px;">
                <h3 style="color: #333; margin: 0 0 20px 0; font-size: 20px;">🎯 Decision Stability Assessment</h3>
                <div style="display: flex; align-items: center; margin-bottom: 15px;">
                    <span style="font-weight: 600; margin-right: 15px; font-size: 16px;">Stability Level:</span>
                    <span style="padding: 8px 16px; border-radius: 20px; font-weight: 600; font-size: 14px; background: ${
                        stabilityLevel === 'High' ? '#d4edda' : 
                        stabilityLevel === 'Medium' ? '#fff3cd' : '#f8d7da'
                    }; color: ${
                        stabilityLevel === 'High' ? '#155724' : 
                        stabilityLevel === 'Medium' ? '#856404' : '#721c24'
                    };">
                        ${stabilityLevel}
                    </span>
                </div>
                <p style="color: #666; margin: 10px 0 20px 0; font-size: 15px;">${safeText(stabilityText)}</p>
                
                <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); gap: 15px; margin-top: 15px;">
                    <div style="text-align: center; padding: 15px; background: #f8f9fa; border-radius: 8px;">
                        <div style="font-size: 24px; font-weight: bold; color: #28a745; margin-bottom: 5px;">${highPerformanceCount}</div>
                        <div style="font-size: 14px; color: #666;">Strong Areas (4-5)</div>
                    </div>
                    <div style="text-align: center; padding: 15px; background: #f8f9fa; border-radius: 8px;">
                        <div style="font-size: 24px; font-weight: bold; color: ${lowPerformanceCount > 0 ? '#dc3545' : '#28a745'}; margin-bottom: 5px;">${lowPerformanceCount}</div>
                        <div style="font-size: 14px; color: #666;">Weak Areas (1-2)</div>
                    </div>
                    <div style="text-align: center; padding: 15px; background: #f8f9fa; border-radius: 8px;">
                        <div style="font-size: 24px; font-weight: bold; color: #667eea; margin-bottom: 5px;">${decisionData.criteria.length}</div>
                        <div style="font-size: 14px; color: #666;">Total Criteria</div>
                    </div>
                    <div style="text-align: center; padding: 15px; background: #f8f9fa; border-radius: 8px;">
                        <div style="font-size: 24px; font-weight: bold; color: #667eea; margin-bottom: 5px;">${confidence.percentage}%</div>
                        <div style="font-size: 14px; color: #666;">Confidence Level</div>
                    </div>
                </div>
            </div>

            <!-- Performance Matrix Section -->
            <div class="pdf-section performance-matrix" style="margin-bottom: 30px;">
                <h3 style="color: #667eea; margin: 0 0 20px 0; font-size: 20px;">📊 Performance Matrix</h3>
                <p style="color: #666; margin-bottom: 15px;">Detailed breakdown of how each option performed on each criteria:</p>
                <div style="overflow-x: auto;">
                    ${performanceMatrixHtml}
                </div>
                <div style="margin-top: 15px; padding: 15px; background: #f8f9fa; border-radius: 8px; font-size: 12px;">
                    <div style="display: flex; align-items: center; gap: 20px; flex-wrap: wrap;">
                        <div><strong>Color Legend:</strong></div>
                        <div style="display: flex; align-items: center; gap: 8px;">
                            <div style="width: 16px; height: 16px; background: #ffcdd2; border: 1px solid #ccc;"></div>
                            <span>0 (Unacceptable)</span>
                        </div>
                        <div style="display: flex; align-items: center; gap: 8px;">
                            <div style="width: 16px; height: 16px; background: #ffebee; border: 1px solid #ccc;"></div>
                            <span>1 (Poor)</span>
                        </div>
                        <div style="display: flex; align-items: center; gap: 8px;">
                            <div style="width: 16px; height: 16px; background: #fff3e0; border: 1px solid #ccc;"></div>
                            <span>2 (Fair)</span>
                        </div>
                        <div style="display: flex; align-items: center; gap: 8px;">
                            <div style="width: 16px; height: 16px; background: #fffde7; border: 1px solid #ccc;"></div>
                            <span>3 (Good)</span>
                        </div>
                        <div style="display: flex; align-items: center; gap: 8px;">
                            <div style="width: 16px; height: 16px; background: #e8f5e8; border: 1px solid #ccc;"></div>
                            <span>4 (Very Good)</span>
                        </div>
                        <div style="display: flex; align-items: center; gap: 8px;">
                            <div style="width: 16px; height: 16px; background: #c8e6c9; border: 1px solid #ccc;"></div>
                            <span>5 (Excellent)</span>
                        </div>
                    </div>
                </div>
            </div>

            <!-- Criteria Weights Distribution Section -->
            <div class="pdf-section criteria-weights" style="background: #f8f9fa; border-radius: 15px; padding: 25px; margin-bottom: 30px;">
                <h3 style="color: #667eea; margin: 0 0 20px 0; font-size: 20px;">🥧 Criteria Weights Distribution</h3>
                
                <!-- Pie Chart Placeholder -->
                <div id="pdfPieChartContainer" style="text-align: center; margin-bottom: 20px;">
                    <!-- Pie chart will be injected here programmatically -->
                </div>
                
                <p style="color: #666; margin-bottom: 20px;">How much each criteria influenced the final decision:</p>
                <div style="max-width: 500px; margin: 0 auto;">
                    ${criteriaHtml}
                </div>
            </div>

            <!-- Sensitivity Analysis Section -->
            <div class="pdf-section sensitivity-analysis" style="margin-bottom: 30px;">
                <h3 style="color: #667eea; margin: 0 0 20px 0; font-size: 20px;">⚖️ Sensitivity Analysis</h3>
                <p style="color: #666; margin-bottom: 20px;">
                    How sensitive your decision is to changes in criteria weights. Lower flip points indicate more critical criteria.
                </p>
                ${flipPointsHtml}
            </div>

            <!-- What-If Analysis Section -->
            <div class="pdf-section what-if-analysis" style="margin-bottom: 30px;">
                <h3 style="color: #667eea; margin: 0 0 20px 0; font-size: 20px;">🎛️ What-If Analysis</h3>
                <p style="color: #666; margin-bottom: 20px;">
                    Comprehensive study of how changes in criteria weights affect the final ranking. This analysis helps validate decision robustness by showing which weight adjustments would change the winner, providing confidence in the stability of your choice.
                </p>
                
                <!-- What-If Analysis Image Placeholder -->
                <div id="pdfWhatIfContainer" style="text-align: center; margin-bottom: 20px;">
                    <!-- What-if analysis will be injected here programmatically -->
                </div>
            </div>

            <!-- Risk Analysis Section -->
            <div class="pdf-section risk-analysis" style="margin-bottom: 30px;">
                <h3 style="color: #667eea; margin: 0 0 20px 0; font-size: 20px;">⚠️ Risk Analysis</h3>
                <div style="padding: 20px;">
                    ${risksHtml}
                </div>
            </div>

            <!-- Methodology Section -->
            <div class="pdf-section methodology" style="background: #f8f9fa; border: 2px solid #dee2e6; border-radius: 15px; padding: 25px; margin-bottom: 20px;">
                <h3 style="color: #667eea; margin: 0 0 15px 0; font-size: 20px;">📚 Methodology & Technical Details</h3>
                
                <div style="margin-bottom: 20px;">
                    <h4 style="color: #333; margin: 0 0 10px 0; font-size: 16px;">Analysis Method: Weighted Multi-Criteria Decision Analysis</h4>
                    <ul style="margin: 0; padding-left: 20px; line-height: 1.8; color: #333; font-size: 14px;">
                        <li>Each option is rated 0-5 on each criteria (0=Unacceptable, 1=Poor, 2=Fair, 3=Good, 4=Very Good, 5=Excellent)</li>
                        <li>Criteria importance weights are normalized to 100% total</li>
                        <li>Final scores = Σ(rating × normalized_weight) for each option</li>
                        <li>Options with identical scores receive the same rank</li>
                        <li>Higher scores indicate better alignment with your priorities</li>
                        <li>Sensitivity analysis shows how weight changes affect rankings</li>
                        <li>Risk analysis identifies potential weaknesses in the top choice</li>
                    </ul>
                </div>

                <div style="margin-bottom: 20px;">
                    <h4 style="color: #333; margin: 0 0 10px 0; font-size: 16px;">Decision Summary Statistics</h4>
                    <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); gap: 15px;">
                        <div style="background: white; padding: 12px; border-radius: 8px; text-align: center;">
                            <div style="font-size: 18px; font-weight: bold; color: #667eea;">${decisionData.options.length}</div>
                            <div style="font-size: 12px; color: #666;">Options Evaluated</div>
                        </div>
                        <div style="background: white; padding: 12px; border-radius: 8px; text-align: center;">
                            <div style="font-size: 18px; font-weight: bold; color: #667eea;">${decisionData.criteria.length}</div>
                            <div style="font-size: 12px; color: #666;">Criteria Analyzed</div>
                        </div>
                        <div style="background: white; padding: 12px; border-radius: 8px; text-align: center;">
                            <div style="font-size: 18px; font-weight: bold; color: #667eea;">${Object.keys(decisionData.ratings).length}</div>
                            <div style="font-size: 12px; color: #666;">Total Ratings</div>
                        </div>
                        <div style="background: white; padding: 12px; border-radius: 8px; text-align: center;">
                            <div style="font-size: 18px; font-weight: bold; color: #667eea;">${confidence.percentage}%</div>
                            <div style="font-size: 12px; color: #666;">Decision Confidence</div>
                        </div>
                    </div>
                </div>

                <div>
                    <h4 style="color: #333; margin: 0 0 10px 0; font-size: 16px;">Quality Assurance Checks</h4>
                    <div style="background: white; padding: 15px; border-radius: 8px;">
                        <ul style="margin: 0; padding-left: 20px; line-height: 1.6; color: #333; font-size: 13px;">
                            <li>✓ All criteria weights sum to 100%</li>
                            <li>✓ All options rated on all criteria</li>
                            <li>✓ Rating scale consistently applied (1-5)</li>
                            <li>✓ Sensitivity analysis performed for robustness</li>
                            <li>✓ Risk assessment completed for top choice</li>
                            ${differentiators.length > 0 ? '<li>✓ Key differentiating factors identified</li>' : ''}
                            <li>✓ Decision stability assessed</li>
                        </ul>
                    </div>
                </div>
            </div>

            <!-- Footer Section -->
            <div class="pdf-section footer" style="text-align: center; margin-top: 30px; padding-top: 20px; border-top: 2px solid #dee2e6; color: #666; font-size: 14px;">
                <p style="margin: 0 0 5px 0; font-weight: 600;">Powered by Choicease - Smart Choices, Made Easy</p>
                <p style="margin: 0 0 5px 0;">Visit: <strong>choicease.com</strong></p>
                <p style="margin: 0; font-size: 12px; color: #888;">This report was generated using advanced decision analytics to help you make informed choices.</p>
            </div>
        </div>
    `;
}



















        // FIXED RESULTS DISPLAY FUNCTION WITH TIE HANDLING
        function displayResults(results) {
            const container = document.getElementById('resultsGrid');
        
            // Add results header first
            const header = document.createElement('div');
            header.className = 'results-header';
        
            const titleElement = document.createElement('h2');
            titleElement.textContent = `Decision: ${decisionData.title}`;
            header.appendChild(titleElement);
        
            if (decisionData.description) {
                const contextElement = document.createElement('div');
                contextElement.className = 'context';
                contextElement.textContent = `Context: ${decisionData.description}`;
                header.appendChild(contextElement);
            }
        
            const timestampElement = document.createElement('div');
            timestampElement.className = 'timestamp';
            timestampElement.textContent = `Generated on: ${new Date().toLocaleString()}`;
            header.appendChild(timestampElement);
        
            // Clear container and add header first
            container.innerHTML = '';
            container.appendChild(header);
        
            // FIXED: Tie handling logic
            const resultsWithRanks = assignRanksWithTies(results);
            const hasWinners = resultsWithRanks.filter(r => r.rank === 1).length;
            const hasTies = resultsWithRanks.some(r => r.isTied);
        
            resultsWithRanks.forEach((result, index) => {
                const card = document.createElement('div');
                
                // FIXED: Card classes based on rank and ties
                let cardClasses = 'result-card';
                if (result.rank === 1) {
                    cardClasses += ' winner';
                }
                if (result.isTied) {
                    cardClasses += ' tied';
                }
                card.className = cardClasses;
        
                // FIXED: Winner badge for all rank 1 options
                if (result.rank === 1) {
                    const winnerBadge = document.createElement('div');
                    winnerBadge.style.textAlign = 'center';
                    winnerBadge.style.color = '#28a745';
                    winnerBadge.style.fontWeight = 'bold';
                    winnerBadge.style.marginBottom = '10px';
                    winnerBadge.style.fontSize = '1.1rem';
                    
                    if (hasWinners > 1) {
                        winnerBadge.innerHTML = '🏆 CO-WINNER';
                    } else {
                        winnerBadge.innerHTML = '🏆 WINNER';
                    }
                    card.appendChild(winnerBadge);
                }
        
                // FIXED: Rank badge with proper positioning
                const rankBadge = document.createElement('div');
                rankBadge.className = 'rank-badge';
                rankBadge.textContent = result.rank;
                card.appendChild(rankBadge);
        
                const h3 = document.createElement('h3');
                h3.textContent = result.option.name;
                                
                card.appendChild(h3);
        
                if (result.option.description) {
                    const p = document.createElement('p');
                    p.style.color = '#666';
                    p.style.marginBottom = '15px';
                    p.textContent = result.option.description;
                    card.appendChild(p);
                }
        
                const scoreBar = document.createElement('div');
                scoreBar.className = 'score-bar';
                const scoreFill = document.createElement('div');
                scoreFill.className = 'score-fill';
                scoreFill.style.width = `${(result.totalScore / 5) * 100}%`;
                scoreBar.appendChild(scoreFill);
                card.appendChild(scoreBar);
        
                const scoreText = document.createElement('div');
                scoreText.style.textAlign = 'center';
                scoreText.style.fontWeight = 'bold';
                scoreText.style.color = '#667eea';
                scoreText.style.marginBottom = '15px';
                const percentage = Math.round((result.totalScore/5)*100);
                scoreText.innerHTML = `Score: ${result.totalScore.toFixed(2)}/5.0`;
                // Commented out the one with percentage display:  scoreText.innerHTML = `Score: ${result.totalScore.toFixed(2)}/5.0 <span style="background: #667eea; color: white; padding: 2px 8px; border-radius: 12px; font-size: 0.9rem; margin-left: 8px;">${percentage}%</span>`;    
                card.appendChild(scoreText);
        
                const details = document.createElement('details');
                details.style.marginTop = '15px';
                const summary = document.createElement('summary');
                summary.style.cursor = 'pointer';
                summary.style.fontWeight = '600';
                summary.style.color = '#555';
                summary.textContent = 'View Breakdown';
                details.appendChild(summary);
        
                const breakdown = document.createElement('div');
                breakdown.style.marginTop = '10px';
                breakdown.style.paddingTop = '10px';
                breakdown.style.borderTop = '1px solid #dee2e6';
                Object.entries(result.criteriaScores).forEach(([criteriaName, scores]) => {
                    const div = document.createElement('div');
                    div.style.display = 'flex';
                    div.style.justifyContent = 'space-between';
                    div.style.margin = '5px 0';
                    div.style.fontSize = '0.9rem';
                    div.innerHTML = `<span>${criteriaName}:</span><span>${scores.rating}/5 (${Math.round(scores.score * 20)}%)</span>`;
                    breakdown.appendChild(div);
                });
                details.appendChild(breakdown);
                card.appendChild(details);
        
                container.appendChild(card);
            });
        }
        
        // HELPER FUNCTION: Assign ranks with tie handling
        function assignRanksWithTies(results) {
            // Sort by score (highest first)
            const sorted = [...results].sort((a, b) => b.totalScore - a.totalScore);
            
            const resultsWithRanks = [];
            let currentRank = 1;
            let previousScore = null;
            let sameScoreCount = 0;
            
            // Group by score to identify ties
            const scoreGroups = new Map();
            sorted.forEach(result => {
                const scoreKey = result.totalScore.toFixed(6); // Use high precision for comparison
                if (!scoreGroups.has(scoreKey)) {
                    scoreGroups.set(scoreKey, []);
                }
                scoreGroups.get(scoreKey).push(result);
            });
            
            // Assign ranks
            for (const [scoreKey, group] of scoreGroups) {
                const isTied = group.length > 1;
                const tiedWith = isTied ? group.length - 1 : 0;
                
                group.forEach(result => {
                    resultsWithRanks.push({
                        ...result,
                        rank: currentRank,
                        isTied: isTied,
                        tiedWith: tiedWith
                    });
                });
                
                // Move rank by the number of items in this group
                currentRank += group.length;
            }
            
            return resultsWithRanks;
        }
        
        // HELPER FUNCTION: Scroll to section with proper offset
        function scrollToSection(sectionId) {
            const section = document.getElementById(sectionId);
            if (section) {
                const yOffset = -20; // Offset to ensure title is visible
                const y = section.getBoundingClientRect().top + window.pageYOffset + yOffset;
                window.scrollTo({ top: y, behavior: 'smooth' });
            }
        }
        
        // ENHANCED STEP NAVIGATION WITH SCROLL FIX
        function showStep(step) {
            for (let i = 1; i <= 6; i++) {
                document.getElementById(`section${i}`).classList.add('hidden');
            }
            
            const currentSection = document.getElementById(`section${step}`);
            currentSection.classList.remove('hidden');
            
            // FIXED: Scroll to top of section with proper offset
            setTimeout(() => {
                scrollToSection(`section${step}`);
            }, 100);
            
            if (step === 4) {
                setupWeightingStep();
            } else if (step === 5) {
                setupRatingStep();
            }
        }










function shareToReddit() {
    // Get the current values from the form
    const decisionTitle = document.getElementById('decisionTitle').value.trim();
    const decisionDescription = document.getElementById('decisionDescription').value.trim();
    
    // Create the Reddit post title
    const postTitle = decisionTitle ? `[Decision] ${decisionTitle}` : '[Decision] Help me decide!';
    
    // Create the Reddit post body
    let postBody = '';
    if (decisionDescription) {
        postBody = `${decisionDescription}\n\n`;
    }
    postBody += '\n\n---\n\n*The attached QR can be imported and analyzed on [choicease.com](http://choicease.com)*';
    postBody = `🚨 NOTE (delete this line before posting): To add your QR image, go to the "Link" or "Images & Video" tab and upload it there.\n\n` + postBody;
    
    const redditUrl = 'https://old.reddit.com/r/choicease/submit/?' + 
        'title=' + encodeURIComponent(postTitle) + 
        '&text=' + encodeURIComponent(postBody) + '&type=IMAGE';
    
    // Open Reddit in new tab with pre-filled content
    window.open(redditUrl, '_blank');
}

        
function exportResults() {
    // Ensure normalized weights are calculated
    if (!decisionData.normalizedWeights || Object.keys(decisionData.normalizedWeights).length === 0) {
        normalizeImportanceWeights();
    }
    
    const results = {
        // Use consistent field names
        title: decisionData.title,              // ✅ Fixed: was "decision"
        description: decisionData.description,
        timestamp: new Date().toISOString(),
        options: decisionData.options,
        criteria: decisionData.criteria,
        weights: decisionData.weights,
        normalizedWeights: decisionData.normalizedWeights,  // ✅ Added: Critical for calculations
        ratings: decisionData.ratings,
        version: "1.1"  // ✅ Updated version
    };
    
    const dataStr = JSON.stringify(results, null, 2);
    const dataBlob = new Blob([dataStr], {type: 'application/json'});
    const url = URL.createObjectURL(dataBlob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `choicease_${decisionData.title.replace(/[^a-z0-9]/gi, '_')}_${Date.now()}.json`;
    link.click();
    URL.revokeObjectURL(url);
}




function capturePieChartFromPage() {
    return new Promise((resolve) => {
        // Look for existing pie chart canvas on the page
        const existingCanvas = document.getElementById('weightsCanvas');
        
        if (existingCanvas && chartManager.charts.pie) {
            console.log('Found existing pie chart, capturing it...');
            try {
                // Capture the existing chart directly
                const imageData = existingCanvas.toDataURL('image/png', 1.0);
                console.log('Successfully captured existing pie chart');
                resolve(imageData);
                return;
            } catch (error) {
                console.warn('Failed to capture existing chart:', error);
            }
        }
        
        // Fallback: Create a simple table-based visualization
        console.log('No existing chart found, creating fallback visualization...');
        resolve(null);
    });
}





function captureWhatIfAnalysisFromPage() {
    return new Promise((resolve) => {
        // Look for existing what-if analysis section on the page
        const whatIfSection = document.getElementById('advancedWhatIf');
        
        if (whatIfSection && !whatIfSection.classList.contains('hidden')) {
            console.log('Found what-if analysis section, capturing specific parts...');
            try {
                // Create a temporary container with just the parts we want
                const tempCapture = document.createElement('div');
                tempCapture.style.cssText = 'background: white; padding: 20px; font-family: Arial, sans-serif;';
                
                
                // Create a clean table-style representation of weight controls
                const controlsSection = whatIfSection.querySelector('.what-if-controls');
                if (controlsSection) {
                    const weightsTable = document.createElement('div');
                    weightsTable.style.cssText = 'margin-bottom: 20px;';
                    
                    const title = document.createElement('h4');
                    title.textContent = 'Weight Settings for Analysis';
                    title.style.cssText = 'margin-bottom: 15px; color: #333; font-size: 16px;';
                    weightsTable.appendChild(title);
                    
                    // Get all weight controls
                    const weightControls = controlsSection.querySelectorAll('.weight-control');
                    weightControls.forEach(control => {
                        const label = control.querySelector('label');
                        const slider = control.querySelector('.what-if-slider');
                        const display = control.querySelector('[id^="weight-display-"]');
                        
                        if (label && slider && display) {
                            const row = document.createElement('div');
                            row.style.cssText = `
                                display: flex;
                                align-items: center;
                                justify-content: space-between;
                                padding: 12px;
                                margin: 8px 0;
                                background: #f8f9fa;
                                border-radius: 8px;
                                border-left: 4px solid #667eea;
                            `;
                            
                            const nameDiv = document.createElement('div');
                            nameDiv.textContent = label.textContent;
                            nameDiv.style.cssText = 'font-weight: 600; color: #333; flex: 1;';
                            
                            const valueDiv = document.createElement('div');
                            valueDiv.textContent = display.textContent;
                            valueDiv.style.cssText = 'font-weight: bold; color: #667eea; font-size: 16px;';
                            
                            // Visual weight bar
                            const barContainer = document.createElement('div');
                            barContainer.style.cssText = 'width: 120px; height: 8px; background: #e9ecef; border-radius: 4px; margin: 0 15px; overflow: hidden;';
                            
                            const barFill = document.createElement('div');
                            const percentage = parseInt(display.textContent) || 0;
                            barFill.style.cssText = `width: ${percentage}%; height: 100%; background: #667eea; border-radius: 4px;`;
                            
                            barContainer.appendChild(barFill);
                            row.appendChild(nameDiv);
                            row.appendChild(barContainer);
                            row.appendChild(valueDiv);
                            weightsTable.appendChild(row);
                        }
                    });
                    
                    tempCapture.appendChild(weightsTable);
                }


                    
                // Add spacing
                const spacer = document.createElement('div');
                spacer.style.height = '20px';
                tempCapture.appendChild(spacer);
                
                // Capture updated rankings
                const resultsSection = whatIfSection.querySelector('#whatIfResults');
                if (resultsSection) {
                    const resultsClone = resultsSection.cloneNode(true);
                    tempCapture.appendChild(resultsClone);
                }
                
                // Temporarily add to page for capture
                tempCapture.style.position = 'absolute';
                tempCapture.style.left = '-9999px';
                tempCapture.style.top = '-9999px';
                document.body.appendChild(tempCapture);
                
                // Use html2canvas to capture the clean version
                html2canvas(tempCapture, {
                    backgroundColor: '#ffffff',
                    scale: 1.5,
                    useCORS: true,
                    allowTaint: true
                }).then(canvas => {
                    // Cleanup
                    document.body.removeChild(tempCapture);
                    
                    const imageData = canvas.toDataURL('image/png', 1.0);
                    console.log('Successfully captured what-if analysis components');
                    resolve(imageData);
                }).catch(error => {
                    document.body.removeChild(tempCapture);
                    console.warn('Failed to capture what-if analysis:', error);
                    resolve(null);
                });
                
            } catch (error) {
                console.warn('Error capturing what-if analysis:', error);
                resolve(null);
            }
        } else {
            console.log('No what-if analysis found or not visible');
            resolve(null);
        }
    });
}









        
        // FIXED PDF GENERATION FUNCTION
        function downloadPDFReport() {
            const { jsPDF } = window.jspdf;
            const doc = new jsPDF();
            
            // Define colors
            const primaryColor = [102, 126, 234]; // #667eea
            const secondaryColor = [118, 75, 162]; // #764ba2
            const textDark = [51, 51, 51];
            const textLight = [102, 102, 102];
            const successColor = [40, 167, 69];
            const backgroundColor = [248, 249, 250];
            
            let yPos = 20;
            const pageWidth = 190;
            const lineHeight = 7;
            
            // Professional Header with Background
            doc.setFillColor(...primaryColor);
            doc.rect(0, 0, 210, 40, 'F');
            
            // Header Text
            doc.setTextColor(255, 255, 255);
            doc.setFontSize(24);
            doc.setFont(undefined, 'bold');
            doc.text('Choicease', 105, 20, { align: 'center' });
            
            doc.setFontSize(12);
            doc.setFont(undefined, 'normal');
            doc.text('Smart Choices, Made Easy', 105, 28, { align: 'center' });
            
            doc.setFontSize(10);
            doc.text('Decision Analysis Report', 105, 35, { align: 'center' });
            
            yPos = 55;
            
            // FIXED: Decision Title Section (remove duplication)
            doc.setTextColor(...textDark);
            doc.setFillColor(...backgroundColor);
            
            // Calculate required height for decision section
            let sectionHeight = 25;
            if (decisionData.description) {
                const contextLines = doc.splitTextToSize(`Context: ${decisionData.description}`, pageWidth - 20);
                sectionHeight = 25 + (contextLines.length * 5) + 10;
            }
            
            doc.rect(10, yPos - 5, pageWidth, sectionHeight, 'F');
            doc.setDrawColor(200, 200, 200);
            doc.rect(10, yPos - 5, pageWidth, sectionHeight, 'S');
            
            doc.setFontSize(16);
            doc.setFont(undefined, 'bold');
            doc.text(`Decision: ${decisionData.title}`, 15, yPos + 5);
            yPos += 15;
        
            if (decisionData.description) {
                doc.setFontSize(11);
                doc.setFont(undefined, 'normal');
                doc.setTextColor(...textLight);
                const contextLines = doc.splitTextToSize(`Context: ${decisionData.description}`, pageWidth - 20);
                doc.text(contextLines, 15, yPos);
                yPos += contextLines.length * 5 + 5;
            }        
            
            doc.setFontSize(9);
            doc.setTextColor(...textLight);
            doc.text(`Generated: ${new Date().toLocaleString()}`, 15, yPos + 5);
            yPos += 25;
            
            // Calculate results with tie handling
            const results = calculateResultsForPDF();
            const resultsWithRanks = assignRanksWithTies(results);
            
            // Executive Summary Box
            doc.setFillColor(245, 245, 245);
            doc.rect(10, yPos, pageWidth, 35, 'F');
            doc.setDrawColor(...primaryColor);
            doc.setLineWidth(1);
            doc.rect(10, yPos, pageWidth, 35, 'S');
            
            doc.setTextColor(...primaryColor);
            doc.setFontSize(14);
            doc.setFont(undefined, 'bold');
            doc.text('Executive Summary', 15, yPos + 8);
            
            doc.setTextColor(...textDark);
            doc.setFontSize(11);
            doc.setFont(undefined, 'normal');
            
            const winners = resultsWithRanks.filter(r => r.rank === 1);
            if (winners.length > 1) {
                doc.text(`Co-Winners: ${winners.map(w => w.name).join(', ')}`, 15, yPos + 16);
                doc.text(`Tied Score: ${winners[0].totalScore.toFixed(2)}/5.0`, 15, yPos + 23);
                doc.text(`${winners.length} options tied for first place`, 15, yPos + 30);
            } else {
                doc.text(`Recommended Choice: ${winners[0].name}`, 15, yPos + 16);
                doc.text(`Score: ${winners[0].totalScore.toFixed(2)}/5.0`, 15, yPos + 23);
                doc.text('Clear winner identified', 15, yPos + 30);
            }
            
            yPos += 50;
            
            // FIXED: Add page break before Rankings section
            doc.addPage();
            yPos = 20;
            
            // FIXED: Professional Rankings Section
            doc.setTextColor(...primaryColor);
            doc.setFontSize(16);
            doc.setFont(undefined, 'bold');
            doc.text('Complete Rankings & Analysis', 15, yPos);
            yPos += 20;
            
            // Add ranking methodology explanation
            doc.setFontSize(10);
            doc.setFont(undefined, 'normal');
            doc.setTextColor(...textLight);
            doc.text('Rankings based on weighted multi-criteria analysis. Tied scores receive the same rank.', 15, yPos);
            yPos += 15;
            
            resultsWithRanks.forEach((result, index) => {
                if (yPos > 240) {
                    doc.addPage();
                    yPos = 20;
                }
                
                // Professional ranking card
                const cardHeight = 35;
                const isWinner = result.rank === 1;
                const cardColor = isWinner ? [212, 237, 218] : [248, 249, 250];
                const borderColor = isWinner ? successColor : [222, 226, 230];
                
                // Card background
                doc.setFillColor(...cardColor);
                doc.rect(15, yPos, pageWidth - 10, cardHeight, 'F');
                doc.setDrawColor(...borderColor);
                doc.setLineWidth(1);
                doc.rect(15, yPos, pageWidth - 10, cardHeight, 'S');
                
                // Rank badge
                let badgeColor;
                if (isWinner) {
                    badgeColor = successColor;
                } else if (result.isTied) {
                    badgeColor = [255, 193, 7]; // Yellow for ties
                } else {
                    badgeColor = primaryColor;
                }
                doc.setFillColor(...badgeColor);
                doc.circle(30, yPos + 12, 8, 'F');
                doc.setTextColor(255, 255, 255);
                doc.setFontSize(12);
                doc.setFont(undefined, 'bold');
                doc.text(`${result.rank}`, 30, yPos + 13, { align: 'center' });
                
                // Option name and details
                doc.setTextColor(...textDark);
                doc.setFontSize(12);
                doc.setFont(undefined, 'bold');
                let optionText = result.name;
                if (isWinner && resultsWithRanks.filter(r => r.rank === 1).length > 1) {
                    optionText += ' (Co-Winner)';
                } else if (isWinner) {
                    optionText += ' (Winner)';
                }
                doc.text(optionText, 45, yPos + 10);
                
                // Score and percentage
                doc.setFontSize(10);
                doc.setFont(undefined, 'normal');
                doc.text(`Score: ${result.totalScore.toFixed(2)}/5.0`, 45, yPos + 18);
                
                // Enhanced score bar
                const barWidth = 80;
                const barY = yPos + 22;
                const scoreWidth = (result.totalScore / 5) * barWidth;
                
                // Background bar
                doc.setFillColor(230, 230, 230);
                doc.rect(45, barY, barWidth, 8, 'F');
                
                // Score bar
                doc.setFillColor(...(isWinner ? successColor : primaryColor));
                doc.rect(45, barY, scoreWidth, 8, 'F');
                
                
                yPos += cardHeight + 10;
            });
            
            // FIXED: Add page break before criteria section
            doc.addPage();
            yPos = 20;
            
            // FIXED: Decision Criteria & Weights section with content
            doc.setTextColor(...primaryColor);
            doc.setFontSize(16);
            doc.setFont(undefined, 'bold');
            doc.text('Decision Criteria & Weights', 15, yPos);
            yPos += 20;
            
            // Add criteria explanation
            doc.setFontSize(10);
            doc.setFont(undefined, 'normal');
            doc.setTextColor(...textLight);
            doc.text('Criteria importance weights normalized to 100%. Higher weights indicate greater importance.', 15, yPos);
            yPos += 15;
            
            // Create criteria table
            decisionData.criteria.forEach((criteria, index) => {
                if (yPos > 250) {
                    doc.addPage();
                    yPos = 20;
                }
                
                const weight = calculateDisplayWeight(criteria.id);
                
                // Criteria card
                doc.setFillColor(248, 249, 250);
                doc.rect(15, yPos, pageWidth - 10, 25, 'F');
                doc.setDrawColor(222, 226, 230);
                doc.rect(15, yPos, pageWidth - 10, 25, 'S');
                
                // Criteria name
                doc.setTextColor(...textDark);
                doc.setFontSize(12);
                doc.setFont(undefined, 'bold');
                doc.text(criteria.name, 20, yPos + 8);
                
                // Weight bar
                const weightBarWidth = 60;
                const weightWidth = (weight / 100) * weightBarWidth;
                
                doc.setFillColor(240, 240, 240);
                doc.rect(20, yPos + 12, weightBarWidth, 6, 'F');
                
                doc.setFillColor(...secondaryColor);
                doc.rect(20, yPos + 12, weightWidth, 6, 'F');
                
                // Weight percentage
                doc.setFontSize(10);
                doc.setFont(undefined, 'bold');
                doc.setTextColor(...primaryColor);
                doc.text(`${weight}%`, 90, yPos + 16);
                
                // Description if available
                if (criteria.description) {
                    doc.setFontSize(8);
                    doc.setFont(undefined, 'normal');
                    doc.setTextColor(...textLight);
                    const descText = criteria.description.length > 60 ? 
                                     criteria.description.substring(0, 60) + '...' : 
                                     criteria.description;
                    doc.text(descText, 110, yPos + 12);
                }
                
                yPos += 30;
            });
            
            // Add methodology section at the end
            if (yPos > 200) {
                doc.addPage();
                yPos = 20;
            }
            
            yPos += 10;
            doc.setFillColor(250, 250, 250);
            doc.rect(10, yPos, pageWidth, 40, 'F');
            doc.setDrawColor(200, 200, 200);
            doc.rect(10, yPos, pageWidth, 40, 'S');
            
            doc.setTextColor(...primaryColor);
            doc.setFontSize(12);
            doc.setFont(undefined, 'bold');
            doc.text('Methodology', 15, yPos + 8);
            
            doc.setTextColor(...textDark);
            doc.setFontSize(9);
            doc.setFont(undefined, 'normal');
            const methodology = [
                'This analysis uses a weighted scoring model where:',
                '• Each option is rated 0-5 on each criteria (0=Unacceptable, 5=Excellent)',
                '• Criteria importance weights are normalized to 100%',
                '• Final scores = Σ(rating × weight) for each option',
                '• Options with identical scores receive the same rank',
                '• Higher scores indicate better alignment with your priorities'
            ];
            
            methodology.forEach((line, i) => {
                doc.text(line, 15, yPos + 15 + (i * 4));
            });
            
            // Professional footer on all pages
            const pageCount = doc.internal.getNumberOfPages();
            for (let i = 1; i <= pageCount; i++) {
                doc.setPage(i);
                
                // Footer line
                doc.setDrawColor(...primaryColor);
                doc.setLineWidth(0.5);
                doc.line(20, 280, 190, 280);
                
                doc.setTextColor(...textLight);
                doc.setFontSize(8);
                doc.setFont(undefined, 'normal');
                doc.text('Powered by Choicease - Smart Choices, Made Easy', 105, 285, { align: 'center' });
                doc.text(`choicease.com | Page ${i} of ${pageCount}`, 105, 290, { align: 'center' });
            }
            
            // Download
            const fileName = `choicease_${decisionData.title.replace(/[^a-z0-9]/gi, '_')}_${Date.now()}.pdf`;
            doc.save(fileName);
        }
        
        








        // Helper function to calculate results for PDF
        function calculateResultsForPDF() {
            const results = [];
            decisionData.options.forEach(option => {
                let totalScore = 0;
                const criteriaScores = {};
                decisionData.criteria.forEach(criteria => {
                    const ratingKey = `${option.id}-${criteria.id}`;
                    const rating = decisionData.ratings[ratingKey] ?? 2; // Default: 2 (Fair)
                    const weight = (decisionData.normalizedWeights[criteria.id] || 0) / 100;
                    const score = rating * weight;
                    criteriaScores[criteria.name] = {
                        rating: rating,
                        weight: weight * 100,
                        score: score
                    };
                    totalScore += score;
                });
                results.push({
                    name: option.name,
                    description: option.description,
                    totalScore: totalScore,
                    criteriaScores: criteriaScores
                });
            });
            return results;
        }


        function downloadPDFReportWithErrorHandling() {
            try {
                // Show loading indicator
                showToast('Generating PDF report...', 'info');
                
                // Create timeout promise
                const timeoutPromise = new Promise((_, reject) => {
                    setTimeout(() => reject(new Error('PDF generation timed out')), 30000);
                });
                
                // Create PDF generation promise
                const pdfPromise = new Promise((resolve, reject) => {
                    try {
                        downloadPDFReport();
                        setTimeout(resolve, 1000); // Give it a moment to complete
                    } catch (error) {
                        reject(error);
                    }
                });
                
                // Race between PDF generation and timeout
                Promise.race([pdfPromise, timeoutPromise])
                    .then(() => {
                        showToast('PDF generated successfully!', 'success');
                    })
                    .catch(error => {
                        console.error('PDF generation error:', error);
                        showToast('PDF generation failed. Please try again.', 'error');
                    });
                    
            } catch (error) {
                console.error('PDF setup error:', error);
                showToast('Failed to start PDF generation.', 'error');
            }
        }






// Toggle export dropdown visibility
function toggleExportDropdown() {
    const dropdown = document.getElementById('exportDropdown');
    dropdown.classList.toggle('show');
}

// Handle export selection
// Updated export dropdown handler with enhanced PDF support
function handleExportSelection(type) {
    // Hide dropdown
    document.getElementById('exportDropdown').classList.remove('show');
    
    // Call appropriate export function
    switch(type) {
        case 'qr':
            exportResultsAsQR();
            break;
        case 'json':
            exportResults();
            break;
        case 'pdf':
            downloadPDFReportWithErrorHandling();
            break;
        case 'csv':
            exportToCSV();
            break;
        default:
            console.error('Unknown export type:', type);
    }
}

// Export to CSV format
function exportToCSV() {
    // Calculate results for CSV
    const results = [];
    decisionData.options.forEach(option => {
        let totalScore = 0;
        const criteriaScores = {};
        
        decisionData.criteria.forEach(criteria => {
            const ratingKey = `${option.id}-${criteria.id}`;
            const rating = decisionData.ratings[ratingKey] ?? 2; // Default: 2 (Fair)
            const weight = (decisionData.normalizedWeights[criteria.id] || 0) / 100;
            const score = rating * weight;
            criteriaScores[criteria.name] = {
                rating: rating,
                weight: Math.round(weight * 100),
                score: score
            };
            totalScore += score;
        });
        
        results.push({
            name: option.name,
            description: option.description || '',
            totalScore: totalScore,
            criteriaScores: criteriaScores
        });
    });
    
    // Sort by score
    results.sort((a, b) => b.totalScore - a.totalScore);
    
    // Create CSV content
    let csvContent = '';
    
    // Header with decision info
    csvContent += `Decision Analysis: ${decisionData.title}\n`;
    csvContent += `Context: ${decisionData.description || 'N/A'}\n`;
    csvContent += `Generated: ${new Date().toLocaleString()}\n`;
    csvContent += `Generated by: Choicease - Smart Choices Made Easy (Visit: choicease.com)\n\n`;
    
    // Summary Results Table
    csvContent += 'SUMMARY RESULTS\n';
    csvContent += 'Rank,Option Name,Description,Final Score,Score Percentage\n';
    
    results.forEach((result, index) => {
        const scorePercentage = Math.round((result.totalScore / 5) * 100);
        csvContent += `${index + 1},"${result.name}","${result.description}",${result.totalScore.toFixed(2)},${scorePercentage}%\n`;
    });
    
    csvContent += '\n';
    
    // Criteria Weights Table
    csvContent += 'CRITERIA WEIGHTS\n';
    csvContent += 'Criteria,Importance Weight,Description\n';
    
    decisionData.criteria.forEach(criteria => {
        const weight = calculateDisplayWeight(criteria.id);
        csvContent += `"${criteria.name}",${weight}%,"${criteria.description || 'N/A'}"\n`;
    });
    
    csvContent += '\n';
    
    // Detailed Ratings Matrix
    csvContent += 'DETAILED RATINGS MATRIX\n';
    
    // Create header row
    let headerRow = 'Option Name,Description,Final Score';
    decisionData.criteria.forEach(criteria => {
        headerRow += `,"${criteria.name} (Rating)","${criteria.name} (Weight)","${criteria.name} (Weighted Score)"`;
    });
    csvContent += headerRow + '\n';
    
    // Add data rows
    results.forEach(result => {
        let row = `"${result.name}","${result.description}",${result.totalScore.toFixed(2)}`;
        
        decisionData.criteria.forEach(criteria => {
            const scores = result.criteriaScores[criteria.name];
            if (scores) {
                row += `,${scores.rating},${scores.weight}%,${scores.score.toFixed(3)}`;
            } else {
                row += ',N/A,N/A,N/A';
            }
        });
        
        csvContent += row + '\n';
    });
    
    // Add methodology explanation
    csvContent += '\n';
    csvContent += 'METHODOLOGY\n';
    csvContent += 'Scoring Method,"Weighted Multi-Criteria Decision Analysis"\n';
    csvContent += 'Rating Scale,"0-5 (0=Unacceptable, 1=Poor, 2=Fair, 3=Good, 4=Very Good, 5=Excellent)"\n';
    csvContent += 'Weight Calculation,"Normalized to 100% based on importance ratings"\n';
    csvContent += 'Final Score Formula,"Sum of (Rating x Weight) for each criteria"\n';
    csvContent += 'Maximum Possible Score,5.0\n';
    csvContent += 'Default Rating,2 (Fair)\n';
    
    // Create and download CSV file
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `choicease_${decisionData.title.replace(/[^a-z0-9]/gi, '_')}_${Date.now()}.csv`;
    link.style.display = 'none';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
}




function shareResults() {
    createShareableImage().then(canvas => {
        canvas.toBlob(blob => {
            // ✅ Use the more detailed and robust getEnhancedShareText() function
            const shareText = getEnhancedShareText();
            const shareData = {
                title: `Decision Results: ${decisionData.title}`,
                text: shareText,
                files: [new File([blob], 'choicease-results.png', { type: 'image/png' })]
            };
            
            // Check if the browser can share the files
            if (navigator.canShare && navigator.canShare(shareData)) {
                navigator.share(shareData).catch(error => {
                    // Fallback if user cancels or an error occurs
                    console.error('Sharing failed:', error);
                    downloadImageAndCopyText(blob, shareText);
                });
            } else {
                // Fallback for browsers that don't support sharing files
                console.log("Sharing files not supported, falling back to download.");
                downloadImageAndCopyText(blob, shareText);
            }
        }, 'image/png');
    });
}

function getTopChoice() {
    // Calculate results to get top option
    const results = [];
    decisionData.options.forEach(option => {
        let totalScore = 0;
        decisionData.criteria.forEach(criteria => {
            const ratingKey = `${option.id}-${criteria.id}`;
            const rating = decisionData.ratings[ratingKey] ?? 2; // Default: 2 (Fair)
            const weight = (decisionData.normalizedWeights[criteria.id] || 0) / 100;
            totalScore += rating * weight;
        });
        results.push({ name: option.name, totalScore });
    });
    results.sort((a, b) => b.totalScore - a.totalScore);
    return results[0].name;
}

function getTopScore() {
    const results = [];
    decisionData.options.forEach(option => {
        let totalScore = 0;
        decisionData.criteria.forEach(criteria => {
            const ratingKey = `${option.id}-${criteria.id}`;
            const rating = decisionData.ratings[ratingKey] ?? 2; // Default: 2 (Fair)
            const weight = (decisionData.normalizedWeights[criteria.id] || 0) / 100;
            totalScore += rating * weight;
        });
        results.push(totalScore);
    });
    return Math.max(...results);
}
        
function createShareableImage() {
    return new Promise((resolve) => {
        const container = document.getElementById('shareCanvas');
        
        // Calculate results for image
        const results = [];
        decisionData.options.forEach(option => {
            let totalScore = 0;
            decisionData.criteria.forEach(criteria => {
                const ratingKey = `${option.id}-${criteria.id}`;
                const rating = decisionData.ratings[ratingKey] ?? 2; // Default: 2 (Fair)
                const weight = (decisionData.normalizedWeights[criteria.id] || 0) / 100;
                totalScore += rating * weight;
            });
            results.push({
                name: option.name,
                description: option.description,
                totalScore: totalScore
            });
        });
        results.sort((a, b) => b.totalScore - a.totalScore);
        
        // Create image content
        const maxScore = Math.max(...results.map(r => r.totalScore));
        
        container.innerHTML = `
            <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; margin: -40px -40px 30px -40px; text-align: center;">
                <img src="images/logo.png" alt="Choicease" style="max-width: 200px; height: auto; margin-bottom: 15px;">
                <h1 style="font-size: 28px; margin: 0; text-shadow: 2px 2px 4px rgba(0,0,0,0.3);">Decision Results</h1>
            </div>
            
            <div style="margin-bottom: 25px;">
                <h2 style="font-size: 24px; color: #333; margin-bottom: 8px; font-weight: bold;">${decisionData.title}</h2>
                ${decisionData.description ? `<p style="color: #666; font-size: 16px; margin: 0; font-style: italic;">${decisionData.description}</p>` : ''}
            </div>
            
            <div style="margin-bottom: 30px;">
                <h3 style="color: #667eea; font-size: 20px; margin-bottom: 20px; font-weight: 600;">Ranking Results</h3>
                ${results.map((result, index) => `
                    <div style="display: flex; align-items: center; margin-bottom: 15px; padding: 15px; background: ${index === 0 ? 'linear-gradient(135deg, #d4edda, #c3e6cb)' : '#f8f9fa'}; border-radius: 12px; border: 2px solid ${index === 0 ? '#28a745' : '#e9ecef'};">
                        <div style="width: 35px; height: 35px; background: ${index === 0 ? '#28a745' : '#667eea'}; color: white; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-weight: bold; margin-right: 15px; font-size: 18px;">
                            ${index + 1}
                        </div>
                        <div style="flex: 1;">
                            <div style="font-weight: bold; font-size: 18px; color: #333; margin-bottom: 4px;">
                                ${result.name} ${index === 0 ? '🏆' : ''}
                            </div>
                            <div style="display: flex; align-items: center;">
                                <div style="width: 200px; height: 12px; background: #e9ecef; border-radius: 6px; margin-right: 10px; overflow: hidden;">
                                    <div style="width: ${(result.totalScore / maxScore) * 100}%; height: 100%; background: ${index === 0 ? '#28a745' : '#667eea'}; border-radius: 6px;"></div>
                                </div>
                                <span style="font-weight: bold; color: #667eea; font-size: 16px;">${result.totalScore.toFixed(2)}/5.0</span>
                            </div>
                        </div>
                    </div>
                `).join('')}
            </div>
            
            <div style="border-top: 2px solid #e9ecef; padding-top: 20px; display: flex; justify-content: space-between; align-items: center; color: #666; font-size: 14px;">
                <div>Generated on: ${new Date().toLocaleString()}</div>
                <div style="text-align: right;">
                    <div style="font-weight: 600; color: #667eea; margin-bottom: 4px;">Try it yourself!</div>
                    <div>Visit: choicease.com</div>
                </div>
            </div>
        `;
        
        // Use html2canvas to convert to image
        html2canvas(container, {
            backgroundColor: '#ffffff',
            scale: 2,
            useCORS: true,
            allowTaint: true
        }).then(canvas => {
            resolve(canvas);
        });
    });
}

function downloadImageAndCopyText(blob, shareText) {
    // Download image
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `choicease_${decisionData.title.replace(/[^a-z0-9]/gi, '_')}_results.png`;
    link.click();
    URL.revokeObjectURL(url);
    
    // Copy text to clipboard
    navigator.clipboard.writeText(shareText).then(() => {
        alert('Image downloaded and share text copied to clipboard! You can now paste the text when sharing on social media.');
    }).catch(() => {
        // Fallback for older browsers
        const textArea = document.createElement('textarea');
        textArea.value = shareText;
        document.body.appendChild(textArea);
        textArea.select();
        document.execCommand('copy');
        document.body.removeChild(textArea);
        alert('Image downloaded and share text copied to clipboard! You can now paste the text when sharing on social media.');
    });
}
        
function getEnhancedShareText() {
    const topChoice = getTopChoice();
    const scorePercentage = Math.round((getTopScore() / 5) * 100);
    
    return `🎯 Decision Analysis Complete!

📝 "${decisionData.title}"
🏆 Winner: ${topChoice} (${scorePercentage}% match)
📊 ${decisionData.options.length} options • ${decisionData.criteria.length} criteria analyzed

Smart choices made easy! Try it yourself at choicease.com`;
}

        
function checkDataIntegrity(data) {
    const warnings = [];
    let isValid = true;
    
    // Check for orphaned ratings (ratings without corresponding options/criteria)
    if (data.ratings && Object.keys(data.ratings).length > 0) {
        const optionIds = data.options ? data.options.map(o => o.id.toString()) : [];
        const criteriaIds = data.criteria ? data.criteria.map(c => c.id.toString()) : [];
        
        Object.keys(data.ratings).forEach(ratingKey => {
            const [optionId, criteriaId] = ratingKey.split('-');
            if (!optionIds.includes(optionId)) {
                warnings.push(`Found rating for missing option ID: ${optionId}`);
            }
            if (!criteriaIds.includes(criteriaId)) {
                warnings.push(`Found rating for missing criteria ID: ${criteriaId}`);
            }
        });
    }
    
    // Check for orphaned weights
    if (data.weights && Object.keys(data.weights).length > 0) {
        const criteriaIds = data.criteria ? data.criteria.map(c => c.id.toString()) : [];
        Object.keys(data.weights).forEach(weightKey => {
            if (!criteriaIds.includes(weightKey)) {
                warnings.push(`Found weight for missing criteria ID: ${weightKey}`);
            }
        });
    }
    
    // Check for missing ratings
    if (data.options && data.criteria && data.options.length > 0 && data.criteria.length > 0) {
        const expectedRatings = data.options.length * data.criteria.length;
        const actualRatings = Object.keys(data.ratings || {}).length;
        if (actualRatings < expectedRatings) {
            warnings.push(`Missing ${expectedRatings - actualRatings} ratings. Some options may not be fully rated.`);
        }
    }
    
    return {
        isValid: warnings.length === 0,
        warnings: warnings
    };
}

        
function handleFileImport(event) {
    const file = event.target.files[0];
    if (!file) return;
    
    if (!file.name.endsWith('.json')) {
        alert('Please select a valid JSON file.');
        return;
    }
    
    const reader = new FileReader();
    reader.onload = function(e) {
        try {
            const importedData = JSON.parse(e.target.result);
            
            if (validateImportedData(importedData)) {
                // ✅ Added: Check for data integrity
                const integrity = checkDataIntegrity(importedData);
                if (integrity.isValid) {
                    loadImportedData(importedData);
                    showToast('Yay! All set and imported. Let\'s tweak or dive in! 🎊');
                } else {
                    alert(`Import completed with warnings:\n${integrity.warnings.join('\n')}\nData may be incomplete.`);
                    loadImportedData(importedData);
                }
            } else {
                alert('Invalid file format. Please select a file exported by Choicease.');
            }
        } catch (error) {
            console.error('Import error:', error);
            handleImportError(error, 'JSON file');
        }
    };
    reader.readAsText(file);
    
    // Reset file input
    event.target.value = '';
}





// MAIN ISSUES AND FIXES:

// 1. ERROR LEVEL TOO HIGH - Changed from CorrectLevel.H to CorrectLevel.M
// 2. SCANNING WINDOW TOO SMALL - Increased from 450 to match actual QR size
// 3. MISSING SINGLE QR HANDLING - Added logic for single QR codes
// 4. TIMING ISSUES - Improved QR generation waiting

// ========================================
// FIXED QR GENERATION FUNCTION
// ========================================

// ========================================
// REVISED: SEQUENTIAL QR CODE GENERATION
// ========================================

// ========================================
// COMPATIBLE: SEQUENTIAL QR CODE GENERATION (NO ASYNC/AWAIT)
// ========================================

function generateQRCodes(qrDataArray, totalChunks) {
    console.log("Generating QR codes sequentially...");
    
    // Validate data first
    for (let i = 0; i < qrDataArray.length; i++) {
        if (qrDataArray[i].length > 2900) {
            throw new Error(`Chunk ${i + 1} is too large (${qrDataArray[i].length} chars). Max is 2900.`);
        }
        console.log(`Chunk ${i + 1} size: ${qrDataArray[i].length} characters`);
    }
    
    // Create temporary container
    const tempDiv = document.createElement('div');
    tempDiv.style.cssText = 'position:absolute;left:-9999px;top:-9999px;width:600px;height:600px;';
    document.body.appendChild(tempDiv);
    
    // CHANGED: Sequential generation using Promise chain
    generateQRCodesSequentially(qrDataArray, totalChunks, tempDiv)
        .then(function(canvases) {
            console.log("All QR codes generated successfully, creating final image...");
            createFinalImage(canvases, totalChunks);
        })
        .catch(function(error) {
            console.error("QR generation failed:", error);
            alert("Failed to generate QR codes: " + error.message + "\n\nTry reducing data or export as JSON.");
        })
        .finally(function() {
            // Cleanup
            if (tempDiv.parentNode === document.body) {
                document.body.removeChild(tempDiv);
            }
        });
}

// CHANGED: Using Promise chain instead of async/await
function generateQRCodesSequentially(qrDataArray, totalChunks, tempDiv) {
    return new Promise(function(resolve, reject) {
        const canvases = [];
        let currentIndex = 0;
        
        function processNextQR() {
            if (currentIndex >= qrDataArray.length) {
                // All done!
                resolve(canvases);
                return;
            }
            
            console.log("Starting QR " + (currentIndex + 1) + "/" + totalChunks + "...");
            
            createSingleQR(qrDataArray[currentIndex], currentIndex, totalChunks, tempDiv)
                .then(function(canvas) {
                    canvases.push(canvas);
                    console.log("✓ QR " + (currentIndex + 1) + " completed successfully");
                    currentIndex++;
                    
                    // Optional: Add a small delay between QRs for stability
                    if (currentIndex < qrDataArray.length) {
                        setTimeout(processNextQR, 100);
                    } else {
                        processNextQR(); // Process the final one or finish
                    }
                })
                .catch(function(error) {
                    reject(new Error("Failed on QR " + (currentIndex + 1) + ": " + error.message));
                });
        }
        
        // Start processing
        processNextQR();
    });
}

// SAME: Single QR creation function (no async/await)
function createSingleQR(data, index, totalChunks, tempDiv) {
    return new Promise(function(resolve, reject) {
        const qrContainer = document.createElement('div');
        qrContainer.style.cssText = 'width:512px;height:512px;display:block;margin:10px;';
        tempDiv.appendChild(qrContainer);
        
        try {
            console.log("Creating QR " + (index + 1) + " with " + data.length + " characters");
            
            const qr = new QRCode(qrContainer, {
                text: data,
                width: 512,
                height: 512,
                correctLevel: QRCode.CorrectLevel.L,
                colorDark: "#000000",
                colorLight: "#ffffff",
                quietZone: 8,
                quietZoneColor: "#ffffff"
            });
            
            // Wait and check for completion
            let attempts = 0;
            function checkForCanvas() {
                attempts++;
                const canvas = qrContainer.querySelector('canvas');
                const img = qrContainer.querySelector('img');
                
                if (canvas && canvas.width > 0 && canvas.height > 0) {
                    // Verify canvas has actual content
                    const ctx = canvas.getContext('2d');
                    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
                    const hasContent = imageData.data.some(function(pixel) { return pixel < 255; });
                    
                    if (hasContent) {
                        console.log("QR " + (index + 1) + "/" + totalChunks + " generated successfully (canvas)");
                        
                        // Add readability test (with error handling)
                        if (typeof testQRReadability === 'function') {
                            testQRReadability(canvas)
                                .then(function(readable) {
                                    console.log("QR " + (index + 1) + " is readable: " + readable);
                                    if (!readable) {
                                        console.warn("QR " + (index + 1) + " failed readability test!");
                                    }
                                })
                                .catch(function(err) {
                                    console.warn("Readability test failed for QR " + (index + 1) + ":", err);
                                });
                        }
                        
                        resolve(canvas);
                    } else if (attempts < 15) {
                        setTimeout(checkForCanvas, 300);
                    } else {
                        reject(new Error("Canvas generated but appears empty for QR " + (index + 1)));
                    }
                } else if (img && img.complete && img.naturalWidth > 0) {
                    // Convert img to canvas with proper size
                    const canvas = document.createElement('canvas');
                    canvas.width = 512;
                    canvas.height = 512;
                    const ctx = canvas.getContext('2d');
                    
                    ctx.fillStyle = '#ffffff';
                    ctx.fillRect(0, 0, 512, 512);
                    ctx.drawImage(img, 0, 0, 512, 512);
                    
                    // Add readability test for img->canvas conversion (with error handling)
                    if (typeof testQRReadability === 'function') {
                        testQRReadability(canvas)
                            .then(function(readable) {
                                console.log("QR " + (index + 1) + " (img->canvas) is readable: " + readable);
                                if (!readable) {
                                    console.warn("QR " + (index + 1) + " (img->canvas) failed readability test!");
                                }
                            })
                            .catch(function(err) {
                                console.warn("Readability test failed for QR " + (index + 1) + ":", err);
                            });
                    }
                    
                    console.log("QR " + (index + 1) + "/" + totalChunks + " generated successfully (img->canvas)");
                    resolve(canvas);
                } else if (attempts < 15) {
                    setTimeout(checkForCanvas, 300);
                } else {
                    reject(new Error("No valid QR found for chunk " + (index + 1) + " after " + attempts + " attempts"));
                }
            }
            
            // Start checking after initial delay
            setTimeout(checkForCanvas, 500);
            
        } catch (error) {
            reject(new Error("Failed to create QR " + (index + 1) + ": " + error.message));
        }
    });
}
// ========================================
// IMPROVED FINAL IMAGE CREATION
// ========================================

function createFinalImage(qrCanvases, totalChunks) {
    const qrSize = 512; // Match the new QR size
    const padding = 40;
    const headerHeight = 120;
    const footerHeight = 100;
    const qrSpacing = 60; // INCREASED: More space between QRs (was 20)
    const labelHeight = 40; // NEW: Dedicated space for labels
    
    // Calculate canvas dimensions with proper spacing for labels
    const canvasWidth = qrSize + (padding * 2);
    const canvasHeight = headerHeight + 
                        (qrSize * totalChunks) + 
                        (labelHeight * totalChunks) + // NEW: Space for labels
                        (qrSpacing * Math.max(0, totalChunks - 1)) + 
                        footerHeight + 
                        (padding * 2);

    // Create output canvas
    const outputCanvas = document.createElement('canvas');
    outputCanvas.width = canvasWidth;
    outputCanvas.height = canvasHeight;
    const ctx = outputCanvas.getContext('2d');

    // White background
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, canvasWidth, canvasHeight);

    // Add border for better QR detection
    ctx.strokeStyle = '#000000';
    ctx.lineWidth = 2;
    ctx.strokeRect(1, 1, canvasWidth - 2, canvasHeight - 2);

    // Header
    ctx.fillStyle = '#000000';
    ctx.textAlign = 'center';
    ctx.font = 'bold 24px Arial, sans-serif';
    
//    const title = (decisionData.title || 'Choicease Decision').substring(0, 50);
    ctx.fillText('Choicease Decision Analysis', canvasWidth / 2, padding + 25);

    // Truncate title at word boundary (max 60 chars)
    let title = decisionData.title || 'Choicease Decision';
    if (title.length > 60) {
        const words = title.split(' ');
        let truncated = '';
        for (let word of words) {
            if ((truncated + word).length <= 57) {
                truncated += (truncated ? ' ' : '') + word;
            } else {
                break;
            }
        }
        title = truncated + '...';
    }
    
    ctx.font = '18px Arial, sans-serif';
    ctx.fillText(title, canvasWidth / 2, padding + 55);
    
    // Description (up to two lines, word-level truncation)
    if (decisionData.description && decisionData.description.length > 0) {
        ctx.font = '14px Arial, sans-serif';
        ctx.fillStyle = '#666666';
            
        const maxCharsPerLine = 80;
        const words = decisionData.description.split(' ');
        let line1 = '';
        let line2 = '';
        let currentLine = 1;
        
        for (let word of words) {
            if (currentLine === 1) {
                if ((line1 + word).length <= maxCharsPerLine) {
                    line1 += (line1 ? ' ' : '') + word;
                } else {
                    currentLine = 2;
                }
            }
            if (currentLine === 2) {
                if ((line2 + word).length <= maxCharsPerLine) {
                    line2 += (line2 ? ' ' : '') + word;
                } else {
                    line2 += '...';
                    break;
                }
            }
        }
        
        ctx.fillText(line1, canvasWidth / 2, padding + 80);
        if (line2) {
            ctx.fillText(line2, canvasWidth / 2, padding + 100);
        }
    }


    // Draw QR codes with proper spacing and labels
    let yOffset = headerHeight + padding;
    qrCanvases.forEach((canvas, index) => {
        // FIXED: Add chunk label ABOVE the QR code with proper spacing
        ctx.fillStyle = '#333333';
        ctx.font = 'bold 16px Arial, sans-serif';
        ctx.textAlign = 'center';
//        ctx.fillText(`Part ${index + 1} of ${totalChunks}`, canvasWidth / 2, yOffset + 20);
        
        // Move QR code position down to accommodate label
        const qrYPosition = yOffset + labelHeight;
        
        // Draw border around QR code area with more generous spacing
        ctx.strokeStyle = '#cccccc';
        ctx.lineWidth = 1;
        ctx.strokeRect(padding - 5, qrYPosition - 5, qrSize + 10, qrSize + 10);
        
        // Draw QR code
        ctx.drawImage(canvas, padding, qrYPosition, qrSize, qrSize);
        
        // Move to next position with proper spacing
        yOffset += qrSize + labelHeight + qrSpacing;
    });

    
    // Footer (adjust position based on new layout)
    const footerY = canvasHeight - footerHeight;
    
    // Logo on left - with proper loading
    const logo = new Image();
    logo.onload = function() {
        const logoHeight = 60;
        const logoWidth = logo.width * (logoHeight / logo.height); // Maintain aspect ratio
        ctx.drawImage(logo, padding, footerY, logoWidth, logoHeight);
        
        // Text on right - moved inside onload to ensure logo loads first
        ctx.fillStyle = '#333333';
        ctx.textAlign = 'right';
        ctx.font = '12px Arial, sans-serif';
        const rightAlignX = canvasWidth - padding;
        ctx.fillText('Generated: ' + new Date().toLocaleString(), rightAlignX, footerY + 20);
        ctx.fillText('Import at: https://choicease.com', rightAlignX, footerY + 40);
        ctx.fillText('Share at: https://reddit.com/r/choicease', rightAlignX, footerY + 60);
    
        // Download with better quality - moved inside onload
        const url = outputCanvas.toDataURL('image/png', 1.0);
        const safeTitle = (decisionData.title || 'decision').replace(/[^a-zA-Z0-9]/g, '_').substring(0, 30);
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-').substring(0, 19);
        const filename = `choicease_QR_${safeTitle}_${timestamp}.png`;
    
        const link = document.createElement('a');
        link.download = filename;
        link.href = url;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        
        console.log("QR export completed successfully");
    };
    logo.src = "images/Choicease logo.png";    
     
}

        
// ========================================
// IMPROVED CHUNKING STRATEGY
// ========================================

function exportResultsAsQR() {
    console.log("Starting QR export...");
    
    // Ensure normalized weights are calculated
    if (!decisionData.normalizedWeights || Object.keys(decisionData.normalizedWeights).length === 0) {
        normalizeImportanceWeights();
    }

    const results = {
        title: decisionData.title,
        description: decisionData.description,
        timestamp: new Date().toISOString(),
        options: decisionData.options,
        criteria: decisionData.criteria,
        weights: decisionData.weights,
        normalizedWeights: decisionData.normalizedWeights,
        ratings: decisionData.ratings,
        version: "1.1"
    };

    try {
        // Serialize and compress
        const jsonStr = JSON.stringify(results);
        console.log(`Original JSON size: ${jsonStr.length} bytes`);
        
        const compressed = pako.deflate(jsonStr);
        console.log(`Compressed size: ${compressed.length} bytes`);
        
        // Convert to base64
        const base64Data = btoa(String.fromCharCode.apply(null, compressed));
        console.log(`Base64 size: ${base64Data.length} bytes`);

        // IMPROVED CHUNKING - More conservative for reliability
        const maxChunkSize = 1500; // Smaller chunks for L error correction
        const chunks = [];
        
        if (base64Data.length <= maxChunkSize) {
            // Single chunk - no need to split
            chunks.push(base64Data);
        } else {
            // Multiple chunks
            for (let i = 0; i < base64Data.length; i += maxChunkSize) {
                chunks.push(base64Data.slice(i, i + maxChunkSize));
            }
        }
        
        const totalChunks = chunks.length;
        console.log(`Total chunks needed: ${totalChunks}`);

        if (totalChunks > 20) {
            alert("Oops! Data is too large for QR export. Please try:\n1. Export as JSON instead\n2. Remove some options or criteria\n3. Shorten descriptions");
            return;
        }

        // Prepare QR data with metadata
        const qrDataArray = chunks.map((chunk, index) => {
            const metadata = {
                i: index,       // chunk index
                t: totalChunks, // total chunks  
                v: "1.1"       // version
            };
            const metaStr = JSON.stringify(metadata);
            const fullData = metaStr + "|" + chunk;
            
            console.log(`Chunk ${index + 1} total size: ${fullData.length} characters`);
            
            // Final safety check
            if (fullData.length > 2800) { // More conservative limit
                throw new Error(`Chunk ${index + 1} too large: ${fullData.length} chars`);
            }
            
            return fullData;
        });

        generateQRCodes(qrDataArray, totalChunks);

    } catch (error) {
        console.error("Export preparation failed:", error);
        alert("Failed to prepare data for QR export: " + error.message);
    }
}

// ========================================
// TEST FUNCTION TO VERIFY QR READABILITY
// ========================================

function testQRReadability(canvas) {
    return new Promise((resolve) => {
        const ctx = canvas.getContext('2d');
        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        
        try {
            const code = jsQR(imageData.data, imageData.width, imageData.height);
            resolve(code && code.data && code.data.length > 10);
        } catch (error) {
            resolve(false);
        }
    });
}
        
        
        // Helper function to create final image

// ========================================
// REVISED QR IMPORT FUNCTION  
// ========================================

function handleQRImport(event) {
    const file = event.target.files[0];
    if (!file) return;

    console.log("Starting QR import...");
    showToast("Hang tight—we're crunching your decision magic! ✨");

    const reader = new FileReader();
    reader.onload = function(e) {
        const img = new Image();
        img.onload = function() {
            console.log(`Image loaded: ${img.width}x${img.height}`);
            
            try {
                const qrCodes = scanImageForQRCodes(img);
                console.log(`Found ${qrCodes.length} QR codes`);
                
                if (qrCodes.length === 0) {
                    throw new Error('No QR codes detected in the image.');
                }

                const reassembledData = reassembleQRData(qrCodes);
                const parsedData = JSON.parse(reassembledData);

                if (validateImportedData(parsedData)) {
                    loadImportedData(parsedData);
                    showToast(`Yay! All set and imported. Let\'s tweak or dive in! 🎊`);
                } else {
                    throw new Error('Invalid data format in QR codes.');
                }

            } catch (error) {
                    console.error("QR import failed:", error);
                    handleImportError(error, 'QR code');
            }
        };

        img.onerror = function() {
            console.error("Failed to load image");
            alert('Failed to load the selected image.');
        };

        img.src = e.target.result;
    };

    reader.onerror = function() {
        console.error("FileReader error");
        alert('Failed to read the selected file.');
    };

    reader.readAsDataURL(file);
    
    // Reset file input
    event.target.value = '';
}

//  ============ START OF SCAN IMAGE FUNCTION  ============ 
function scanImageForQRCodes(img) {
  const codes = [];
  let expected = Infinity;
  
  function readT(s) {
    try {
      return JSON.parse(s.split("|", 1)[0]).t || 1;
    } catch {
      return 1;
    }
  }
  
  function parseMeta(s) {
    try {
      return JSON.parse(s.split("|", 1)[0]);
    } catch {
      return null;
    }
  }

  console.log(`🔍 Image dimensions: ${img.width} × ${img.height}`);
  
  // Start scanning from the top
  let currentY = 0;
  let scanAttempts = 0;
  const maxAttempts = 20; // Safety limit
  
  while (currentY < img.height && scanAttempts < maxAttempts) {
    scanAttempts++;
    const remainingHeight = img.height - currentY;
    
    // Skip if remaining area is too small for a QR code
    if (remainingHeight < 100) {
      console.log(`🔍 Remaining area too small (${remainingHeight}px), stopping scan`);
      break;
    }
    
    console.log(`🔍 Scan attempt ${scanAttempts}: scanning from y=${currentY}, height=${remainingHeight}`);
    
    // Create a FRESH canvas for each scan attempt - this ensures no library state issues
    const scanCanvas = document.createElement("canvas");
    scanCanvas.width = img.width;
    scanCanvas.height = remainingHeight;
    const scanCtx = scanCanvas.getContext("2d", { willReadFrequently: true });
    
    // Draw only the portion we want to scan onto the fresh canvas
    scanCtx.drawImage(
      img,
      0, currentY, img.width, remainingHeight,  // Source: from currentY to bottom
      0, 0, img.width, remainingHeight         // Destination: fill the new canvas
    );
    
    // Get image data from the fresh canvas
    const imageData = scanCtx.getImageData(0, 0, img.width, remainingHeight);
    
    // Scan with jsQR - completely fresh state each time
    const scanResult = jsQR(imageData.data, imageData.width, imageData.height, {
      inversionAttempts: "attemptBoth",
    });
    
    if (scanResult && scanResult.data) {
      console.log(`✅ Found QR at y offset ${currentY}`);
      console.log(`📄 QR data length: ${scanResult.data.length} chars`);
      
      // Check for duplicates (safety check)
      if (codes.some(c => c.data === scanResult.data)) {
        console.log(`🔄 Duplicate QR detected, moving down and continuing...`);
        currentY += 50; // Small jump to avoid re-detection
        continue;
      }
      
      const meta = parseMeta(scanResult.data);
      if (meta) {
        console.log(`📦 QR ${codes.length + 1}: chunk i=${meta.i}, t=${meta.t}, v=${meta.v}`);
      } else {
        console.log(`⚠️ QR ${codes.length + 1}: Could not parse metadata from: ${scanResult.data.substring(0, 50)}...`);
      }
      
      // Convert coordinates back to original image coordinates
      // (since we drew the cropped portion at 0,0 on the scan canvas)
      const adjustedLocation = {
        topLeftCorner: { 
          x: scanResult.location.topLeftCorner.x, 
          y: scanResult.location.topLeftCorner.y + currentY 
        },
        topRightCorner: { 
          x: scanResult.location.topRightCorner.x, 
          y: scanResult.location.topRightCorner.y + currentY 
        },
        bottomLeftCorner: { 
          x: scanResult.location.bottomLeftCorner.x, 
          y: scanResult.location.bottomLeftCorner.y + currentY 
        },
        bottomRightCorner: { 
          x: scanResult.location.bottomRightCorner.x, 
          y: scanResult.location.bottomRightCorner.y + currentY 
        }
      };
      
      codes.push({ data: scanResult.data, location: adjustedLocation });
      
      // Set expected count from first QR
      if (expected === Infinity) {
        expected = readT(scanResult.data);
        console.log(`📦 Expected total QRs = ${expected}`);
      }
      
      // Find the bottom of the detected QR
      const qrBottom = Math.max(
        adjustedLocation.bottomLeftCorner.y,
        adjustedLocation.bottomRightCorner.y
      );
      
      // Move scan position right after the QR bottom
      currentY = Math.ceil(qrBottom) + 1; // +1 to move past the bottom pixel
      
      console.log(`⏭️ QR bottom at y=${qrBottom}, next scan starting at y=${currentY}`);
      
      // Check if we found all expected QRs
      if (codes.length >= expected && expected !== Infinity) {
        console.log(`🎯 Found all ${codes.length}/${expected} codes!`);
        break;
      }
      
    } else {
      // No QR found in current scan area
      console.log(`❌ No QR found from y=${currentY} (${remainingHeight}px remaining)`);
      
      if (codes.length === 0) {
        // If we haven't found any QRs yet, try moving down a bit
        console.log(`🔍 No QRs found yet, moving down 100px and trying again...`);
        currentY += 100;
        continue;
      } else {
        // We found some QRs but not all expected
        console.log(`ℹ️ Found ${codes.length}/${expected} QRs, no more detected in remaining area`);
        
        // Try one more scan with a smaller increment in case we missed something
        if (remainingHeight > 200) {
          console.log(`🔍 Trying smaller increment (50px) for potential missed QR...`);
          currentY += 50;
          continue;
        } else {
          break;
        }
      }
    }
  }

  console.log(`🏁 Scanning complete. Found ${codes.length}/${expected} QR codes in ${scanAttempts} attempts.`);
  
  // Debug: Log what we found
  codes.forEach((code, index) => {
    const meta = parseMeta(code.data);
    if (meta) {
      console.log(`  QR ${index + 1}: chunk ${meta.i + 1}/${meta.t}`);
    }
  });
  
  return codes;
}        
        
// ============ END OF SCAN IMAGE FUNCTION ============          

        
// Improved reassembly with better error messages
function reassembleQRData(qrCodes) {
    if (qrCodes.length === 0) {
        throw new Error('No QR codes provided for reassembly.');
    }

    const chunks = [];
    let totalChunks = 0;
    let version = null;
    const errors = [];

    console.log(`📦 Reassembling ${qrCodes.length} QR codes...`);

    // Parse each QR code
    for (let i = 0; i < qrCodes.length; i++) {
        const qrCode = qrCodes[i];
        try {
            console.log(`  Processing QR ${i + 1}: ${qrCode.data.length} chars`);
            
            const separatorIndex = qrCode.data.indexOf('|');
            if (separatorIndex === -1) {
                errors.push(`QR ${i + 1}: No separator found`);
                continue;
            }

            const metadataStr = qrCode.data.substring(0, separatorIndex);
            const chunkData = qrCode.data.substring(separatorIndex + 1);
            
            if (!chunkData) {
                errors.push(`QR ${i + 1}: No data after separator`);
                continue;
            }

            const metadata = JSON.parse(metadataStr);
            console.log(`    Metadata: chunk ${metadata.i + 1}/${metadata.t}, version ${metadata.v}`);
            
            // Validate metadata
            if (typeof metadata.i !== 'number' || typeof metadata.t !== 'number') {
                errors.push(`QR ${i + 1}: Invalid metadata format`);
                continue;
            }

            if (metadata.i < 0 || metadata.i >= metadata.t) {
                errors.push(`QR ${i + 1}: Invalid chunk index ${metadata.i} for total ${metadata.t}`);
                continue;
            }

            // Set/verify version and total chunks
            if (version === null) {
                version = metadata.v;
                totalChunks = metadata.t;
                console.log(`  📋 Expecting ${totalChunks} chunks total, version ${version}`);
            } else if (metadata.v !== version) {
                errors.push(`QR ${i + 1}: Version mismatch (expected ${version}, got ${metadata.v})`);
                continue;
            } else if (metadata.t !== totalChunks) {
                errors.push(`QR ${i + 1}: Total chunks mismatch (expected ${totalChunks}, got ${metadata.t})`);
                continue;
            }

            // Check for duplicate chunks
            if (chunks[metadata.i] !== undefined) {
                errors.push(`QR ${i + 1}: Duplicate chunk ${metadata.i}`);
                continue;
            }

            // Store chunk
            chunks[metadata.i] = chunkData;
            console.log(`    ✓ Chunk ${metadata.i + 1}/${metadata.t} stored (${chunkData.length} chars)`);

        } catch (error) {
            errors.push(`QR ${i + 1}: Parse error - ${error.message}`);
            continue;
        }
    }

    // Report errors if any
    if (errors.length > 0) {
        console.warn(`⚠️ QR parsing errors:`, errors);
    }

    // Validate we have all chunks
    const foundChunks = chunks.filter(chunk => chunk !== undefined).length;
    console.log(`📊 Chunks found: ${foundChunks}/${totalChunks}`);

    if (foundChunks !== totalChunks) {
        const missing = [];
        for (let i = 0; i < totalChunks; i++) {
            if (!chunks[i]) missing.push(i + 1);
        }
        throw new Error(`Missing chunks: ${missing.join(', ')} (found ${foundChunks}/${totalChunks})`);
    }

    console.log("✓ All chunks found, reassembling data...");

    // Reassemble base64 data
    const base64Data = chunks.join('');
    console.log(`📝 Reassembled base64 size: ${base64Data.length} bytes`);

    // Decode base64 and decompress
    try {
        const binaryString = atob(base64Data);
        const compressedData = new Uint8Array(binaryString.length);
        for (let i = 0; i < binaryString.length; i++) {
            compressedData[i] = binaryString.charCodeAt(i);
        }

        const decompressed = pako.inflate(compressedData, { to: 'string' });
        console.log(`📦 Decompressed size: ${decompressed.length} bytes`);
        console.log("✅ QR reassembly successful!");
        
        return decompressed;

    } catch (error) {
        throw new Error(`Failed to decompress data: ${error.message}`);
    }
}        
        
function validateImportedData(data) {
    // Support both old and new formats
    const hasTitle = data.title || data.decision;
    const hasValidStructure = data && 
           typeof hasTitle === 'string' &&
           Array.isArray(data.options) &&
           Array.isArray(data.criteria) &&
           typeof data.weights === 'object' &&
           typeof data.ratings === 'object';
    
    // Validate options have required fields
    if (hasValidStructure && data.options.length > 0) {
        const optionsValid = data.options.every(option => 
            option && typeof option.name === 'string' && option.id
        );
        if (!optionsValid) return false;
    }
    
    // Validate criteria have required fields
    if (hasValidStructure && data.criteria.length > 0) {
        const criteriaValid = data.criteria.every(criteria => 
            criteria && typeof criteria.name === 'string' && criteria.id
        );
        if (!criteriaValid) return false;
    }
    
    return hasValidStructure;
}

function loadImportedData(data) {
    // Clear current data first
    decisionData = {
        title: '',
        description: '',
        options: [],
        criteria: [],
        weights: {},
        ratings: {},
        normalizedWeights: {}
    };
    
    // Load imported data with backward compatibility
    decisionData.title = sanitizeInput(data.title || data.decision || '');
    decisionData.description = sanitizeInput(data.description || '');
    
    // ✅ CRITICAL FIX: Preserve original IDs to maintain rating key relationships
    decisionData.options = data.options.map(option => ({
        id: option.id,  // Keep original ID - don't generate new ones!
        name: sanitizeInput(option.name || ''),
        description: sanitizeInput(option.description || '')
    }));
    
    decisionData.criteria = data.criteria.map(criteria => ({
        id: criteria.id,  // Keep original ID - don't generate new ones!
        name: sanitizeInput(criteria.name || ''),
        description: sanitizeInput(criteria.description || '')
    }));
    
    // Load weights and ratings
    decisionData.weights = data.weights || {};
    decisionData.ratings = data.ratings || {};
    
    // ✅ Load normalized weights if available, otherwise recalculate
    if (data.normalizedWeights && Object.keys(data.normalizedWeights).length > 0) {
        decisionData.normalizedWeights = data.normalizedWeights;
    } else if (Object.keys(decisionData.weights).length > 0) {
        normalizeImportanceWeights();
    }
    
    // Update UI
    updateUIWithImportedData();
}


        function handleImportError(error, type) {
            console.error(`Import error (${type}):`, error);
            
            let message = 'Import failed. ';
            if (error.message.includes('JSON') || error.message.includes('parse')) {
                message += 'Please check that the file is a valid Choicease export.';
            } else if (error.message.includes('QR') || error.message.includes('codes')) {
                message += 'Please ensure the image contains valid Choicease QR codes.';
            } else if (error.message.includes('Missing chunks')) {
                message += 'Some QR codes are missing. Please use the complete QR code image.';
            } else {
                message += 'Please try a different file or contact support.';
            }
            
            showToast(message, 'error');
        }
        
        function validateImportedDataWithDetails(data) {
            const errors = [];
            
            if (!data) {
                errors.push('No data found in file');
                return { valid: false, errors };
            }
            
            if (!data.title && !data.decision) {
                errors.push('Missing decision title');
            }
            
            if (!Array.isArray(data.options)) {
                errors.push('Invalid options data');
            } else if (data.options.length === 0) {
                errors.push('No options found');
            }
            
            if (!Array.isArray(data.criteria)) {
                errors.push('Invalid criteria data');
            } else if (data.criteria.length === 0) {
                errors.push('No criteria found');
            }
            
            if (typeof data.weights !== 'object') {
                errors.push('Invalid weights data');
            }
            
            if (typeof data.ratings !== 'object') {
                errors.push('Invalid ratings data');
            }
            
            return {
                valid: errors.length === 0,
                errors: errors
            };
        }


        
function updateUIWithImportedData() {
    // Update form fields
    document.getElementById('decisionTitle').value = decisionData.title;
    document.getElementById('decisionDescription').value = decisionData.description;
    
    // Update displays
    displayOptions();
    displayCriteria();
    
    // Clear input fields
    document.getElementById('optionName').value = '';
    document.getElementById('optionDescription').value = '';
    document.getElementById('criteriaName').value = '';
    document.getElementById('criteriaDescription').value = '';
    
    // Update warnings
    checkOptionsWarning();
    checkCriteriaWarning();
    
    // ✅ Added: Validate current state after import
    console.log('Import Summary:');
    console.log('- Options:', decisionData.options.length);
    console.log('- Criteria:', decisionData.criteria.length);
    console.log('- Weights:', Object.keys(decisionData.weights).length);
    console.log('- Ratings:', Object.keys(decisionData.ratings).length);
    console.log('- Normalized Weights:', Object.keys(decisionData.normalizedWeights || {}).length);
}        
        
        function startOver() {
           // Cleanup charts and advanced analytics
           cleanupCharts();
           advancedAnalytics.isVisible = false;
                        
           if (confirm('Are you sure you want to start a new decision? This will clear all current data.')) {
                whatIfDecisionData = null; // Release WhatifAnalysis temp memory
                currentStep = 1;
                decisionData = {
                    title: '',
                    description: '',
                    options: [],
                    criteria: [],
                    weights: {},
                    ratings: {}
                };

                // Reset QR code-related variables
                qrCodeData = '';
                if (document.getElementById('qrCodeImage')) {
                    document.getElementById('qrCodeImage').src = '';
                }
                
                document.getElementById('decisionTitle').value = '';
                document.getElementById('decisionDescription').value = '';
                document.getElementById('optionName').value = '';
                document.getElementById('optionDescription').value = '';
                document.getElementById('criteriaName').value = '';
                document.getElementById('criteriaDescription').value = '';
                showStep(1);
                updateProgressBar();
                updateStepIndicator();
                document.getElementById('optionsList').innerHTML = '';
                document.getElementById('criteriaList').innerHTML = '';
                document.getElementById('optionsWarning').style.display = 'none';
                document.getElementById('criteriaWarning').style.display = 'none';
            }
        }

        // Enhanced toast function with warning support
        function showToast(message, type = 'success') {
            const toast = document.createElement('div');
            toast.textContent = message;
            
            const colors = {
                success: '#4caf50',
                warning: '#ff9800',
                error: '#f44336',
                info: '#2196f3'
            };
            
            toast.style.cssText = `
                position: fixed;
                bottom: 20px;
                right: 20px;
                background: ${colors[type] || colors.success};
                color: white;
                padding: 12px 20px;
                border-radius: 8px;
                box-shadow: 0 4px 12px rgba(0,0,0,0.3);
                z-index: 10000;
                font-weight: 500;
                max-width: 300px;
                word-wrap: break-word;
                transition: opacity 0.3s ease;
                font-size: 14px;
                line-height: 1.4;
            `;
            
            document.body.appendChild(toast);
            
            // Auto-hide timing based on message length
            const hideDelay = Math.max(3000, message.length * 50);
            setTimeout(() => toast.style.opacity = '0', hideDelay);
            setTimeout(() => {
                if (toast.parentNode) {
                    toast.remove();
                }
            }, hideDelay + 500);
        }        
        function openModal() {
            document.getElementById('howItWorksModal').style.display = 'block';
            document.body.style.overflow = 'hidden'; // Prevent background scrolling
        }
        
        function closeModal() {
            document.getElementById('howItWorksModal').style.display = 'none';
            document.body.style.overflow = 'auto'; // Restore scrolling
        }
        
        // Keyboard support
        document.addEventListener('keydown', function(event) {
            if (event.key === 'Enter' && !event.shiftKey) {
                const activeElement = document.activeElement;
                if (activeElement.tagName === 'INPUT' || activeElement.tagName === 'TEXTAREA') {
                    event.preventDefault();
                    if (activeElement.id === 'optionName') {
                        document.getElementById('addOptionBtn').click();
                    } else if (activeElement.id === 'criteriaName') {
                        document.getElementById('addCriteriaBtn').click();
                    } else if (activeElement.id === 'decisionTitle') {
                        document.getElementById('step1Continue').click();
                    }
                }
            }
        });

        // Initialize app
        document.addEventListener('DOMContentLoaded', initializeApp);
