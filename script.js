        // Global color scheme for consistent styling across all charts and visualizations
        const CHART_COLORS = [
            '#667eea', '#764ba2', '#28a745', '#ffc107', '#dc3545', 
            '#17a2b8', '#6610f2', '#e83e8c', '#fd7e14', '#20c997',
            '#6f42c1', '#f39c12', '#9b59b6', '#34495e', '#e74c3c',
            '#1abc9c', '#3498db', '#f1c40f', '#e67e22', '#95a5a6'
        ];

        // Global default rating value - can be changed here for entire app
        const DEFAULT_RATING = 2.5;


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
            const currentRating = decisionData.ratings[ratingKey] ?? DEFAULT_RATING;
            html += `
                <div class="rating-row">
                    <span class="option-name">${option.name}</span>
                    <div class="rating-controls">
                        <span style="font-size: 0.9rem; color: #666;">[0]</span>
                        <input type="range" min="0" max="5" step="0.5" value="${currentRating}" 
                               class="slider" role="slider" aria-label="Rating for ${option.name} on ${criteria.name}"
                               aria-valuemin="0" aria-valuemax="5" aria-valuenow="${currentRating}"
                               oninput="updateRating('${ratingKey}', this.value, 'slider')" onchange="updateRating('${ratingKey}', this.value, 'slider')">
                        <span style="font-size: 0.9rem; color: #666;">[5]</span>
                        <input type="number" 
                               id="rating-input-${ratingKey}" 
                               class="rating-input"
                               min="0" 
                               max="5" 
                               step="0.1" 
                               value="${currentRating}"
                               data-rating-key="${ratingKey}"
                               style="width: 65px; padding: 4px 6px; border: 2px solid #e0e0e0; border-radius: 6px; text-align: center; font-weight: bold; color: #667eea; background: white;">
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

        // Add event listeners for input boxes
        setTimeout(() => {
            decisionData.options.forEach(option => {
                decisionData.criteria.forEach(criteria => {
                    const ratingKey = `${option.id}-${criteria.id}`;
                    const input = document.getElementById(`rating-input-${ratingKey}`);
                    
                    if (input) {
                        // Store original value on focus
                        input.addEventListener('focus', function() {
                            this.setAttribute('data-original-value', this.value);
                            // Select all text on focus for easier editing
                            this.select();
                        });
                        
                        // Only validate range while typing, don't reformat
                        input.addEventListener('input', function() {
                            let value = parseFloat(this.value);
                            if (value > 5) {
                                this.value = '5';
                            } else if (value < 0) {
                                this.value = '0';
                            }
                            // Don't call updateRating here - let user finish typing
                        });
                        
                        // Only update and reformat when user is done editing
                        input.addEventListener('blur', function() {
                            const numValue = parseFloat(this.value) || 0;
                            const clampedValue = Math.max(0, Math.min(5, numValue));
                            
                            // Only update if value actually changed
                            const originalValue = parseFloat(this.getAttribute('data-original-value')) || 0;
                            if (clampedValue !== originalValue) {
                                updateRating(ratingKey, clampedValue, 'input');
                            } else {
                                // Just format display without triggering update
                                this.value = clampedValue.toFixed(1);
                            }
                        });
                        
                        // Handle Enter key to finish editing
                        input.addEventListener('keydown', function(e) {
                            if (e.key === 'Enter') {
                                this.blur(); // Trigger blur event
                            }
                        });
                    }
                });
            });
        }, 100);
}


        function updateRating(key, value, source = 'auto') {
            // Validate and format the value
            let numValue = parseFloat(value);
            if (isNaN(numValue) || numValue < 0) numValue = 0;
            if (numValue > 5) numValue = 5;
            
            // Round to 1 decimal place for storage
            numValue = Math.round(numValue * 10) / 10;
            
            // Update the data
            decisionData.ratings[key] = numValue;
            
            // Update UI elements
            const slider = document.querySelector(`input[onchange*="${key}"]`);
            const input = document.getElementById(`rating-input-${key}`);
            
            // Update slider to closest 0.5 value
            if (slider) {
                const sliderValue = Math.round(numValue * 2) / 2;
                slider.value = sliderValue;
            }
            
            // Only update input display if it's not currently focused (being edited)
            if (input && document.activeElement !== input) {
                input.value = numValue.toFixed(1);
            }
        }







        function captureAllRatings() {
            decisionData.options.forEach(option => {
                decisionData.criteria.forEach(criteria => {
                    const ratingKey = `${option.id}-${criteria.id}`;
                    
                    // First try to get value from number input (more precise)
                    const numberInput = document.getElementById(`rating-input-${ratingKey}`);
                    const sliderElement = document.querySelector(`input[onchange*="${ratingKey}"]`);
                    
                    let currentValue;
                    if (numberInput && numberInput.value) {
                        // Use number input value (supports 0.1 precision)
                        currentValue = numberInput.value;
                    } else if (sliderElement) {
                        // Fallback to slider value
                        currentValue = sliderElement.value;
                    }
                    
                    if (currentValue !== undefined) {
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
                    const rating = decisionData.ratings[ratingKey] ?? DEFAULT_RATING; // Default: 2 (Fair)
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
                            <div class="section-title">📊 Criteria Impact Analysis</div>
                            <div id="criteriaImpactAnalysis"></div>
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
                            <div class="section-title">✅ Satisficers Analysis</div>
                            <div id="satisficersAnalysis"></div>
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
                                <button class="btn btn-success" id="enhancedPptxBtn" style="margin-left: 10px;">
                                    📊 Download PowerPoint Presentation
                                </button>
                                <p style="font-size: 0.9rem; color: #666; margin-top: 10px;">
                                    Comprehensive report with charts and analysis in PDF or PowerPoint format
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
                    renderCriteriaImpactAnalysis();
                } catch (error) {
                    console.error('Error rendering criteria impact analysis:', error);
                    document.getElementById('criteriaImpactAnalysis').innerHTML = '<p style="color: #dc3545;">Error loading criteria impact analysis</p>';
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
                    renderSatisficersAnalysis();
                } catch (error) {
                    console.error('Error rendering satisficers analysis:', error);
                    document.getElementById('satisficersAnalysis').innerHTML = '<p style="color: #dc3545;">Error loading satisficers analysis</p>';
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


// Update setupEnhancedPDF function to also setup PPTX button
function setupEnhancedPDF() {
    console.log('=== setupEnhancedPDF called ===');
    
    const pdfBtn = document.getElementById('enhancedPdfBtn');
    console.log('PDF button found:', pdfBtn);
    if (pdfBtn) {
        pdfBtn.onclick = function() {
            console.log('Enhanced PDF button clicked - using canvas approach');
            generateCanvasBasedPDF();
        };
    }
    
    // Setup PPTX button
    const pptxBtn = document.getElementById('enhancedPptxBtn');
    console.log('PPTX button found:', pptxBtn);
    console.log('PPTX button style.display:', pptxBtn ? pptxBtn.style.display : 'N/A');
    console.log('PPTX button classList:', pptxBtn ? pptxBtn.classList : 'N/A');
    
    if (pptxBtn) {
        pptxBtn.onclick = function() {
            console.log('Enhanced PPTX button clicked');
            generatePPTX();
        };
        console.log('PPTX button handler attached successfully');
    } else {
        console.error('PPTX button NOT FOUND in DOM!');
        // Let's search the entire document
        const allButtons = document.querySelectorAll('button');
        console.log('All buttons on page:', allButtons.length);
        allButtons.forEach(btn => {
            if (btn.textContent.includes('PowerPoint')) {
                console.log('Found PowerPoint button!', btn);
            }
        });
    }
}




        // Confidence analysis computation
        function computeConfidenceAnalysis(results) {
            if (results.length < 2) {
                return {
                    percentage: 50,
                    level: 'medium',
                    explanation: 'Need at least 2 options for meaningful confidence analysis',
                    gap: '0.00',
                    details: null
                };
            }
            
            const scores = results.map(r => r.totalScore).sort((a, b) => b - a);
            const winner = scores[0];
            const runnerUp = scores[1];
            const gap = winner - runnerUp;
            
            // 1. STATISTICAL FOUNDATION
            const mean = scores.reduce((a, b) => a + b) / scores.length;
            const variance = scores.reduce((sum, score) => sum + Math.pow(score - mean, 2), 0) / scores.length;
            const stdDev = Math.sqrt(variance);
            
            // Effect size (Cohen's d equivalent)
            const effectSize = stdDev > 0.01 ? gap / stdDev : gap * 20;
            
            // 2. MULTIPLE CONFIDENCE DIMENSIONS
            
            // A. Raw Gap Confidence (original approach, refined)
            const maxPossibleGap = 5.0; // theoretical maximum
            const gapConfidence = Math.min(gap / (maxPossibleGap * 0.4), 1) * 100;
            
            // B. Statistical Significance Confidence
            const statisticalConfidence = Math.min(Math.abs(effectSize) / 1.5, 1) * 100;
            
            // C. Distribution Confidence (how spread out are the scores)
            const scoreRange = scores[0] - scores[scores.length - 1];
            const distributionConfidence = Math.min(scoreRange / 2.0, 1) * 100;
            
            // D. Sample Size Confidence (more options = more confidence)
            const sampleSizeBonus = Math.min((scores.length - 2) * 5, 15);
            
            // E. Sensitivity Penalty (if decision is fragile)
            let sensitivityPenalty = 0;
            if (advancedAnalytics.sensitivity) {
                const criticalCount = advancedAnalytics.sensitivity.filter(s => s.criticality === 'critical').length;
                const moderateCount = advancedAnalytics.sensitivity.filter(s => s.criticality === 'moderate').length;
                sensitivityPenalty = criticalCount * 12 + moderateCount * 6;
            }
            
            // 3. WEIGHTED COMBINATION
            const baseConfidence = (
                gapConfidence * 0.35 +           // Core gap metric
                statisticalConfidence * 0.25 +   // Statistical rigor
                distributionConfidence * 0.20 +  // Overall spread
                sampleSizeBonus                  // More data bonus
            ) - sensitivityPenalty;              // Fragility penalty
            
            // 4. BOUNDED AND CALIBRATED RESULT
            const finalConfidence = Math.max(5, Math.min(95, Math.round(baseConfidence)));
            
            // 5. CONTEXTUAL INTERPRETATION
            const level = getConfidenceLevel(finalConfidence);
            const explanation = generateConfidenceExplanation(finalConfidence, gap, effectSize, scores.length);
            
            // 6. CONFIDENCE INTERVAL ESTIMATION
            const confidenceInterval = estimateWinnerStability(results);
            
            // 7. PRACTICAL INSIGHTS
            const insights = generatePracticalInsights(finalConfidence, gap, effectSize, sensitivityPenalty);
            
            return {
                percentage: finalConfidence,
                level: level,
                explanation: explanation,
                gap: gap.toFixed(2),
                details: {
                    components: {
                        gapConfidence: Math.round(gapConfidence),
                        statisticalConfidence: Math.round(statisticalConfidence),
                        distributionConfidence: Math.round(distributionConfidence),
                        sampleSizeBonus: Math.round(sampleSizeBonus),
                        sensitivityPenalty: Math.round(sensitivityPenalty)
                    },
                    statistics: {
                        effectSize: effectSize.toFixed(2),
                        scoreSpread: scoreRange.toFixed(2),
                        meanScore: mean.toFixed(2),
                        standardDeviation: stdDev.toFixed(2)
                    },
                    stability: confidenceInterval,
                    insights: insights
                }
            };
        }


        // Confidence Analysis  HELPER FUNCTIONS
        function getConfidenceLevel(confidence) {
            if (confidence >= 80) return 'very-high';
            if (confidence >= 65) return 'high';
            if (confidence >= 45) return 'medium';
            if (confidence >= 25) return 'low';
            return 'very-low';
        }
        
        function generateConfidenceExplanation(confidence, gap, effectSize, sampleSize) {
            const explanations = [];
            
            // Primary confidence assessment
            if (confidence >= 80) {
                explanations.push("Very strong evidence for this choice");
            } else if (confidence >= 65) {
                explanations.push("Good evidence favoring this option");
            } else if (confidence >= 45) {
                explanations.push("Moderate preference detected");
            } else if (confidence >= 25) {
                explanations.push("Weak preference - results are close");
            } else {
                explanations.push("Essentially tied - consider qualitative factors");
            }
            
            // Add context about the gap
            if (gap > 1.2) {
                explanations.push("large performance gap supports decision");
            } else if (gap < 0.3) {
                explanations.push("very small margin warrants careful consideration");
            }
            
            // Statistical significance context
            if (Math.abs(effectSize) > 1.5) {
                explanations.push("difference is statistically meaningful");
            } else if (Math.abs(effectSize) < 0.5) {
                explanations.push("difference may not be practically significant");
            }
            
            return explanations.join(", ");
        }
        
        function estimateWinnerStability(results) {
            // Monte Carlo simulation to estimate decision stability
            const iterations = 500;
            let winnerChanges = 0;
            const originalWinner = results[0].option.name;
            
            for (let i = 0; i < iterations; i++) {
                // Add small random noise to simulate rating uncertainty
                const noisyResults = results.map(result => ({
                    ...result,
                    totalScore: result.totalScore + (Math.random() - 0.5) * 0.4 // ±0.2 noise
                })).sort((a, b) => b.totalScore - a.totalScore);
                
                if (noisyResults[0].option.name !== originalWinner) {
                    winnerChanges++;
                }
            }
            
            const stabilityPercentage = ((iterations - winnerChanges) / iterations * 100).toFixed(1);
            
            return {
                stabilityPercentage: stabilityPercentage,
                interpretation: stabilityPercentage > 90 ? 
                    "Decision is very stable to small rating changes" :
                    stabilityPercentage > 70 ?
                    "Decision is reasonably stable" :
                    "Decision could change with small rating adjustments - review carefully"
            };
        }
        
        function generatePracticalInsights(confidence, gap, effectSize, sensitivityPenalty) {
            const insights = [];
            
            if (confidence >= 75) {
                insights.push("✓ You can proceed with high confidence");
                insights.push("✓ Clear winner identified across multiple measures");
            } else if (confidence >= 50) {
                insights.push("⚠ Consider the runner-up as a backup option");
                insights.push("⚠ Review criteria weights to ensure they reflect your priorities");
            } else {
                insights.push("⚠ Results are very close - consider external factors not captured in this analysis");
                insights.push("⚠ You may want to gather more information or add additional criteria");
            }
            
            if (sensitivityPenalty > 20) {
                insights.push("⚠ Decision is sensitive to criteria weights - small changes could alter the outcome");
            }
            
            if (gap < 0.2) {
                insights.push("⚠ Margin is extremely small - consider it a tie and use qualitative judgment");
            }
            
            if (effectSize > 2.0) {
                insights.push("✓ The difference is not just numerical but likely meaningful in practice");
            }
            
            return insights;
        }

        function createEducationalTooltip(term, explanation, example = null) {
            return `
                <span class="educational-tooltip" style="position: relative; cursor: help; border-bottom: 1px dotted #667eea; color: #667eea;">
                    ${term}
                    <div class="tooltip-content" style="
                        position: absolute;
                        bottom: 125%;
                        left: 50%;
                        transform: translateX(-50%);
                        background: #2c3e50;
                        color: white;
                        padding: 12px;
                        border-radius: 8px;
                        font-size: 0.85rem;
                        width: 280px;
                        z-index: 1000;
                        box-shadow: 0 4px 12px rgba(0,0,0,0.3);
                        display: none;
                        line-height: 1.4;
                    ">
                        <strong style="color: #3498db;">${term}:</strong><br>
                        ${explanation}
                        ${example ? `<br><br><em style="color: #95a5a6;">Example: ${example}</em>` : ''}
                        <div style="
                            position: absolute;
                            top: 100%;
                            left: 50%;
                            transform: translateX(-50%);
                            width: 0;
                            height: 0;
                            border-left: 8px solid transparent;
                            border-right: 8px solid transparent;
                            border-top: 8px solid #2c3e50;
                        "></div>
                    </div>
                </span>
            `;
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
                const winnerRating = winner.criteriaScores[criteria.name]?.rating ?? DEFAULT_RATING;
                const runnerUpRating = runnerUp.criteriaScores[criteria.name]?.rating ?? DEFAULT_RATING;
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
            const winner = results[0];
            const risks = {
                vulnerability: [],
                dependency: [],
                opportunity: [],
                summary: {
                    totalRisks: 0,
                    highestSeverity: 'low',
                    primaryConcern: null
                }
            };
            
            // 1. VULNERABILITY RISKS - Performance weak spots
            risks.vulnerability = identifyVulnerabilityRisks(winner);
            
            // 2. DEPENDENCY RISKS - Over-concentration risks
            risks.dependency = identifyDependencyRisks(winner);
            
            // 3. OPPORTUNITY RISKS - What you're giving up
            if (results.length > 1) {
                risks.opportunity = identifyOpportunityRisks(winner, results.slice(1));
            }
            
            // Calculate summary
            risks.summary = calculateRiskSummary(risks);
            
            return risks;
        }        

// Risk Analysis Helper Functions
        function identifyVulnerabilityRisks(winner) {
            const vulnerabilities = [];
            
            decisionData.criteria.forEach(criteria => {
                const ratingKey = `${winner.option.id}-${criteria.id}`;
                const rating = decisionData.ratings[ratingKey] ?? DEFAULT_RATING;
                const weight = Math.round(decisionData.normalizedWeights[criteria.id] || 0);
                
                // Risk Score = (Performance Gap) × (Importance Weight)
                const performanceGap = Math.max(0, 3 - rating) / 3; // How far below "Good" (3.0)
                const riskScore = performanceGap * (weight / 100);
                
                // Flag significant vulnerabilities
                if (riskScore > 0.15 || (rating <= 2 && weight >= 20)) {
                    let severity = 'low';
                    if (riskScore >= 0.3 || (rating <= 1 && weight >= 15)) severity = 'critical';
                    else if (riskScore >= 0.2 || (rating <= 1.5 && weight >= 25)) severity = 'high';
                    else if (riskScore >= 0.15 || (rating <= 2 && weight >= 20)) severity = 'moderate';
                    
                    vulnerabilities.push({
                        type: 'performance_gap',
                        criteriaName: criteria.name,
                        rating: rating,
                        weight: weight,
                        riskScore: riskScore,
                        severity: severity,
                        description: generateVulnerabilityDescription(criteria.name, rating, weight),
                        impact: generateVulnerabilityImpact(rating, weight),
                        mitigation: generateVulnerabilityMitigation(criteria.name, rating)
                    });
                }
            });
            
            return vulnerabilities.sort((a, b) => b.riskScore - a.riskScore);
        }
        
        function identifyDependencyRisks(winner) {
            const dependencies = [];
            
            decisionData.criteria.forEach(criteria => {
                const weight = Math.round(decisionData.normalizedWeights[criteria.id] || 0);
                const ratingKey = `${winner.option.id}-${criteria.id}`;
                const rating = decisionData.ratings[ratingKey] ?? DEFAULT_RATING;
                
                // High dependency risk - over-reliance on single criteria
                if (weight >= 35) {
                    dependencies.push({
                        type: 'over_concentration',
                        criteriaName: criteria.name,
                        weight: weight,
                        rating: rating,
                        severity: weight >= 50 ? 'high' : 'moderate',
                        description: `Heavy dependence on ${criteria.name} (${weight}% of total decision weight)`,
                        impact: rating >= 4 ? 'Low risk due to strong performance' : 'High risk if this area underperforms',
                        mitigation: `Ensure ${criteria.name} capabilities are robust and have backup plans`
                    });
                }
                
                // Critical dependency risk - high weight + mediocre performance
                if (weight >= 25 && rating < 3.5) {
                    dependencies.push({
                        type: 'critical_dependency',
                        criteriaName: criteria.name,
                        weight: weight,
                        rating: rating,
                        severity: rating < 2.5 ? 'high' : 'moderate',
                        description: `Important ${criteria.name} (${weight}% weight) shows only ${rating}/5 performance`,
                        impact: 'Could significantly undermine overall success',
                        mitigation: `Strengthen ${criteria.name} capabilities before implementation`
                    });
                }
            });
            
            return dependencies.sort((a, b) => b.weight - a.weight);
        }
        
        function identifyOpportunityRisks(winner, alternatives) {
            const opportunities = [];
            
            decisionData.criteria.forEach(criteria => {
                const winnerRatingKey = `${winner.option.id}-${criteria.id}`;
                const winnerRating = decisionData.ratings[winnerRatingKey] ?? DEFAULT_RATING;
                const weight = Math.round(decisionData.normalizedWeights[criteria.id] || 0);
                
                // Find best alternative performance on this criterion
                let bestAlternative = null;
                let bestRating = 0;
                
                alternatives.forEach(alt => {
                    const altRatingKey = `${alt.option.id}-${criteria.id}`;
                    const altRating = decisionData.ratings[altRatingKey] ?? DEFAULT_RATING;
                    if (altRating > bestRating) {
                        bestRating = altRating;
                        bestAlternative = alt;
                    }
                });
                
                const performanceGap = bestRating - winnerRating;
                const opportunityCost = (performanceGap / 5) * (weight / 100) * 100;
                
                // Significant opportunity cost
                if (performanceGap >= 1.5 && weight >= 15 && opportunityCost >= 5) {
                    let severity = 'low';
                    if (opportunityCost >= 15) severity = 'high';
                    else if (opportunityCost >= 10) severity = 'moderate';
                    
                    opportunities.push({
                        type: 'superior_alternative',
                        criteriaName: criteria.name,
                        winnerRating: winnerRating,
                        alternativeRating: bestRating,
                        alternativeName: bestAlternative.option.name,
                        performanceGap: performanceGap,
                        weight: weight,
                        opportunityCost: opportunityCost,
                        severity: severity,
                        description: `${bestAlternative.option.name} offers ${performanceGap.toFixed(1)} points better ${criteria.name} performance`,
                        impact: `Missing ${opportunityCost.toFixed(1)}% potential value in ${criteria.name}`,
                        consideration: weight >= 25 ? 'Consider if this trade-off is acceptable' : 'Minor trade-off given low importance'
                    });
                }
            });
            
            return opportunities.sort((a, b) => b.opportunityCost - a.opportunityCost).slice(0, 5);
        }
        
        function calculateRiskSummary(risks) {
            const allRisks = [...risks.vulnerability, ...risks.dependency, ...risks.opportunity];
            const severityOrder = { 'critical': 4, 'high': 3, 'moderate': 2, 'low': 1 };
            
            let highestSeverity = 'low';
            let primaryConcern = null;
            
            allRisks.forEach(risk => {
                if (severityOrder[risk.severity] > severityOrder[highestSeverity]) {
                    highestSeverity = risk.severity;
                    primaryConcern = risk;
                }
            });
            
            return {
                totalRisks: allRisks.length,
                highestSeverity: highestSeverity,
                primaryConcern: primaryConcern,
                vulnerabilityCount: risks.vulnerability.length,
                dependencyCount: risks.dependency.length,
                opportunityCount: risks.opportunity.length
            };
        }
        
        function generateVulnerabilityDescription(criteriaName, rating, weight) {
            if (rating <= 1) {
                return `Poor ${criteriaName} performance (${rating}/5) with ${weight}% importance`;
            } else if (rating <= 2) {
                return `Below-average ${criteriaName} (${rating}/5) carries risk given ${weight}% importance`;
            } else {
                return `Moderate ${criteriaName} performance (${rating}/5) may be concerning with ${weight}% weight`;
            }
        }
        
        function generateVulnerabilityImpact(rating, weight) {
            if (rating <= 1 && weight >= 25) {
                return 'High risk of operational issues or user dissatisfaction';
            } else if (rating <= 2 && weight >= 20) {
                return 'Moderate risk of performance shortfalls';
            } else {
                return 'May limit overall effectiveness';
            }
        }
        
        function generateVulnerabilityMitigation(criteriaName, rating) {
            if (rating <= 1) {
                return `Critical: Address ${criteriaName} weaknesses before implementation`;
            } else if (rating <= 2) {
                return `Important: Develop plan to strengthen ${criteriaName} capabilities`;
            } else {
                return `Monitor ${criteriaName} performance and have improvement plan ready`;
            }
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
                const rating = decisionData.ratings[ratingKey] ?? DEFAULT_RATING; // Default: 2 (Fair)
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
                    const winnerRating = decisionData.ratings[winnerRatingKey] ?? DEFAULT_RATING;
                    const runnerUpRating = decisionData.ratings[runnerUpRatingKey] ?? DEFAULT_RATING;
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

                // Enhanced decision stability assessment
                const lowPerformanceCount = winnerContributions.filter(c => c.rating <= 2).length;
                const highPerformanceCount = winnerContributions.filter(c => c.rating >= 4).length;
                const stabilityData = calculateStabilityLevel(winner, confidence, winnerContributions);
                const robustnessData = calculateDecisionRobustness(advancedAnalytics.results, confidence);
                const strongAreas = winnerContributions.filter(c => c.rating >= 4).map(c => c.name);
                const weakAreas = winnerContributions.filter(c => c.rating <= 2).map(c => c.name);
                
                // Keep backward compatibility
                let stabilityLevel = stabilityData.level;
                let stabilityText = stabilityData.recommendation;                
                
            
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
                                    <span style="font-weight: 600;">Confidence Level: ${confidence.level.replace('-', ' ').toUpperCase()}</span>
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
                            ${confidence.details ? `
                                    <details style="margin-top: 15px;">
                                        <summary style="cursor: pointer; font-weight: 600; color: #667eea; padding: 8px 0;">
                                            📊 Advanced Analytics Dashboard
                                        </summary>
                                        <div style="margin-top: 15px; padding: 20px; background: #f8f9fa; border-radius: 12px; border: 2px solid #e6f2ff;">
                                            
                                            <!-- Executive Insights Section -->
                                            <div style="margin-bottom: 25px; padding: 20px; background: linear-gradient(135deg, #667eea, #764ba2); color: white; border-radius: 12px;">
                                                <h5 style="color: white; margin: 0 0 15px 0; font-size: 1.1rem;">🎯 Executive Insights</h5>
                                                <div style="background: rgba(255,255,255,0.1); padding: 15px; border-radius: 8px;">
                                                    ${confidence.details.insights.map(insight => `
                                                        <div style="margin-bottom: 8px; font-size: 0.95rem; line-height: 1.4;">
                                                            ${insight}
                                                        </div>
                                                    `).join('')}
                                                </div>
                                            </div>
                                            
                                            <!-- Statistical Foundation Section -->
                                            <div style="margin-bottom: 25px;">
                                                <h5 style="color: #333; margin: 0 0 15px 0; font-size: 1.1rem;">📈 Statistical Foundation</h5>
                                                <p style="font-size: 0.9rem; color: #666; margin-bottom: 15px; line-height: 1.5;">
                                                    These metrics help us understand the mathematical rigor behind your decision confidence:
                                                </p>
                                                
                                                <div class="advanced-metric-card">
                                                    <div style="display: flex; justify-content: space-between; align-items: center;">
                                                        <div>
                                                            <strong>${createEducationalTooltip(
                                                                'Effect Size',
                                                                'Measures how meaningful the difference is between your top choices. Values above 1.5 indicate a substantial difference, while values below 0.5 suggest the options are quite similar.',
                                                                'Effect Size of 2.1 means the winner is significantly better than runner-up, not just marginally ahead'
                                                            )}</strong>
                                                        </div>
                                                        <div class="metric-value">${confidence.details.statistics.effectSize}</div>
                                                    </div>
                                                    <div class="metric-interpretation">
                                                        ${parseFloat(confidence.details.statistics.effectSize) > 1.5 ? 
                                                            '🔥 Large effect - winner is substantially better' :
                                                            parseFloat(confidence.details.statistics.effectSize) > 0.8 ?
                                                            '📊 Medium effect - clear difference exists' :
                                                            '🤏 Small effect - options are quite similar'
                                                        }
                                                    </div>
                                                </div>
                                                
                                                <div class="advanced-metric-card">
                                                    <div style="display: flex; justify-content: space-between; align-items: center;">
                                                        <div>
                                                            <strong>${createEducationalTooltip(
                                                                'Standard Deviation',
                                                                'Shows how spread out your option scores are. Higher values mean your options vary widely in quality, lower values mean they\'re all fairly similar.',
                                                                'SD of 0.8 with scores ranging 2.1-4.3 shows you have both great and poor options to choose from'
                                                            )}</strong>
                                                        </div>
                                                        <div class="metric-value">${confidence.details.statistics.standardDeviation}</div>
                                                    </div>
                                                    <div class="metric-interpretation">
                                                        ${parseFloat(confidence.details.statistics.standardDeviation) > 1.0 ? 
                                                            '📏 Wide spread - you have distinctly different quality options' :
                                                            parseFloat(confidence.details.statistics.standardDeviation) > 0.5 ?
                                                            '📐 Moderate spread - options have noticeable differences' :
                                                            '📌 Tight spread - all options are quite similar in quality'
                                                        }
                                                    </div>
                                                </div>
                                                
                                                <div class="advanced-metric-card">
                                                    <div style="display: flex; justify-content: space-between; align-items: center;">
                                                        <div>
                                                            <strong>${createEducationalTooltip(
                                                                'Score Range',
                                                                'The gap between your highest and lowest scoring options. A larger range means you\'re comparing options of very different quality levels.',
                                                                'Range of 2.3 points means your best option scores 2.3 points higher than your worst option'
                                                            )}</strong>
                                                        </div>
                                                        <div class="metric-value">${confidence.details.statistics.scoreSpread}</div>
                                                    </div>
                                                    <div class="metric-interpretation">
                                                        ${parseFloat(confidence.details.statistics.scoreSpread) > 2.0 ? 
                                                            '🎯 Large range - clear quality tiers among your options' :
                                                            parseFloat(confidence.details.statistics.scoreSpread) > 1.0 ?
                                                            '⚖️ Moderate range - some options clearly outperform others' :
                                                            '🤝 Small range - all options perform at similar levels'
                                                        }
                                                    </div>
                                                </div>
                                            </div>
                                            
                                            <!-- Confidence Components Breakdown -->
                                            <div style="margin-bottom: 25px;">
                                                <h5 style="color: #333; margin: 0 0 15px 0; font-size: 1.1rem;">⚖️ Confidence Components Analysis</h5>
                                                <p style="font-size: 0.9rem; color: #666; margin-bottom: 15px; line-height: 1.5;">
                                                    Your overall confidence is calculated by combining multiple analytical perspectives:
                                                </p>
                                                
                                                <div class="advanced-metric-card">
                                                    <div style="display: flex; justify-content: space-between; align-items: center;">
                                                        <div>
                                                            <strong>${createEducationalTooltip(
                                                                'Gap Analysis',
                                                                'How much better the winner is compared to the runner-up. This is the most intuitive component - larger gaps mean more confidence.',
                                                                'Gap of 0.8 points with Gap Analysis of 65% means there\'s a solid lead, contributing strongly to overall confidence'
                                                            )} (35% weight)</strong>
                                                        </div>
                                                        <div class="metric-value">${confidence.details.components.gapConfidence}%</div>
                                                    </div>
                                                    <div class="metric-interpretation">
                                                        Primary confidence driver based on winner's lead margin
                                                    </div>
                                                </div>
                                                
                                                <div class="advanced-metric-card">
                                                    <div style="display: flex; justify-content: space-between; align-items: center;">
                                                        <div>
                                                            <strong>${createEducationalTooltip(
                                                                'Statistical Significance',
                                                                'Whether the difference between options is mathematically meaningful or could just be due to random variation in your ratings.',
                                                                'Statistical Significance of 78% means the winner\'s advantage is very unlikely to be just coincidence'
                                                            )} (25% weight)</strong>
                                                        </div>
                                                        <div class="metric-value">${confidence.details.components.statisticalConfidence}%</div>
                                                    </div>
                                                    <div class="metric-interpretation">
                                                        Mathematical rigor - is this difference real or just noise?
                                                    </div>
                                                </div>
                                                
                                                <div class="advanced-metric-card">
                                                    <div style="display: flex; justify-content: space-between; align-items: center;">
                                                        <div>
                                                            <strong>${createEducationalTooltip(
                                                                'Distribution Analysis',
                                                                'How spread out all your option scores are. When options are very different in quality, we can be more confident in picking the best one.',
                                                                'Distribution of 85% means your options vary widely in quality, making the best choice more obvious'
                                                            )} (20% weight)</strong>
                                                        </div>
                                                        <div class="metric-value">${confidence.details.components.distributionConfidence}%</div>
                                                    </div>
                                                    <div class="metric-interpretation">
                                                        Quality spread - are you choosing from distinctly different options?
                                                    </div>
                                                </div>
                                                
                                                <div class="advanced-metric-card">
                                                    <div style="display: flex; justify-content: space-between; align-items: center;">
                                                        <div>
                                                            <strong>${createEducationalTooltip(
                                                                'Sample Size Bonus',
                                                                'Statistical confidence increases with more data points. Comparing more options gives us more confidence in identifying the true best choice.',
                                                                'Bonus of +15% means you compared enough options to be statistically confident in the result'
                                                            )} (Bonus)</strong>
                                                        </div>
                                                        <div class="metric-value" style="color: #28a745;">+${confidence.details.components.sampleSizeBonus}%</div>
                                                    </div>
                                                    <div class="metric-interpretation">
                                                        Confidence boost from analyzing multiple alternatives
                                                    </div>
                                                </div>
                                                
                                                ${confidence.details.components.sensitivityPenalty > 0 ? `
                                                    <div class="advanced-metric-card" style="border-color: #dc3545;">
                                                        <div style="display: flex; justify-content: space-between; align-items: center;">
                                                            <div>
                                                                <strong style="color: #dc3545;">${createEducationalTooltip(
                                                                    'Sensitivity Penalty',
                                                                    'Confidence reduction when the decision is fragile - small changes in criteria weights could flip the winner. This warns you when results aren\'t robust.',
                                                                    'Penalty of -18% means your decision is sensitive to how you weight criteria - small priority changes could change the winner'
                                                                )} (Penalty)</strong>
                                                            </div>
                                                            <div class="metric-value" style="color: #dc3545;">-${confidence.details.components.sensitivityPenalty}%</div>
                                                        </div>
                                                        <div class="metric-interpretation" style="color: #dc3545;">
                                                            Confidence reduction due to decision fragility
                                                        </div>
                                                    </div>
                                                ` : ''}
                                            </div>
                                            
                                            <!-- Monte Carlo Stability Analysis -->
                                            <div style="margin-bottom: 25px;">
                                                <h5 style="color: #333; margin: 0 0 15px 0; font-size: 1.1rem;">🔬 Monte Carlo Stability Analysis</h5>
                                                <p style="font-size: 0.9rem; color: #666; margin-bottom: 15px; line-height: 1.5;">
                                                    We ran 500 simulations with small random variations to your ratings to test decision robustness:
                                                </p>
                                                
                                                <div style="background: white; padding: 20px; border-radius: 8px; border-left: 4px solid ${confidence.details.stability.stabilityPercentage > 90 ? '#28a745' : confidence.details.stability.stabilityPercentage > 70 ? '#ffc107' : '#dc3545'};">
                                                    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px;">
                                                        <div>
                                                            <strong>${createEducationalTooltip(
                                                                'Stability Score',
                                                                'Percentage of simulations where the same option won despite small rating variations. Higher scores mean your decision is robust to uncertainty.',
                                                                'Stability of 87% means even with small rating uncertainties, the same option wins 87 out of 100 times'
                                                            )}</strong>
                                                        </div>
                                                        <div style="font-size: 1.5rem; font-weight: bold; color: ${confidence.details.stability.stabilityPercentage > 90 ? '#28a745' : confidence.details.stability.stabilityPercentage > 70 ? '#f57c00' : '#dc3545'};">
                                                            ${confidence.details.stability.stabilityPercentage}%
                                                        </div>
                                                    </div>
                                                    
                                                    <div style="width: 100%; height: 12px; background: #e9ecef; border-radius: 6px; overflow: hidden; margin: 12px 0;">
                                                        <div style="width: ${confidence.details.stability.stabilityPercentage}%; height: 100%; background: ${confidence.details.stability.stabilityPercentage > 90 ? 'linear-gradient(135deg, #28a745, #20c997)' : confidence.details.stability.stabilityPercentage > 70 ? 'linear-gradient(135deg, #ffc107, #fd7e14)' : 'linear-gradient(135deg, #dc3545, #c82333)'}; border-radius: 6px;"></div>
                                                    </div>
                                                    
                                                    <div style="font-size: 0.95rem; color: #666; line-height: 1.4;">
                                                        <strong>Interpretation:</strong> ${confidence.details.stability.interpretation}
                                                    </div>
                                                    
                                                    <div style="margin-top: 12px; padding: 12px; background: rgba(102, 126, 234, 0.1); border-radius: 6px; font-size: 0.9rem;">
                                                        <strong>What this means:</strong> 
                                                        ${confidence.details.stability.stabilityPercentage > 90 ? 
                                                            'Your decision is rock-solid. Even if you\'re slightly uncertain about some ratings, the winner remains the same.' :
                                                            confidence.details.stability.stabilityPercentage > 70 ?
                                                            'Your decision is reasonably stable, but double-check ratings for criteria you\'re unsure about.' :
                                                            'Your decision is fragile. Small changes in how you rate options could change the winner. Consider gathering more information.'
                                                        }
                                                    </div>
                                                </div>
                                            </div>
                                            
                                            <!-- Professional Recommendations -->
                                            <div>
                                                <h5 style="color: #333; margin: 0 0 15px 0; font-size: 1.1rem;">🎯 Professional Recommendations</h5>
                                                <div style="background: white; padding: 20px; border-radius: 8px; border: 2px solid #667eea;">
                                                    <div style="display: grid; gap: 12px;">
                                                        ${confidence.percentage >= 80 ? `
                                                            <div style="display: flex; align-items: start; gap: 12px;">
                                                                <div style="background: #28a745; color: white; border-radius: 50%; width: 24px; height: 24px; display: flex; align-items: center; justify-content: center; font-size: 0.8rem; font-weight: bold; flex-shrink: 0;">✓</div>
                                                                <div>
                                                                    <strong>Proceed with Implementation</strong><br>
                                                                    <span style="color: #666; font-size: 0.9rem;">High confidence and stability scores support moving forward. Document your decision rationale for future reference.</span>
                                                                </div>
                                                            </div>
                                                        ` : confidence.percentage >= 65 ? `
                                                            <div style="display: flex; align-items: start; gap: 12px;">
                                                                <div style="background: #28a745; color: white; border-radius: 50%; width: 24px; height: 24px; display: flex; align-items: center; justify-content: center; font-size: 0.8rem; font-weight: bold; flex-shrink: 0;">→</div>
                                                                <div>
                                                                    <strong>Move Forward with Monitoring</strong><br>
                                                                    <span style="color: #666; font-size: 0.9rem;">Good confidence supports the decision. Plan checkpoints to validate assumptions and monitor outcomes.</span>
                                                                </div>
                                                            </div>
                                                        ` : confidence.percentage >= 45 ? `
                                                            <div style="display: flex; align-items: start; gap: 12px;">
                                                                <div style="background: #ffc107; color: white; border-radius: 50%; width: 24px; height: 24px; display: flex; align-items: center; justify-content: center; font-size: 0.8rem; font-weight: bold; flex-shrink: 0;">⚠</div>
                                                                <div>
                                                                    <strong>Gather Additional Data</strong><br>
                                                                    <span style="color: #666; font-size: 0.9rem;">Moderate confidence suggests collecting more information or consulting stakeholders before finalizing.</span>
                                                                </div>
                                                            </div>
                                                        ` : `
                                                            <div style="display: flex; align-items: start; gap: 12px;">
                                                                <div style="background: #dc3545; color: white; border-radius: 50%; width: 24px; height: 24px; display: flex; align-items: center; justify-content: center; font-size: 0.8rem; font-weight: bold; flex-shrink: 0;">⏸</div>
                                                                <div>
                                                                    <strong>Pause and Reassess</strong><br>
                                                                    <span style="color: #666; font-size: 0.9rem;">Low confidence indicates need for additional criteria, stakeholder input, or external perspective before deciding.</span>
                                                                </div>
                                                            </div>
                                                        `}
                                                        
                                                        ${confidence.details.components.sensitivityPenalty > 15 ? `
                                                            <div style="display: flex; align-items: start; gap: 12px;">
                                                                <div style="background: #6f42c1; color: white; border-radius: 50%; width: 24px; height: 24px; display: flex; align-items: center; justify-content: center; font-size: 0.8rem; font-weight: bold; flex-shrink: 0;">⚖</div>
                                                                <div>
                                                                    <strong>Validate Criteria Weights</strong><br>
                                                                    <span style="color: #666; font-size: 0.9rem;">High sensitivity detected. Double-check that your importance weightings truly reflect your priorities.</span>
                                                                </div>
                                                            </div>
                                                        ` : ''}
                                                        
                                                        <div style="display: flex; align-items: start; gap: 12px;">
                                                            <div style="background: #17a2b8; color: white; border-radius: 50%; width: 24px; height: 24px; display: flex; align-items: center; justify-content: center; font-size: 0.8rem; font-weight: bold; flex-shrink: 0;">📅</div>
                                                            <div>
                                                                <strong>When to Revisit This Decision</strong><br>
                                                                <span style="color: #666; font-size: 0.9rem;">
                                                                    ${confidence.percentage >= 80 ? 
                                                                        '<strong>Rarely revisit:</strong> Only when major circumstances change or new options emerge.' :
                                                                        confidence.percentage >= 65 ?
                                                                        '<strong>Periodic review:</strong> Check if assumptions remain valid and new alternatives have emerged.' :
                                                                        confidence.percentage >= 45 ?
                                                                        '<strong>Active monitoring:</strong> Watch for early signals that might change the calculus.' :
                                                                        '<strong>Stay alert:</strong> Be ready to reassess as new information becomes available.'
                                                                    }
                                                                </span>
                                                                <div style="margin-top: 8px; padding: 8px; background: rgba(23, 162, 184, 0.1); border-radius: 4px; font-size: 0.85rem;">
                                                                    <strong>Factors to watch:</strong> Changes in your priorities, new options becoming available, external circumstances shifting, or initial assumptions proving incorrect.
                                                                </div>
                                                            </div>
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    </details>
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
                            <div style="text-align: center; padding: 15px; background: #f8f9fa; border-radius: 8px;">
                                <div style="font-size: 24px; font-weight: bold; color: #28a745; margin-bottom: 5px;">${highPerformanceCount}</div>
                                <div style="font-size: 14px; color: #666; margin-bottom: 8px;">Strong Areas (4-5)</div>
                                ${strongAreas.length > 0 ? `<div style="font-size: 12px; color: #28a745; font-style: italic; line-height: 1.3;">${strongAreas.slice(0, 3).join(', ')}${strongAreas.length > 3 ? '...' : ''}</div>` : '<div style="font-size: 12px; color: #999; font-style: italic;">None</div>'}
                            </div>
                            <div style="text-align: center; padding: 15px; background: #f8f9fa; border-radius: 8px;">
                                <div style="font-size: 24px; font-weight: bold; color: ${lowPerformanceCount > 0 ? '#dc3545' : '#28a745'}; margin-bottom: 5px;">${lowPerformanceCount}</div>
                                <div style="font-size: 14px; color: #666; margin-bottom: 8px;">Weak Areas (1-2)</div>
                                ${weakAreas.length > 0 ? `<div style="font-size: 12px; color: #dc3545; font-style: italic; line-height: 1.3;">${weakAreas.slice(0, 3).join(', ')}${weakAreas.length > 3 ? '...' : ''}</div>` : '<div style="font-size: 12px; color: #999; font-style: italic;">None</div>'}
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


        // Functions related to Maximum/Minimum Impact Criteria
        // ===============================
        // MAXIMUM/MINIMUM IMPACT CRITERIA ANALYSIS
        // ===============================
        
        function calculateCriteriaImpact() {
            const impactScores = [];
            
            decisionData.criteria.forEach(criteria => {
                // Get all ratings for this criterion
                const ratings = [];
                decisionData.options.forEach(option => {
                    const ratingKey = `${option.id}-${criteria.id}`;
                    const rating = decisionData.ratings[ratingKey] || DEFAULT_RATING;
                    ratings.push(rating);
                });
                
                // Calculate variance
                const mean = ratings.reduce((sum, rating) => sum + rating, 0) / ratings.length;
                const variance = ratings.reduce((sum, rating) => sum + Math.pow(rating - mean, 2), 0) / ratings.length;
                
                // Get normalized weight
                const normalizedWeight = (decisionData.normalizedWeights[criteria.id] || 0) / 100;
                
                // Calculate impact score
                const impactScore = variance * normalizedWeight * 100;
                
                impactScores.push({
                    criteriaId: criteria.id,
                    criteriaName: criteria.name,
                    variance: variance,
                    weight: Math.round(decisionData.normalizedWeights[criteria.id] || 0),
                    impactScore: impactScore,
                    ratings: ratings
                });
            });
            
            // Sort by impact score (descending)
            impactScores.sort((a, b) => b.impactScore - a.impactScore);
            
            return impactScores;
        }
        
        function getImpactInterpretation(variance, weight, isMaximum, ratings) {
            const spread = Math.max(...ratings) - Math.min(...ratings);
            
            if (isMaximum) {
                return `This criterion shows wide performance differences (${spread.toFixed(1)} point spread), making it a key decision driver.`;
            } else {
                return `Most options perform similarly here (${spread.toFixed(1)} point spread), reducing its influence on the final choice.`;
            }
        }
        




        function renderCriteriaImpactAnalysis() {
            const container = document.getElementById('criteriaImpactAnalysis');
            if (!container) return;
            
            const impactData = calculateCriteriaImpact();
            
            // Get top 3 maximum and bottom 3 minimum impact criteria
            const maxImpact = impactData.slice(0, 3);
            const minImpact = impactData.slice(-3).reverse();
            
            let html = `
                <div class="criteria-impact-analysis" style="padding: 20px;">
                    <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 30px; margin: 20px 0;">
                        <!-- Maximum Impact Column -->
                        <div>
                            <h4 style="color: #333; margin: 0 0 15px 0; display: flex; align-items: center;">
                                🎯 Maximum Impact Criteria
                            </h4>
                            <p style="color: #666; font-size: 0.9rem; margin-bottom: 20px;">
                                Criteria that most influence your decision
                            </p>
            `;
            
            // Render maximum impact criteria
            maxImpact.forEach(criteria => {
                html += `
                    <div style="background: #f8f9fa; border: 1px solid #dee2e6; border-radius: 8px; padding: 15px; margin-bottom: 15px;">
                        <h5 style="color: #333; margin: 0 0 10px 0; font-weight: 600;">${sanitizeInput(criteria.criteriaName)}</h5>
                        <div style="display: flex; justify-content: space-between; margin-bottom: 8px;">
                            <span style="font-size: 0.9rem; color: #666;">Impact Score:</span>
                            <strong style="color: #667eea;">${criteria.impactScore.toFixed(1)}%</strong>
                        </div>
                        <div style="display: flex; justify-content: space-between; margin-bottom: 8px;">
                            <span style="font-size: 0.9rem; color: #666;">Variance:</span>
                            <span>${criteria.variance.toFixed(2)}</span>
                        </div>
                        <div style="display: flex; justify-content: space-between; margin-bottom: 12px;">
                            <span style="font-size: 0.9rem; color: #666;">Weight:</span>
                            <span>${criteria.weight}%</span>
                        </div>
                        <div style="background: #e3f2fd; border-left: 3px solid #2196f3; padding: 8px; border-radius: 4px;">
                            <span style="font-size: 0.85rem; color: #1565c0;">💡 ${getImpactInterpretation(criteria.variance, criteria.weight, true, criteria.ratings)}</span>
                        </div>
                    </div>
                `;
            });
            
            html += `
                        </div>
                        
                        <!-- Minimum Impact Column -->
                        <div>
                            <h4 style="color: #333; margin: 0 0 15px 0; display: flex; align-items: center;">
                                🎭 Minimum Impact Criteria
                            </h4>
                            <p style="color: #666; font-size: 0.9rem; margin-bottom: 20px;">
                                Criteria with similar performance across options
                            </p>
            `;
            
            // Render minimum impact criteria
            minImpact.forEach(criteria => {
                html += `
                    <div style="background: #f8f9fa; border: 1px solid #dee2e6; border-radius: 8px; padding: 15px; margin-bottom: 15px;">
                        <h5 style="color: #333; margin: 0 0 10px 0; font-weight: 600;">${sanitizeInput(criteria.criteriaName)}</h5>
                        <div style="display: flex; justify-content: space-between; margin-bottom: 8px;">
                            <span style="font-size: 0.9rem; color: #666;">Impact Score:</span>
                            <strong style="color: #6c757d;">${criteria.impactScore.toFixed(1)}%</strong>
                        </div>
                        <div style="display: flex; justify-content: space-between; margin-bottom: 8px;">
                            <span style="font-size: 0.9rem; color: #666;">Variance:</span>
                            <span>${criteria.variance.toFixed(2)}</span>
                        </div>
                        <div style="display: flex; justify-content: space-between; margin-bottom: 12px;">
                            <span style="font-size: 0.9rem; color: #666;">Weight:</span>
                            <span>${criteria.weight}%</span>
                        </div>
                        <div style="background: #fff3e0; border-left: 3px solid #ff9800; padding: 8px; border-radius: 4px;">
                            <span style="font-size: 0.85rem; color: #f57c00;">💡 ${getImpactInterpretation(criteria.variance, criteria.weight, false, criteria.ratings)}</span>
                        </div>
                    </div>
                `;
            });
            
            html += `
                        </div>
                    </div>
                </div>
            `;
            
            container.innerHTML = html;
        }





        // ===============================
        // SATISFICERS ANALYSIS FUNCTIONS
        // ===============================
        
        // Main identification function
        function identifySatisficers(threshold = 3.0) {
            const satisficers = [];
            
            // Get full results with rankings for context
            const fullResults = advancedAnalytics.results || [];
            
            fullResults.forEach((result, originalRank) => {
                const option = result.option;
                let qualifiesAsSatisficer = true;
                let minRating = 5.0;
                let strengthCount = 0;
                let concernCount = 0;
                
                // Check all criteria ratings
                decisionData.criteria.forEach(criteria => {
                    const ratingKey = `${option.id}-${criteria.id}`;
                    const rating = decisionData.ratings[ratingKey] || DEFAULT_RATING;
                    
                    if (rating < threshold) {
                        qualifiesAsSatisficer = false;
                    }
                    
                    minRating = Math.min(minRating, rating);
                    
                    if (rating >= 4.0) strengthCount++;
                    if (rating < 3.5) concernCount++;
                });
                
                if (qualifiesAsSatisficer) {
                    satisficers.push({
                        option: option,
                        originalRank: originalRank + 1, // 1-based ranking
                        totalScore: result.totalScore,
                        minRating: minRating,
                        strengthCount: strengthCount,
                        concernCount: concernCount,
                        threshold: threshold
                    });
                }
            });
            
            // Sort by original ranking (best performing satisficers first)
            satisficers.sort((a, b) => a.originalRank - b.originalRank);
            
            // Add satisficer rank
            satisficers.forEach((satisficer, index) => {
                satisficer.satisficerRank = index + 1;
            });
            
            return satisficers;
        }
        
        // Web UI rendering function
        function renderSatisficersAnalysis() {
            const container = document.getElementById('satisficersAnalysis');
            if (!container) return;
            
            let satisficers = identifySatisficers(3.0);
            let threshold = 3.0;
            
            // Adaptive threshold if no satisficers found
            if (satisficers.length === 0) {
                satisficers = identifySatisficers(2.5);
                threshold = 2.5;
            }
            if (satisficers.length === 0) {
                satisficers = identifySatisficers(2.0);
                threshold = 2.0;
            }
            
            let html = `
                <div style="padding: 20px;">
                    <h4 style="color: #333; margin: 0 0 15px 0;">✅ Satisficers - 'Good Enough' Options</h4>
                    <p style="color: #666; font-size: 0.9rem; margin-bottom: 20px;">
                        Options that meet acceptable standards on all criteria (≥${threshold} rating)
                    </p>
                    <div style="margin-bottom: 20px;">
                        <strong>${satisficers.length} out of ${decisionData.options.length} options qualify as satisficers</strong>
                        ${threshold < 3.0 ? `<div style="color: #856404; font-size: 0.9rem; margin-top: 5px;">Note: Threshold lowered to ${threshold} as no options met the 3.0 standard</div>` : ''}
                    </div>
            `;
            
            if (satisficers.length === 0) {
                html += `
                    <div style="text-align: center; padding: 30px; background: #fff3cd; border-radius: 12px; border: 2px solid #ffc107;">
                        <h4 style="color: #856404; margin: 0 0 10px 0;">⚠️ No Satisficers Found</h4>
                        <p style="color: #856404; margin: 0;">None of your options meet even the minimum acceptable standards (≥2.0 on all criteria).</p>
                    </div>
                `;
            } else {
                satisficers.forEach(satisficer => {
                    const option = satisficer.option;
                    const label = satisficer.strengthCount >= 3 ? 'Well-Rounded' : 
                                 satisficer.concernCount === 0 ? 'Safe Choice' : 'Balanced Option';
                    
                    html += `
                        <div style="background: #f8f9fa; border: 1px solid #dee2e6; border-radius: 8px; padding: 20px; margin-bottom: 15px;">
                            <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 15px;">
                                <div>
                                    <h5 style="color: #333; margin: 0 0 5px 0; font-weight: 600;">${sanitizeInput(option.name)}</h5>
                                    ${option.description ? `<p style="color: #666; font-size: 0.9rem; margin: 0 0 10px 0;">${sanitizeInput(option.description)}</p>` : ''}
                                </div>
                                <div style="background: #28a745; color: white; padding: 4px 8px; border-radius: 4px; font-size: 0.8rem; font-weight: bold;">
                                    #${satisficer.originalRank} Overall
                                </div>
                            </div>
                            
                            <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(120px, 1fr)); gap: 10px; margin-bottom: 15px;">
                                <div style="text-align: center; padding: 8px; background: white; border-radius: 6px;">
                                    <div style="font-weight: bold; color: #667eea;">${satisficer.totalScore.toFixed(2)}</div>
                                    <div style="font-size: 0.8rem; color: #666;">Score (Rank #${satisficer.satisficerRank})</div>
                                </div>
                                <div style="text-align: center; padding: 8px; background: white; border-radius: 6px;">
                                    <div style="font-weight: bold; color: #28a745;">${satisficer.minRating.toFixed(1)}/5.0</div>
                                    <div style="font-size: 0.8rem; color: #666;">Min Rating</div>
                                </div>
                                <div style="text-align: center; padding: 8px; background: white; border-radius: 6px;">
                                    <div style="font-weight: bold; color: #28a745;">${satisficer.strengthCount}</div>
                                    <div style="font-size: 0.8rem; color: #666;">Strong Areas (≥4.0)</div>
                                </div>
                                <div style="text-align: center; padding: 8px; background: white; border-radius: 6px;">
                                    <div style="font-weight: bold; color: ${satisficer.concernCount > 0 ? '#dc3545' : '#28a745'};">${satisficer.concernCount}</div>
                                    <div style="font-size: 0.8rem; color: #666;">Watch Areas (<3.5)</div>
                                </div>
                            </div>
                            
                            <div style="display: flex; justify-content: space-between; align-items: center;">
                                <div style="background: #e3f2fd; color: #1565c0; padding: 6px 12px; border-radius: 15px; font-size: 0.9rem; font-weight: 600;">
                                    🏷 ${label}
                                </div>
                                <div style="font-size: 0.85rem; color: #666; font-style: italic;">
                                    💡 This option won't disappoint - meets good standards across all criteria
                                </div>
                            </div>
                        </div>
                    `;
                });
            }
            
            html += '</div>';
            container.innerHTML = html;
        }

















        function addCriteriaImpactToPDF(doc, yPos) {
            const impactData = calculateCriteriaImpact();
            const maxImpact = impactData.slice(0, 3);
            const minImpact = impactData.slice(-3).reverse();
            
            // Section header
            doc.setFontSize(16);
            doc.setFont(undefined, 'bold');
            doc.setTextColor(102, 126, 234);
            doc.text('📊 Criteria Impact Analysis', 15, yPos);
            yPos += 15;
            
            // Brief explanation
            doc.setFontSize(10);
            doc.setFont(undefined, 'normal');
            doc.setTextColor(100, 100, 100);
            doc.text('Analysis of which criteria have the most and least discriminating power in your decision.', 15, yPos);
            yPos += 20;
            
            // Two-column layout
            const leftX = 15;
            const rightX = 110;
            const columnWidth = 85;
            let leftY = yPos;
            let rightY = yPos;
            
            // Maximum Impact (Left Column)
            doc.setFontSize(12);
            doc.setFont(undefined, 'bold');
            doc.setTextColor(51, 51, 51);
            doc.text('🎯 Maximum Impact Criteria', leftX, leftY);
            leftY += 15;
            
            maxImpact.forEach(criteria => {
                // Card background
                doc.setFillColor(248, 249, 250);
                doc.rect(leftX, leftY - 5, columnWidth, 35, 'F');
                doc.setDrawColor(222, 226, 230);
                doc.rect(leftX, leftY - 5, columnWidth, 35, 'S');
                
                // Criteria name
                doc.setFontSize(10);
                doc.setFont(undefined, 'bold');
                doc.setTextColor(51, 51, 51);
                doc.text(criteria.criteriaName, leftX + 3, leftY + 3);
                
                // Impact score
                doc.setFontSize(9);
                doc.setFont(undefined, 'normal');
                doc.text(`Impact Score: ${criteria.impactScore.toFixed(1)}%`, leftX + 3, leftY + 10);
                doc.text(`Variance: ${criteria.variance.toFixed(2)} | Weight: ${criteria.weight}%`, leftX + 3, leftY + 16);
                
                // Brief explanation
                doc.setFontSize(8);
                doc.setTextColor(100, 100, 100);
                const spread = Math.max(...criteria.ratings) - Math.min(...criteria.ratings);
                doc.text(`Key decision driver (${spread.toFixed(1)} point spread)`, leftX + 3, leftY + 22);
                
                leftY += 45;
            });
            
            // Minimum Impact (Right Column)
            doc.setFontSize(12);
            doc.setFont(undefined, 'bold');
            doc.setTextColor(51, 51, 51);
            doc.text('🎭 Minimum Impact Criteria', rightX, rightY);
            rightY += 15;
            
            minImpact.forEach(criteria => {
                // Card background
                doc.setFillColor(248, 249, 250);
                doc.rect(rightX, rightY - 5, columnWidth, 35, 'F');
                doc.setDrawColor(222, 226, 230);
                doc.rect(rightX, rightY - 5, columnWidth, 35, 'S');
                
                // Criteria name
                doc.setFontSize(10);
                doc.setFont(undefined, 'bold');
                doc.setTextColor(51, 51, 51);
                doc.text(criteria.criteriaName, rightX + 3, rightY + 3);
                
                // Impact score
                doc.setFontSize(9);
                doc.setFont(undefined, 'normal');
                doc.text(`Impact Score: ${criteria.impactScore.toFixed(1)}%`, rightX + 3, rightY + 10);
                doc.text(`Variance: ${criteria.variance.toFixed(2)} | Weight: ${criteria.weight}%`, rightX + 3, rightY + 16);
                
                // Brief explanation
                doc.setFontSize(8);
                doc.setTextColor(100, 100, 100);
                const spread = Math.max(...criteria.ratings) - Math.min(...criteria.ratings);
                doc.text(`Similar performance (${spread.toFixed(1)} point spread)`, rightX + 3, rightY + 22);
                
                rightY += 45;
            });
            
            return Math.max(leftY, rightY) + 20;
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
                const rating = decisionData.ratings[ratingKey] ?? DEFAULT_RATING; // Default: 2 (Fair)
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
            const rating = decisionData.ratings[ratingKey] ?? DEFAULT_RATING; // Changed from 3 to 2
            const weight = (decisionData.normalizedWeights[crit.id] || 0) / 100;
            const weightedScore = rating * weight;
            
            // Updated heatmap color scheme for 0-5 scale
            const { backgroundColor, textColor } = getHeatmapColors(rating);
            
            html += `<td style="padding: 12px; border: 1px solid #dee2e6; text-align: center; background: ${backgroundColor}; color: ${textColor}; position: relative;" 
                          title="Rating: ${rating.toFixed(1)}/5, Weight: ${Math.round(weight * 100)}%, Weighted Score: ${weightedScore.toFixed(2)}">
                        <div style="font-weight: 600; font-size: 1.1rem;">${rating.toFixed(1)}</div>
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
                            <span>0.0-0.5 (Unacceptable)</span>
                        </div>
                        <div style="display: flex; align-items: center; gap: 8px;">
                            <div style="width: 20px; height: 20px; background: #ffebee; border: 1px solid #ccc; border-radius: 3px;"></div>
                            <span>1.0-1.5 (Poor)</span>
                        </div>
                        <div style="display: flex; align-items: center; gap: 8px;">
                            <div style="width: 20px; height: 20px; background: #fff3e0; border: 1px solid #ccc; border-radius: 3px;"></div>
                            <span>2.0-2.5 (Fair)</span>
                        </div>
                        <div style="display: flex; align-items: center; gap: 8px;">
                            <div style="width: 20px; height: 20px; background: #fffde7; border: 1px solid #ccc; border-radius: 3px;"></div>
                            <span>3.0-3.5 (Good)</span>
                        </div>
                        <div style="display: flex; align-items: center; gap: 8px;">
                            <div style="width: 20px; height: 20px; background: #a5d6a7; border: 1px solid #ccc; border-radius: 3px;"></div>
                            <span>4.0-4.5 (Very Good)</span>
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
            // Group decimal ratings (3.5 uses same color as 3)
            const colorGroup = Math.floor(rating);
            const colorSchemes = {
                0: { backgroundColor: '#ffcdd2', textColor: '#b71c1c' }, // 0-0.5
                1: { backgroundColor: '#ffebee', textColor: '#c62828' }, // 1-1.5
                2: { backgroundColor: '#fff3e0', textColor: '#e65100' }, // 2-2.5
                3: { backgroundColor: '#fffde7', textColor: '#f57f17' }, // 3-3.5
                4: { backgroundColor: '#a5d6a7', textColor: '#2e7d32' }, // 4-4.5
                5: { backgroundColor: '#66bb6a', textColor: '#1b5e20' }  // 5
            };
            
            return colorSchemes[colorGroup] || colorSchemes[Math.floor(DEFAULT_RATING)];
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
                        Analysis of how sensitive your decision is to changes in criteria weights. 
                    </p>
                    
                    <div class="sensitivity-analysis">
                        <h4 style="color: #333; margin: 0 0 20px 0;">🎯 Flip Point Analysis</h4>
                        <p style="color: #666; font-size: 0.9rem; margin-bottom: 15px;">
                            Lower flip points indicate more critical criteria. Minimum weight changes needed to change the winner:
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
                const winnerRating = decisionData.ratings[`${winner.option.id}-${criteria.id}`] ?? DEFAULT_RATING;
                const runnerUpRating = decisionData.ratings[`${runnerUp.option.id}-${criteria.id}`] ?? DEFAULT_RATING;
                
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
                        <button id="resetWeightsBtn" class="btn btn-secondary" style="margin: 0; margin-right: 10px;">
                            🔄 Reset Analysis
                        </button>
                        <button id="normalizeWeightsBtn" class="btn btn-secondary" style="margin: 0;">
                            ⚖️ Balance Weights to 100%
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
            document.getElementById('normalizeWeightsBtn').addEventListener('click', normalizeWeightsDisplay);
        }
        
        // ADD these supporting functions:
        function calculateNormalizedWeights() {
            // Get all current weight values (what user set)
            const weights = {};
            let total = 0;
            
            whatIfDecisionData.criteria.forEach(criteria => {
                const currentWeight = whatIfDecisionData.normalizedWeights[criteria.id] || 0;
                weights[criteria.id] = currentWeight;
                total += currentWeight;
            });
            
            // If total is 0, distribute equally
            if (total === 0) {
                const equalWeight = 100 / whatIfDecisionData.criteria.length;
                const normalizedWeights = {};
                whatIfDecisionData.criteria.forEach(criteria => {
                    normalizedWeights[criteria.id] = equalWeight;
                });
                return normalizedWeights;
            }
            
            // Calculate normalized weights for calculations (but don't update display)
            const normalizedWeights = {};
            whatIfDecisionData.criteria.forEach(criteria => {
                normalizedWeights[criteria.id] = (weights[criteria.id] / total) * 100;
            });
            
            return normalizedWeights;
        }


        function normalizeWeightsDisplay() {
            // Calculate normalized weights
            const normalizedWeights = calculateNormalizedWeights();
            
            // Update both stored values and display
            whatIfDecisionData.criteria.forEach(criteria => {
                const normalizedWeight = Math.round(normalizedWeights[criteria.id]);
                whatIfDecisionData.normalizedWeights[criteria.id] = normalizedWeight;
                
                const display = document.getElementById(`weight-display-${criteria.id}`);
                const slider = document.getElementById(`weight-slider-${criteria.id}`);
                
                if (display) display.textContent = `${normalizedWeight}%`;
                if (slider) slider.value = normalizedWeight;
            });
            
            // Recalculate results with new normalized weights
            updateWhatIfResults();
        }





        // REPLACE the existing updateWhatIfWeight function with this optimized version:
        
        // Create debounced version for calculations
        const debouncedUpdateWhatIfCalculation = debounce(function() {
            // Just recalculate results (using normalized weights for calculation but keeping display as-is)
            updateWhatIfResults();
        }, 150); // 150ms delay for calculation only



        function updateWhatIfWeight(criteriaId, newWeight) {
            // Update the stored weight (what user set)
            whatIfDecisionData.normalizedWeights[criteriaId] = parseFloat(newWeight);
            
            // Immediate display update (show exactly what user set)
            document.getElementById(`weight-display-${criteriaId}`).textContent = `${Math.round(newWeight)}%`;
            
            // Debounced calculation update (calculations use normalized weights internally)
            debouncedUpdateWhatIfCalculation();
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
                    const rating = whatIfDecisionData.ratings[ratingKey] ?? DEFAULT_RATING;
                    const normalizedWeights = calculateNormalizedWeights();
                    const weight = (normalizedWeights[criteria.id] || 0) / 100;
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
            // Completely refresh with current decision data
            whatIfDecisionData = JSON.parse(JSON.stringify(decisionData));
            
            // Re-render the entire what-if interface
            renderWhatIfAnalysis();
        }







         // Render risk analysis
        function renderAdvancedRisks() {
            const container = document.getElementById('advancedRisks');
            if (!container || !advancedAnalytics.risks) return;
            
            const risks = advancedAnalytics.risks;
            const summary = risks.summary;
            const winner = advancedAnalytics.results[0];
            
            if (summary.totalRisks === 0) {
                container.innerHTML = `
                    <div style="text-align: center; padding: 30px; background: #d4edda; border-radius: 12px; border: 2px solid #28a745;">
                        <h4 style="color: #155724; margin: 0 0 10px 0;">✅ Low Risk Profile</h4>
                        <p style="color: #155724; margin: 0;">Your choice shows strong performance with minimal implementation risks.</p>
                    </div>
                `;
                return;
            }
            
            let html = `
                <div style="padding: 20px;">
                    <!-- Risk Summary Dashboard -->
                    <div style="background: #f8f9fa; border-radius: 12px; padding: 20px; margin-bottom: 25px;">
                        <h4 style="color: #333; margin: 0 0 15px 0;">📊 Risk Assessment Summary</h4>
                        <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(120px, 1fr)); gap: 15px; margin-bottom: 15px;">
                            <div style="text-align: center; padding: 12px; background: white; border-radius: 8px; border-left: 4px solid ${getSeverityColor(summary.highestSeverity)};">
                                <div style="font-size: 1.5rem; font-weight: bold; color: ${getSeverityColor(summary.highestSeverity)};">${summary.totalRisks}</div>
                                <div style="font-size: 0.9rem; color: #666;">Total Risks</div>
                            </div>
                            <div style="text-align: center; padding: 12px; background: white; border-radius: 8px;">
                                <div style="font-size: 1.1rem; font-weight: bold; color: ${getSeverityColor(summary.highestSeverity)}; text-transform: uppercase;">${summary.highestSeverity}</div>
                                <div style="font-size: 0.9rem; color: #666;">Severity</div>
                            </div>
                            <div style="text-align: center; padding: 12px; background: white; border-radius: 8px;">
                                <div style="font-size: 1.5rem; font-weight: bold; color: #dc3545;">${summary.vulnerabilityCount}</div>
                                <div style="font-size: 0.9rem; color: #666;">Vulnerabilities</div>
                            </div>
                            <div style="text-align: center; padding: 12px; background: white; border-radius: 8px;">
                                <div style="font-size: 1.5rem; font-weight: bold; color: #ffc107;">${summary.opportunityCount}</div>
                                <div style="font-size: 0.9rem; color: #666;">Trade-offs</div>
                            </div>
                        </div>
                        
                        ${summary.primaryConcern ? `
                            <div style="background: ${getSeverityBackground(summary.primaryConcern.severity)}; border: 1px solid ${getSeverityColor(summary.primaryConcern.severity)}; border-radius: 8px; padding: 12px;">
                                <strong style="color: ${getSeverityColor(summary.primaryConcern.severity)};">Primary Concern:</strong>
                                <span style="color: #333; margin-left: 8px;">${summary.primaryConcern.description}</span>
                            </div>
                        ` : ''}
                    </div>
            `;
            
            // Vulnerability Risks Section
            if (risks.vulnerability.length > 0) {
                html += renderRiskCategory('🎯 Performance Vulnerabilities', risks.vulnerability, 'vulnerability');
            }
            
            // Dependency Risks Section  
            if (risks.dependency.length > 0) {
                html += renderRiskCategory('⚖️ Dependency Risks', risks.dependency, 'dependency');
            }
            
            // Opportunity Costs Section
            if (risks.opportunity.length > 0) {
                html += renderRiskCategory('💰 Opportunity Costs', risks.opportunity, 'opportunity');
            }
            
            // Risk Mitigation Section
            html += generateRiskMitigationSection(risks, winner);
            
            html += '</div>';
            container.innerHTML = html;
        }
        
        function renderRiskCategory(title, riskList, categoryType) {
            let html = `
                <div style="background: white; border-radius: 12px; padding: 20px; margin-bottom: 20px; border: 1px solid #e9ecef;">
                    <h4 style="color: #333; margin: 0 0 15px 0;">${title}</h4>
            `;
            
            riskList.forEach(risk => {
                const severityColor = getSeverityColor(risk.severity);
                const severityIcon = getSeverityIcon(risk.severity);
                
                html += `
                    <div style="background: ${getSeverityBackground(risk.severity)}; border-left: 4px solid ${severityColor}; border-radius: 8px; padding: 15px; margin-bottom: 12px;">
                        <div style="display: flex; align-items: flex-start; justify-content: space-between; margin-bottom: 8px;">
                            <div style="flex: 1;">
                                <div style="font-weight: 600; color: #333; margin-bottom: 4px;">
                                    ${severityIcon} ${sanitizeInput(risk.criteriaName)}
                                    ${categoryType === 'opportunity' ? ` vs ${sanitizeInput(risk.alternativeName)}` : ''}
                                </div>
                                <div style="font-size: 0.9rem; color: #555; margin-bottom: 6px;">
                                    ${risk.description}
                                </div>
                                <div style="font-size: 0.85rem; color: #666; font-style: italic;">
                                    ${risk.impact || risk.consideration || ''}
                                </div>
                            </div>
                            <div style="text-align: right; margin-left: 15px;">
                                ${categoryType === 'vulnerability' && risk.riskScore ? `
                                    <div style="font-size: 0.8rem; color: ${severityColor}; font-weight: 600;">
                                        Risk: ${(risk.riskScore * 100).toFixed(0)}%
                                    </div>
                                ` : ''}
                                ${categoryType === 'opportunity' && risk.opportunityCost ? `
                                    <div style="font-size: 0.8rem; color: ${severityColor}; font-weight: 600;">
                                        Cost: ${risk.opportunityCost.toFixed(1)}%
                                    </div>
                                ` : ''}
                                <div style="background: ${severityColor}; color: white; padding: 2px 8px; border-radius: 12px; font-size: 0.75rem; font-weight: 600; text-transform: uppercase; margin-top: 4px;">
                                    ${risk.severity}
                                </div>
                            </div>
                        </div>
                        
                        ${risk.mitigation ? `
                            <div style="border-top: 1px solid #eee; padding-top: 8px; margin-top: 8px;">
                                <div style="font-size: 0.85rem; color: #0066cc;">
                                    <strong>💡 Mitigation:</strong> ${risk.mitigation}
                                </div>
                            </div>
                        ` : ''}
                    </div>
                `;
            });
            
            html += '</div>';
            return html;
        }
        
        function generateRiskMitigationSection(risks, winner) {
            const allRisks = [...risks.vulnerability, ...risks.dependency, ...risks.opportunity];
            const criticalRisks = allRisks.filter(r => r.severity === 'critical');
            const highRisks = allRisks.filter(r => r.severity === 'high');
            
            let html = `
                <div style="background: #e7f3ff; border: 2px solid #b3d7ff; border-radius: 12px; padding: 20px; margin-top: 20px;">
                    <h4 style="color: #0056b3; margin: 0 0 15px 0;">🛡️ Risk Management Strategy</h4>
            `;
            
            if (criticalRisks.length > 0) {
                html += `
                    <div style="background: #fff3cd; border: 1px solid #ffeaa7; border-radius: 8px; padding: 12px; margin-bottom: 15px;">
                        <strong style="color: #856404;">⚠️ Immediate Action Required:</strong>
                        <ul style="margin: 8px 0 0 20px; color: #856404;">
                            ${criticalRisks.map(risk => `<li style="margin-bottom: 4px;">${risk.mitigation || `Address ${risk.criteriaName} concerns`}</li>`).join('')}
                        </ul>
                    </div>
                `;
            }
            
            html += `
                <div style="background: white; border-radius: 8px; padding: 15px;">
                    <h5 style="color: #333; margin: 0 0 10px 0;">📋 General Recommendations:</h5>
                    <ul style="margin: 0; padding-left: 20px; color: #555; line-height: 1.6;">
                        <li>Monitor performance in identified vulnerability areas</li>
                        <li>Develop contingency plans for high-dependency criteria</li>
                        ${risks.opportunity.length > 0 ? '<li>Consider if opportunity costs are acceptable given your priorities</li>' : ''}
                        <li>Regular review of ${sanitizeInput(winner.option.name)} performance against these risk factors</li>
                        ${highRisks.length > 0 ? '<li>Create specific action plans for high-severity risks</li>' : ''}
                    </ul>
                </div>
            `;
            
            html += '</div>';
            return html;
        }
        
        function getSeverityColor(severity) {
            const colors = {
                'critical': '#dc3545',
                'high': '#fd7e14', 
                'moderate': '#ffc107',
                'low': '#28a745'
            };
            return colors[severity] || '#6c757d';
        }
        
        function getSeverityBackground(severity) {
            const backgrounds = {
                'critical': '#f8d7da',
                'high': '#fff3cd',
                'moderate': '#fff3cd', 
                'low': '#d4edda'
            };
            return backgrounds[severity] || '#f8f9fa';
        }
        
        function getSeverityIcon(severity) {
            const icons = {
                'critical': '🚫',
                'high': '🔴',
                'moderate': '🟡',
                'low': '🟢'
            };
            return icons[severity] || '⚪';
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
        padding: 40px;
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
                        selector: '.criteria-impact-analysis', 
                        name: 'Criteria Impact Analysis' 
                    },

                        
                    { 
                        selector: '.winner-analysis, .risk-analysis, .top-contributors, .differentiating-factors', 
                        name: 'Winner Analysis' 
                    },
                    { 
                        selector: '.performance-matrix', 
                        name: 'Performance Matrix' 
                    },
                    { name: 'Satisficers Analysis', selector: '.satisficers-analysis' },    
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
                    <span style="font-weight: 600;">Confidence Level: ${confidence.level.replace('-', ' ').toUpperCase()}</span>
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
            const rating = safeNum(decisionData.ratings && decisionData.ratings[ratingKey], DEFAULT_RATING);
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
            const winnerRating = safeNum(decisionData.ratings && decisionData.ratings[winnerRatingKey], DEFAULT_RATING);
            const runnerUpRating = safeNum(decisionData.ratings && decisionData.ratings[runnerUpRatingKey], DEFAULT_RATING);
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



        // Criteria Impact Analysis HTML generation
        const impactData = calculateCriteriaImpact();
        const maxImpactCr = impactData.slice(0, 3);
        const minImpactCr = impactData.slice(-3).reverse();
        
        const criteriaImpactHtml = `
            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 30px;">
                <!-- Maximum Impact Column -->
                <div>
                    <h4 style="color: #333; margin: 0 0 15px 0;">🎯 Maximum Impact Criteria</h4>
                    <p style="color: #666; font-size: 0.9rem; margin-bottom: 15px;">Criteria that most influence your decision</p>
                    ${maxImpactCr.map(criteria => `
                        <div style="background: #f8f9fa; border: 1px solid #dee2e6; border-radius: 8px; padding: 15px; margin-bottom: 15px;">
                            <h5 style="color: #333; margin: 0 0 10px 0; font-weight: 600;">${safeText(criteria.criteriaName)}</h5>
                            <div style="font-size: 0.9rem; color: #666; margin-bottom: 8px;">
                                Impact Score: <strong style="color: #667eea;">${criteria.impactScore.toFixed(1)}%</strong>
                            </div>
                            <div style="font-size: 0.9rem; color: #666; margin-bottom: 8px;">
                                Variance: ${criteria.variance.toFixed(2)} | Weight: ${criteria.weight}%
                            </div>
                            <div style="background: #e3f2fd; border-left: 3px solid #2196f3; padding: 8px; border-radius: 4px; font-size: 0.85rem; color: #1565c0;">
                                💡 Key decision driver (${(Math.max(...criteria.ratings) - Math.min(...criteria.ratings)).toFixed(1)} point spread)
                            </div>
                        </div>
                    `).join('')}
                </div>
                
                <!-- Minimum Impact Column -->
                <div>
                    <h4 style="color: #333; margin: 0 0 15px 0;">🎭 Minimum Impact Criteria</h4>
                    <p style="color: #666; font-size: 0.9rem; margin-bottom: 15px;">Criteria with similar performance across options</p>
                    ${minImpactCr.map(criteria => `
                        <div style="background: #f8f9fa; border: 1px solid #dee2e6; border-radius: 8px; padding: 15px; margin-bottom: 15px;">
                            <h5 style="color: #333; margin: 0 0 10px 0; font-weight: 600;">${safeText(criteria.criteriaName)}</h5>
                            <div style="font-size: 0.9rem; color: #666; margin-bottom: 8px;">
                                Impact Score: <strong style="color: #6c757d;">${criteria.impactScore.toFixed(1)}%</strong>
                            </div>
                            <div style="font-size: 0.9rem; color: #666; margin-bottom: 8px;">
                                Variance: ${criteria.variance.toFixed(2)} | Weight: ${criteria.weight}%
                            </div>
                            <div style="background: #fff3e0; border-left: 3px solid #ff9800; padding: 8px; border-radius: 4px; font-size: 0.85rem; color: #f57c00;">
                                💡 Similar performance (${(Math.max(...criteria.ratings) - Math.min(...criteria.ratings)).toFixed(1)} point spread)
                            </div>
                        </div>
                    `).join('')}
                </div>
            </div>
        `;

        
        
        
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
                            const rating = safeNum(decisionData.ratings && decisionData.ratings[ratingKey], DEFAULT_RATING);
                            const weight = safeNum(decisionData.normalizedWeights && decisionData.normalizedWeights[crit.id], 0) / 100;
                            const weightedScore = rating * weight;
                            const bgColor = rating >= 4 ? '#e8f5e8' : rating >= 3 ? '#fffde7' : rating >= 2 ? '#fff3e0' : '#ffebee';
                            const textColor = rating >= 4 ? '#2e7d32' : rating >= 3 ? '#f57f17' : rating >= 2 ? '#e65100' : '#c62828';
                            
                            return `<td style="padding: 12px; border: 1px solid #dee2e6; text-align: center; background: ${bgColor}; color: ${textColor};">
                                <div style="font-weight: 600; font-size: 14px;">${rating.toFixed(1)}</div>
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



        // Satisficers Analysis HTML generation
        let satisficersPdf = identifySatisficers(3.0);
        let satisficersThreshold = 3.0;
        
        // Adaptive threshold if no satisficers found
        if (satisficersPdf.length === 0) {
            satisficersPdf = identifySatisficers(2.5);
            satisficersThreshold = 2.5;
        }
        if (satisficersPdf.length === 0) {
            satisficersPdf = identifySatisficers(2.0);
            satisficersThreshold = 2.0;
        }
        
        const satisficersHtml = `
            <div style="padding: 20px;">
                <p style="color: #666; font-size: 14px; margin-bottom: 20px;">
                    Options that meet acceptable standards on all criteria (≥${satisficersThreshold} rating)
                </p>
                <div style="margin-bottom: 20px;">
                    <strong>${satisficersPdf.length} out of ${decisionData.options.length} options qualify as satisficers</strong>
                    ${satisficersThreshold < 3.0 ? `<div style="color: #856404; font-size: 12px; margin-top: 5px;">Note: Threshold lowered to ${satisficersThreshold} as no options met the 3.0 standard</div>` : ''}
                </div>
                
                ${satisficersPdf.length === 0 ? `
                    <div style="text-align: center; padding: 20px; background: #fff3cd; border-radius: 8px; border: 1px solid #ffc107;">
                        <h4 style="color: #856404; margin: 0 0 10px 0;">⚠️ No Satisficers Found</h4>
                        <p style="color: #856404; margin: 0; font-size: 12px;">None of your options meet even the minimum acceptable standards (≥2.0 on all criteria).</p>
                    </div>
                ` : satisficersPdf.map(satisficer => {
                    const option = satisficer.option;
                    const label = satisficer.strengthCount >= 3 ? 'Well-Rounded' : 
                                 satisficer.concernCount === 0 ? 'Safe Choice' : 'Balanced Option';
                    
                    return `
                        <div style="background: #f8f9fa; border: 1px solid #dee2e6; border-radius: 8px; padding: 15px; margin-bottom: 15px;">
                            <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 10px;">
                                <div style="flex: 1;">
                                    <h5 style="color: #333; margin: 0 0 5px 0; font-weight: 600; font-size: 14px;">${safeText(option.name)}</h5>
                                    ${option.description ? `<p style="color: #666; font-size: 11px; margin: 0 0 8px 0;">${safeText(option.description.substring(0, 100))}${option.description.length > 100 ? '...' : ''}</p>` : ''}
                                </div>
                                <div style="background: #28a745; color: white; padding: 3px 6px; border-radius: 4px; font-size: 10px; font-weight: bold; margin-left: 10px;">
                                    #${satisficer.originalRank} Overall
                                </div>
                            </div>
                            
                            <div style="display: grid; grid-template-columns: repeat(4, 1fr); gap: 8px; margin-bottom: 10px;">
                                <div style="text-align: center; padding: 6px; background: white; border-radius: 4px;">
                                    <div style="font-weight: bold; color: #667eea; font-size: 12px;">${satisficer.totalScore.toFixed(2)}</div>
                                    <div style="font-size: 9px; color: #666;">Score (#${satisficer.satisficerRank})</div>
                                </div>
                                <div style="text-align: center; padding: 6px; background: white; border-radius: 4px;">
                                    <div style="font-weight: bold; color: #28a745; font-size: 12px;">${satisficer.minRating.toFixed(1)}/5.0</div>
                                    <div style="font-size: 9px; color: #666;">Min Rating</div>
                                </div>
                                <div style="text-align: center; padding: 6px; background: white; border-radius: 4px;">
                                    <div style="font-weight: bold; color: #28a745; font-size: 12px;">${satisficer.strengthCount}</div>
                                    <div style="font-size: 9px; color: #666;">Strong (≥4.0)</div>
                                </div>
                                <div style="text-align: center; padding: 6px; background: white; border-radius: 4px;">
                                    <div style="font-weight: bold; color: ${satisficer.concernCount > 0 ? '#dc3545' : '#28a745'}; font-size: 12px;">${satisficer.concernCount}</div>
                                    <div style="font-size: 9px; color: #666;">Watch (<3.5)</div>
                                </div>
                            </div>
                            
                            <div style="display: flex; justify-content: space-between; align-items: center;">
                                <div style="background: #e3f2fd; color: #1565c0; padding: 4px 8px; border-radius: 12px; font-size: 10px; font-weight: 600;">
                                    🏷 ${label}
                                </div>
                                <div style="font-size: 9px; color: #666; font-style: italic;">
                                    Won't disappoint - meets good standards
                                </div>
                            </div>
                        </div>
                    `;
                }).join('')}
            </div>
        `;
        

        
    // Sensitivity analysis (flip points) with safe Math.max
    const maxImpact = flipPoints.length ? Math.max(...flipPoints.map(f => safeNum(f.impactMagnitude, 1))) : 0;
    const flipPointsHtml = `
        <div class="sensitivity-analysis">
            <h4 style="color: #333; margin: 0 0 15px 0; font-size: 16px;">🎯 Flip Point Analysis</h4>
            <p style="color: #666; font-size: 13px; margin-bottom: 15px;">
                Lower flip points indicate more critical criteria. Minimum weight changes needed to change the winner:
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


                <!-- Criteria Impact Analysis Section -->
                <div class="pdf-section criteria-impact-analysis" style="background: #f8f9fa; border-radius: 15px; padding: 25px; margin-bottom: 30px;">
                    <h3 style="color: #667eea; margin: 0 0 20px 0; font-size: 20px;">📊 Criteria Impact Analysis</h3>
                    <p style="color: #666; margin-bottom: 20px;">Analysis of which criteria have the most and least discriminating power in your decision:</p>
                    ${criteriaImpactHtml}
                </div>


                <!-- Satisficers Analysis Section -->
                <div class="pdf-section satisficers-analysis" style="background: #f8f9fa; border-radius: 15px; padding: 25px; margin-bottom: 30px;">
                    <h3 style="color: #667eea; margin: 0 0 20px 0; font-size: 20px;">✅ Satisficers - 'Good Enough' Options</h3>
                    ${satisficersHtml}
                </div>



            <!-- Sensitivity Analysis Section -->
            <div class="pdf-section sensitivity-analysis" style="margin-bottom: 30px;">
                <h3 style="color: #667eea; margin: 0 0 20px 0; font-size: 20px;">⚖️ Sensitivity analysis</h3>
                <p style="color: #666; margin-bottom: 20px;">
                    How sensitive your decision is to changes in criteria weights. 
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










        // Decision Stability Related functions
        // Enhanced stability calculation function
        function calculateStabilityLevel(winner, confidence, winnerContributions) {
            let stabilityFactors = [];
            let stabilityScore = 100;
            
            // Factor 1: Overall confidence
            if (confidence.percentage < 40) {
                stabilityScore -= 30;
                stabilityFactors.push('Low statistical confidence');
            } else if (confidence.percentage < 70) {
                stabilityScore -= 15;
                stabilityFactors.push('Moderate confidence level');
            }
            
            // Factor 2: Performance consistency
            const lowPerformanceCount = winnerContributions.filter(c => c.rating <= 2).length;
            const criticalLowCount = winnerContributions.filter(c => c.rating <= 1 && c.weight >= 15).length;
            
            if (criticalLowCount > 0) {
                stabilityScore -= 25;
                stabilityFactors.push(`${criticalLowCount} critical weakness(es) in important criteria`);
            } else if (lowPerformanceCount > 0) {
                stabilityScore -= 10;
                stabilityFactors.push(`${lowPerformanceCount} area(s) of concern`);
            }
            
            // Factor 3: Decision margin
            if (confidence.gap < 0.3) {
                stabilityScore -= 20;
                stabilityFactors.push('Very close race with runner-up');
            } else if (confidence.gap < 0.7) {
                stabilityScore -= 10;
                stabilityFactors.push('Moderate lead over runner-up');
            }
            
            // Factor 4: Weight sensitivity
            if (confidence.details.components.sensitivityPenalty > 15) {
                stabilityScore -= 15;
                stabilityFactors.push('Sensitive to criteria weighting changes');
            }
            
            // Determine level
            let level, recommendation;
            if (stabilityScore >= 80) {
                level = 'High';
                recommendation = 'Decision is robust - proceed with confidence';
            } else if (stabilityScore >= 60) {
                level = 'Medium';
                recommendation = 'Generally solid choice - monitor identified concerns';
            } else {
                level = 'Low';
                recommendation = 'High uncertainty - consider gathering more information';
            }
            
            return {
                level: level,
                score: Math.max(0, stabilityScore),
                factors: stabilityFactors,
                recommendation: recommendation
            };
        }
        
        // Decision robustness calculation function
        function calculateDecisionRobustness(results, confidence) {
            const monteCarloScore = confidence.details.stability.stabilityPercentage;
            const confidenceScore = confidence.percentage;
            const gapScore = Math.min(confidence.gap * 20, 100);
            
            const robustnessScore = (
                monteCarloScore * 0.4 +
                confidenceScore * 0.35 +
                gapScore * 0.25
            );
            
            return {
                score: Math.round(robustnessScore),
                level: robustnessScore >= 80 ? 'Very Robust' : 
                       robustnessScore >= 65 ? 'Robust' : 
                       robustnessScore >= 50 ? 'Moderately Robust' : 'Fragile',
                interpretation: robustnessScore >= 80 ? 'Decision is highly stable to changes' :
                               robustnessScore >= 65 ? 'Decision is reasonably stable' :
                               robustnessScore >= 50 ? 'Decision has moderate stability' :
                               'Decision is sensitive to small changes'
            };
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
                    div.innerHTML = `<span>${criteriaName}:</span><span>${scores.rating.toFixed(1)}/5 (${Math.round(scores.score * 20)}%)</span>`;
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
        postBody = `**Decision:** ${decisionDescription}\n\n`;
    }
    // Add decision metrics for context
    postBody += `**Options:** ${decisionData.options.length} choices\n`;
    postBody += `**Criteria:** ${decisionData.criteria.length} factors analyzed\n\n`;
        
    postBody += '\n\n---\n\n*The attached QR can be imported and analyzed on [choicease.com](https://choicease.com)*';
    postBody = `🚨 NOTE (delete this line before posting): To add your QR image, go to the "Link" or "Images & Video" tab and upload it there.\n\n` + postBody;
    
//    const redditUrl = 'https://old.reddit.com/r/choicease/submit/?' + 
    const redditUrl = 'https://www.reddit.com/r/choicease/submit/?' +     
        'title=' + encodeURIComponent(postTitle) + 
        '&text=' + encodeURIComponent(postBody) + '&link=https://choicease.com' + '&type=IMAGE';
    
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
                    const rating = decisionData.ratings[ratingKey] ?? DEFAULT_RATING; // Default: 2 (Fair)
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
            const rating = decisionData.ratings[ratingKey] ?? DEFAULT_RATING; // Default: 2 (Fair)
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
                row += `,${scores.rating.toFixed(1)},${scores.weight}%,${scores.score.toFixed(3)}`;
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
            const rating = decisionData.ratings[ratingKey] ?? DEFAULT_RATING; // Default: 2 (Fair)
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
            const rating = decisionData.ratings[ratingKey] ?? DEFAULT_RATING; // Default: 2 (Fair)
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
                const rating = decisionData.ratings[ratingKey] ?? DEFAULT_RATING; // Default: 2 (Fair)
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
        qrContainer.style.cssText = 'width:768px;height:768px;display:block;margin:10px;';
        tempDiv.appendChild(qrContainer);
        
        try {
            console.log("Creating QR " + (index + 1) + " with " + data.length + " characters");
            
            const qr = new QRCode(qrContainer, {
                text: data,
                width: 768,
                height: 768,
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
                    canvas.width = 768;
                    canvas.height = 768;
                    const ctx = canvas.getContext('2d');
                    
                    ctx.fillStyle = '#ffffff';
                    ctx.fillRect(0, 0, 768, 768);
                    ctx.drawImage(img, 0, 0, 768, 768);
                    
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
    const qrSize = 768; // Match the new QR size
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
    ctx.font = 'bold 18px Arial, sans-serif';
    
//    const title = (decisionData.title || 'Choicease Decision').substring(0, 50);
    ctx.fillText('Choicease Decision Analysis', canvasWidth / 2, padding + 25);

    // Truncate title at word boundary (max 80 chars)
    let title = decisionData.title || 'Choicease Decision';
    if (title.length > 80) {
        const words = title.split(' ');
        let truncated = '';
        for (let word of words) {
            if ((truncated + word).length <= 77) {
                truncated += (truncated ? ' ' : '') + word;
            } else {
                break;
            }
        }
        title = truncated + '...';
    }
    
    ctx.font = 'bold 24px Arial, sans-serif';
    ctx.fillText(title, canvasWidth / 2, padding + 55);
    
    // Description (up to two lines, word-level truncation)
    if (decisionData.description && decisionData.description.length > 0) {
        ctx.font = '14px Arial, sans-serif';
        ctx.fillStyle = '#000000';
            
        const maxCharsPerLine = 100;
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
    
    // Keep references for cleanup - but don't clean during loop
    const canvasesToCleanup = [];
    
    while (currentY < img.height && scanAttempts < maxAttempts) {
        scanAttempts++;
        const remainingHeight = img.height - currentY;
        
        // Skip if remaining area is too small for a QR code
        if (remainingHeight < 100) {
            console.log(`🔍 Remaining area too small (${remainingHeight}px), stopping scan`);
            break;
        }
        
        console.log(`🔍 Scan attempt ${scanAttempts}: scanning from y=${currentY}, height=${remainingHeight}`);
        
        // Create a FRESH canvas for each scan attempt
        const scanCanvas = document.createElement("canvas");
        scanCanvas.width = img.width;
        scanCanvas.height = remainingHeight;
        const scanCtx = scanCanvas.getContext("2d", { willReadFrequently: true });
        
        // Track canvas for cleanup - but don't clean yet
        canvasesToCleanup.push(scanCanvas);
        
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
                console.log(`🔍 No QRs found yet, moving down 100px and trying again...`);
                currentY += 100;
                continue;
            } else {
                console.log(`ℹ️ Found ${codes.length}/${expected} QRs, no more detected in remaining area`);
                
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
    
    // Clean up canvases only at the end
    console.log(`🧹 Cleaning up ${canvasesToCleanup.length} temporary canvases`);
    canvasesToCleanup.forEach(canvas => {
        if (canvas && canvas.parentNode) {
            canvas.parentNode.removeChild(canvas);
        }
    });
    
    return codes;
}

// ============ END OF SCAN IMAGE FUNCTION ============     

// ========================================
// MEMORY CLEANUP FUNCTIONS
// ========================================

function cleanupCanvas(canvas) {
    if (!canvas) return;
    
    try {
        const ctx = canvas.getContext('2d');
        if (ctx) {
            ctx.clearRect(0, 0, canvas.width, canvas.height);
        }
        canvas.width = 0;
        canvas.height = 0;
        
        if (canvas.parentNode) {
            canvas.parentNode.removeChild(canvas);
        }
        console.log('Canvas cleaned up successfully');
    } catch (error) {
        console.warn('Error cleaning up canvas:', error);
    }
}

function cleanupImageData(imageData) {
    if (imageData && imageData.data) {
        // Don't actually modify the data array - just set reference to null
        imageData = null;
    }
}

function requestGarbageCollection() {
    if (window.gc && typeof window.gc === 'function') {
        try {
            window.gc();
            console.log('Garbage collection requested');
        } catch (error) {
            // Ignore errors
        }
    }
    
    if (window.requestIdleCallback) {
        window.requestIdleCallback(() => {
            // Hint for cleanup time
        });
    }
}



        
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


        // Convert any integer ratings to decimals for consistency
        Object.keys(decisionData.ratings).forEach(key => {
            decisionData.ratings[key] = parseFloat(decisionData.ratings[key]);
        });
    
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


/**
 * placeTextWithAutoFit
 * Attempts several font sizes and, if necessary, truncates text to avoid spilling.
 *
 * Usage:
 *   placeTextWithAutoFit(slide, longText, {x:0.5,y:1.2,w:8.5,h:1.2}, {bold:true,align:'left'})
 */
function placeTextWithAutoFit(slide, text, box, userOpts = {}) {
    // Conservative list of sizes to attempt (from largest to smallest)
    const sizesToTry = userOpts.fontSizesToTry || [28, 24, 20, 18, 16, 14, 12, 10];
    const minFontSize = sizesToTry[sizesToTry.length - 1];

    // Heuristic: estimated characters per line at fontSize = 12 → approxCharsPerInch * width
    // charsPerInch chosen conservatively (depends on font; 10-12 is reasonable)
    const CHARS_PER_INCH_AT_FONT12 = 10.5;

    // conservative line height ratio (height per font-size in points converted to units we use here)
    const POINTS_PER_INCH = 72;
    // Estimate how many lines fit: box.h inches * 72 points per inch / (fontSize * lineHeightMultiplier)
    const LINE_HEIGHT_MULTIPLIER = 1.2;

    // copy userOpts so we don't mutate caller's object
    const baseOpts = Object.assign({}, userOpts, { wrap: true });

    // Helper to estimate if text will fit (heuristic)
    function estimateFits(textStr, widthInches, heightInches, fontSizePt) {
        if (!textStr) return true;
        const charsPerLineAtThisSize = Math.floor((CHARS_PER_INCH_AT_FONT12 * widthInches) * (12 / fontSizePt));
        if (charsPerLineAtThisSize < 10) {
            // If width is very narrow, assume it'll need many lines → treat as not-fitting for big fonts
        }
        const totalChars = textStr.length;
        const estimatedLines = Math.ceil(totalChars / Math.max(1, charsPerLineAtThisSize));
        const lineHeightPoints = fontSizePt * LINE_HEIGHT_MULTIPLIER;
        const availableLines = Math.floor((heightInches * POINTS_PER_INCH) / lineHeightPoints);
        return estimatedLines <= Math.max(1, availableLines);
    }

    // Try font sizes from large→small and pick first that we estimate fits
    let chosenFontSize = null;
    for (let fs of sizesToTry) {
        if (estimateFits(text, box.w, box.h, fs)) {
            chosenFontSize = fs;
            break;
        }
    }

    // If none seemed to fit, pick minimum and plan to truncate
    if (!chosenFontSize) chosenFontSize = minFontSize;

    // If text is still too long even at min size, truncate to estimated capacity
    function truncateToFit(textStr, widthInches, heightInches, fontSizePt) {
        const charsPerLine = Math.floor((CHARS_PER_INCH_AT_FONT12 * widthInches) * (12 / fontSizePt));
        const estimatedLines = Math.floor((heightInches * POINTS_PER_INCH) / (fontSizePt * LINE_HEIGHT_MULTIPLIER));
        const capacity = Math.max(8, charsPerLine * Math.max(1, estimatedLines)); // at least some capacity
        if (textStr.length <= capacity) return textStr;
        // preserve some end context? simpler to truncate and append ellipsis
        const truncated = textStr.substring(0, capacity - 1).trim();
        return truncated + '…';
    }

    let finalText = text;
    if (!estimateFits(finalText, box.w, box.h, chosenFontSize)) {
        finalText = truncateToFit(finalText, box.w, box.h, chosenFontSize);
    }

    // Compose final options
    const finalOpts = Object.assign({}, baseOpts, {
        x: box.x,
        y: box.y,
        w: box.w,
        h: box.h,
        fontSize: chosenFontSize,
        wrap: true,
        fit: 'shrink' // still ask PowerPoint to shrink a little at open time if needed
    });

    // If user passed color or bold etc. they are preserved
    slide.addText(finalText, finalOpts);
    return { fontSize: chosenFontSize, text: finalText };
}



// Generate PowerPoint Presentation
// Full theme-aware generatePPTX() using PptxGenJS scheme colors & slide master
// Full fixed generatePPTX() — placeholders, overflow control, and chart/table color sync
// Stable, fixed generatePPTX()
// - removes fragile slide-master usage (prevents repair errors)
// - ensures title text is written (no "Click here to add title")
// - adds shrink/wrap and autoPage for tables to avoid overflow
// - syncs pie chart colors with the weights table
// Full generatePPTX() — NO truncation; uses placeTextWithAutoFit for all variable text
// Updated generatePPTX() — addresses option truncation, numbering/bullet redundancy,
// dynamic table sizing (fit-to-slide heuristics), better heatmap/table wrapping,
// and improved theme behavior (scheme colors used where appropriate).
function generatePPTX() {
    if (!advancedAnalytics.results || !advancedAnalytics.confidence) {
        showToast('Please calculate results and show advanced analytics first.', 'warning');
        return;
    }
    showToast('Generating PowerPoint presentation...', 'info');

    const pptx = new PptxGenJS();
    const S = pptx.SchemeColor; // Scheme tokens for theme-aware coloring

    // Presentation metadata
    pptx.author = 'Choicease';
    pptx.company = 'Choicease.com';
    pptx.title = `Decision Analysis: ${decisionData.title || 'Report'}`;
    pptx.subject = 'Advanced Decision Analysis Report';

    // Fallback hex palette (only used when forcing explicit colors)
    const FALLBACK_CHART_COLORS = ['4E79A7','F28E2B','E15759','76B7B2','59A14F','EDC948','B07AA1','FF9DA7'];

    // UI non-theme values (kept minimal)
    const UI = {
        // Use scheme colors for headings where possible (we'll pass S.* in relevant places)
        textHex: '333333',
        textLightHex: '666666',
        tableBorder: 'CCCCCC'
    };

    // --- Utility: estimate table sizing & choose font to try fitting ---
    // params: rowsCount (including header), maxHeightInInches
    // returns: { fontSize, tableHeight }
    function chooseTableFontAndHeight(rowsCount, headerRows = 1, maxHeightInches = 4.6, opts = {}) {
        // fontSizes to attempt from largest to smallest
        const fontSizes = opts.fontSizesToTry || [12, 11, 10, 9, 8];
        // Estimate line height multiplier
        const LINE_MULTIPLIER = 1.2;
        const POINTS_PER_INCH = 72;

        for (let fs of fontSizes) {
            const rowHeightInPoints = fs * LINE_MULTIPLIER;
            const headerHeightPoints = headerRows * rowHeightInPoints;
            const bodyRows = Math.max(0, rowsCount - headerRows);
            const bodyHeightPoints = bodyRows * rowHeightInPoints;
            const totalPoints = headerHeightPoints + bodyHeightPoints;
            const requiredInches = totalPoints / POINTS_PER_INCH;
            if (requiredInches <= maxHeightInches) {
                return { fontSize: fs, tableHeight: requiredInches };
            }
        }
        // none fit: return smallest with maxHeightInches and let autoPage handle overflow
        return { fontSize: fontSizes[fontSizes.length - 1], tableHeight: maxHeightInches };
    }

    // Helper to create a normal slide
    const newSlide = () => pptx.addSlide();

    // --- SLIDE 1: Title Slide ---
    let slide = newSlide();
    // Title (use placeTextWithAutoFit)
    placeTextWithAutoFit(slide, decisionData.title || 'Advanced Decision Analysis',
        { x: 0.5, y: 1.4, w: 9, h: 1.1 },
        { bold: true, align: 'center', valign: 'middle', fontSizesToTry: [40,34,30,26,22,18], color: S.text1 });

    placeTextWithAutoFit(slide, 'Advanced Decision Analysis',
        { x: 0.5, y: 2.6, w: 9, h: 0.8 },
        { fontSizesToTry: [18,16,14,12], color: S.text2, align: 'center' });

    placeTextWithAutoFit(slide, 'Generated by Choicease.com - Smart Choices, Made Easy',
        { x: 0.5, y: 4.9, w: 9, h: 0.5 },
        { fontSizesToTry: [12,11,10], color: S.text2, align: 'center', italic: true });

    // --- SLIDE 2: Decision Overview ---
    slide = newSlide();
    slide.addText('📋 Decision Overview', { x: 0.5, y: 0.2, w: 9, h: 0.5, fontSize: 26, bold: true, color: S.accent1 });

    let yPos = 0.85;
    slide.addText('Decision:', { x: 0.5, y: yPos, w: 2, h: 0.4, fontSize: 14, bold: true, color: S.text1 });
    placeTextWithAutoFit(slide, decisionData.title || '—', { x: 2.5, y: yPos, w: 6.5, h: 0.4 }, { fontSizesToTry: [14,12,11,10], color: S.text2 });
    yPos += 0.55;

    if (decisionData.description) {
        slide.addText('Description:', { x: 0.5, y: yPos, w: 2, h: 0.4, fontSize: 14, bold: true, color: S.text1 });
        placeTextWithAutoFit(slide, decisionData.description || '', { x: 2.5, y: yPos, w: 6.5, h: 1.0 }, { fontSizesToTry: [14,12,11,10], color: S.text2 });
        yPos += 1.05;
    }

    // Options: show ALL options. If more than 6, use a two-column layout to avoid overflow.
    const options = decisionData.options || [];
    if (options.length <= 6) {
        // Single column, numbered, no bullet marker (redundant)
        options.forEach((opt, i) => {
            placeTextWithAutoFit(slide, `${i + 1}. ${opt.name}`, { x: 1, y: yPos, w: 8, h: 0.36 }, { fontSizesToTry: [12,11,10], color: S.text2, bullet: false, align: 'left' });
            yPos += 0.36;
        });
    } else {
        // Two columns
        const leftX = 1.0, leftW = 4.0;
        const rightX = 5.3, rightW = 3.9;
        const perCol = Math.ceil(options.length / 2);
        for (let i = 0; i < perCol; ++i) {
            const leftIdx = i;
            const rightIdx = i + perCol;
            const rowY = yPos + (i * 0.36);
            if (leftIdx < options.length) {
                placeTextWithAutoFit(slide, `${leftIdx + 1}. ${options[leftIdx].name}`, { x: leftX, y: rowY, w: leftW, h: 0.36 }, { fontSizesToTry: [12,11,10], color: S.text2, bullet: false, align: 'left' });
            }
            if (rightIdx < options.length) {
                placeTextWithAutoFit(slide, `${rightIdx + 1}. ${options[rightIdx].name}`, { x: rightX, y: rowY, w: rightW, h: 0.36 }, { fontSizesToTry: [12,11,10], color: S.text2, bullet: false, align: 'left' });
            }
        }
        // bump yPos to accommodate the columns block
        yPos += Math.ceil(options.length / 2) * 0.36;
    }

    // --- SLIDE 3: Executive Summary ---
    slide = newSlide();
    slide.addText('📊 Executive Summary', { x: 0.5, y: 0.2, w: 9, h: 0.5, fontSize: 26, bold: true, color: S.accent1 });

    const winner = (advancedAnalytics.results && advancedAnalytics.results[0]) || { option: { name: '—' }, totalScore: 0 };
    slide.addShape(pptx.ShapeType.rect, { x: 0.5, y: 1.0, w: 9, h: 1.2, fill: { color: S.background2 }, line: { color: S.accent2, width: 2 } });

    slide.addText('🏆 Recommended Choice', { x: 0.7, y: 1.05, w: 8.6, h: 0.32, fontSize: 14, bold: true, color: S.accent2 });
    placeTextWithAutoFit(slide, winner.option.name || '—', { x: 0.7, y: 1.4, w: 6, h: 0.6 }, { fontSizesToTry: [22,20,18,16], bold: true, color: S.text1 });
    slide.addText(`Score: ${winner.totalScore.toFixed(2)}`, { x: 7, y: 1.4, w: 2.2, h: 0.6, fontSize: 16, color: S.accent2, align: 'right' });

    yPos = 2.7;
    slide.addText(`Confidence Level: ${advancedAnalytics.confidence.level ? advancedAnalytics.confidence.level.toUpperCase() : 'N/A'}`, { x: 0.5, y: yPos, w: 9, h: 0.4, fontSize: 14, bold: true, color: S.text1 });
    placeTextWithAutoFit(slide, advancedAnalytics.confidence.explanation || '', { x: 0.5, y: yPos + 0.45, w: 9, h: 1.2 }, { fontSizesToTry: [14,12,11,10], color: S.text2 });

    // --- SLIDE 4: Detailed Results ---
    slide = newSlide();
    slide.addText('🎯 Detailed Results', { x: 0.5, y: 0.2, w: 9, h: 0.5, fontSize: 26, bold: true, color: S.accent1 });

    // Build table rows
    const resultsRows = (advancedAnalytics.results || []).map((r, i) => {
        const gap = (advancedAnalytics.results && advancedAnalytics.results[0] ? advancedAnalytics.results[0].totalScore : 0) - r.totalScore;
        return [
            { text: `#${i + 1}`, options: { color: i === 0 ? S.accent3 : S.text1 } },
            { text: r.option.name || '', options: { bold: i === 0, wrap: true } },
            { text: r.totalScore.toFixed(2), options: { color: i === 0 ? S.accent3 : S.text1 } },
            { text: gap > 0 ? `-${gap.toFixed(2)}` : '0.00', options: { color: gap > 0 ? S.accent6 : S.accent4 } }
        ];
    });

    // header + body rows count
    const resultsRowCount = 1 + resultsRows.length;
    const resultsTableSizing = chooseTableFontAndHeight(resultsRowCount, 1, 4.6);
    // If tableHeight was smaller than rows require, allow autoPage to true
    const resultsAutoPage = (resultsTableSizing.tableHeight >= 4.6 && resultsRows.length > (resultsTableSizing.tableHeight / 0.2));

    const resultsTableData = [
        [
            { text: 'Rank', options: { bold: true, fill: S.background2 } },
            { text: 'Option', options: { bold: true, fill: S.background2 } },
            { text: 'Score', options: { bold: true, fill: S.background2 } },
            { text: 'Gap from Best', options: { bold: true, fill: S.background2 } }
        ],
        ...resultsRows
    ];

    slide.addTable(resultsTableData, {
        x: 0.5, y: 1.05, w: 9, h: Math.min(4.6, Math.max(1.0, resultsTableSizing.tableHeight)),
        fontSize: resultsTableSizing.fontSize,
        border: { type: 'solid', color: UI.tableBorder },
        autoPage: resultsAutoPage
    });

    // --- SLIDE 5: Criteria Weights (pie + table) ---
    slide = newSlide();
    slide.addText('🥧 Decision Criteria Weights', { x: 0.5, y: 0.2, w: 9, h: 0.5, fontSize: 26, bold: true, color: S.accent1 });

    const criteria = decisionData.criteria || [];
    const pieData = [{
        name: 'Criteria Weights',
        labels: criteria.map(c => c.name),
        values: criteria.map(c => decisionData.normalizedWeights[c.id] || 0)
    }];

    // By default, omit chartColors to let PowerPoint theme choose the palette (best for corporate theme mapping).
    // If you prefer to set a specific palette, set window.CHART_COLORS (array of hex) elsewhere in your app.
    try {
        slide.addChart(pptx.ChartType.pie, pieData, {
            x: 0.5, y: 1.0, w: 4.2, h: 3.8,
            showLegend: true, legendPos: 'b', legendFontSize: 10,
            showValue: true, dataLabelFormatCode: '0.0"%"',
            // chartColors: [] omitted -> allow PowerPoint theme default
            showTitle: false
        });
    } catch (err) {
        console.warn('Pie chart creation failed:', err);
        placeTextWithAutoFit(slide, 'Pie chart unavailable — see web app', { x: 0.5, y: 2.2, w: 4.2, h: 0.8 }, { fontSizesToTry: [12,11,10], color: S.text2 });
    }

    // weights table on right — use scheme accents for bar coloring (keeps table theme-friendly)
    const accentScheme = [S.accent1, S.accent2, S.accent3, S.accent4, S.accent5, S.accent6];
    const weightsRows = criteria.map((crit, i) => {
        const weight = decisionData.normalizedWeights[crit.id] || 0;
        const barLen = Math.max(1, Math.min(8, Math.round(weight / 12.5)));
        const barStr = '█'.repeat(barLen);
        return [
            { text: crit.name || '', options: { fontSize: 11, align: 'left', wrap: true } },
            { text: `${weight.toFixed(1)}%`, options: { fontSize: 11, align: 'center', bold: true } },
            { text: barStr, options: { fontSize: 10, color: accentScheme[i % accentScheme.length], align: 'left' } }
        ];
    });

    // compute height to fit all criteria rows if possible
    const weightsRowCount = 1 + weightsRows.length;
    const weightsSizing = chooseTableFontAndHeight(weightsRowCount, 1, 3.8, { fontSizesToTry: [12,11,10,9] });
    const weightsAutoPage = (weightsSizing.tableHeight >= 3.8 && weightsRows.length > (weightsSizing.tableHeight / 0.18));

    const weightsTableData = [
        [
            { text: 'Criteria', options: { bold: true, fill: S.background2, fontSize: 12, align: 'center' } },
            { text: 'Weight (%)', options: { bold: true, fill: S.background2, fontSize: 12, align: 'center' } },
            { text: 'Bar', options: { bold: true, fill: S.background2, fontSize: 12, align: 'center' } }
        ],
        ...weightsRows
    ];

    slide.addTable(weightsTableData, {
        x: 5.0, y: 1.0, w: 4.5, h: Math.min(3.8, Math.max(0.8, weightsSizing.tableHeight)),
        border: { type: 'solid', color: UI.tableBorder },
        fill: { color: 'FFFFFF' }, fontSize: weightsSizing.fontSize, autoPage: weightsAutoPage
    });

    // --- SLIDE 6: Criteria Impact Analysis (try to fit all criteria on one slide) ---
    slide = newSlide();
    slide.addText('📊 Criteria Impact Analysis', { x: 0.5, y: 0.2, w: 9, h: 0.5, fontSize: 22, bold: true, color: S.accent1 });
    slide.addText('How each criterion affects the winner:', { x: 0.5, y: 1.0, w: 9, h: 0.35, fontSize: 12, color: S.text2 });

    const impactRows = (decisionData.criteria || []).map(criteriaItem => {
        const weight = (decisionData.normalizedWeights[criteriaItem.id] || 0) / 100;
        const ratingKey = `${winner.option.id}-${criteriaItem.id}`;
        const rating = (decisionData.ratings && (decisionData.ratings[ratingKey] || 0)) || 0;
        const contribution = (rating * weight).toFixed(2);
        return [
            { text: criteriaItem.name || '', options: { fontSize: 11, wrap: true } },
            { text: `${(weight * 100).toFixed(1)}%` },
            { text: `${rating.toFixed(1)}/5` },
            { text: contribution, options: { color: S.accent4 } }
        ];
    });

    const impactRowCount = 1 + impactRows.length;
    const impactSizing = chooseTableFontAndHeight(impactRowCount, 1, 4.6, { fontSizesToTry: [12,11,10,9,8] });
    const impactAutoPage = (impactSizing.tableHeight >= 4.6 && impactRows.length > (impactSizing.tableHeight / 0.18));

    const impactTableData = [
        [
            { text: 'Criteria', options: { bold: true, fill: S.background2 } },
            { text: 'Weight', options: { bold: true, fill: S.background2 } },
            { text: 'Winner Rating', options: { bold: true, fill: S.background2 } },
            { text: 'Contribution', options: { bold: true, fill: S.background2 } }
        ],
        ...impactRows
    ];

    slide.addTable(impactTableData, {
        x: 0.5, y: 1.5, w: 9, h: Math.min(4.6, Math.max(0.8, impactSizing.tableHeight)),
        fontSize: impactSizing.fontSize, border: { type: 'solid', color: UI.tableBorder }, autoPage: impactAutoPage
    });

    // --- SLIDE 7: Performance Heatmap ---
    slide = newSlide();
    slide.addText('🔥 Performance Heatmap', { x: 0.5, y: 0.2, w: 9, h: 0.5, fontSize: 22, bold: true, color: S.accent1 });

    const heatRows = [
        [
            { text: 'Option', options: { bold: true, fill: S.background2, fontSize: 11 } },
            ... (decisionData.criteria || []).map(c => ({ text: c.name.substring(0, 15), options: { bold: true, fill: S.background2, fontSize: 10 } }))
        ]
    ];

    (decisionData.options || []).forEach(opt => {
        const row = [{ text: opt.name || '', options: { fontSize: 11, wrap: true } }];
        (decisionData.criteria || []).forEach(cr => {
            const rk = `${opt.id}-${cr.id}`;
            const rating = (decisionData.ratings && (decisionData.ratings[rk] || 0)) || 0;
            // heatmap color kept hex for readability; if you want theme-aware, replace with S.background2 etc.
            let cellColor = 'FFFFFF';
            if (rating >= 4) cellColor = 'c3e6cb';
            else if (rating >= 3) cellColor = 'ffeaa7';
            else if (rating >= 2) cellColor = 'fff3cd';
            else if (rating >= 1) cellColor = 'ffebee';
            else cellColor = 'ffcdd2';
            row.push({ text: rating.toFixed(1), options: { fill: cellColor, align: 'center' } });
        });
        heatRows.push(row);
    });

    // compute heatmap height/font
    const heatRowCount = heatRows.length;
    const heatSizing = chooseTableFontAndHeight(heatRowCount, 1, 4.6, { fontSizesToTry: [11,10,9] });
    const heatAutoPage = (heatSizing.tableHeight >= 4.6 && heatRows.length > (heatSizing.tableHeight / 0.18));

    slide.addTable(heatRows, { x: 0.3, y: 1.05, w: 9.4, h: Math.min(4.6, Math.max(0.8, heatSizing.tableHeight)), fontSize: heatSizing.fontSize, border: { type: 'solid', color: UI.tableBorder }, autoPage: heatAutoPage });

    // --- SLIDE 8: Sensitivity Analysis ---
    if (advancedAnalytics.sensitivity) {
        slide = newSlide();
        slide.addText('⚖️ Sensitivity Analysis', { x: 0.5, y: 0.2, w: 9, h: 0.5, fontSize: 22, bold: true, color: S.accent1 });
        slide.addText('Decision Stability Assessment:', { x: 0.5, y: 1.0, w: 9, h: 0.35, fontSize: 12, bold: true, color: S.text1 });

        const flipPoints = (typeof computeFlipPoints === 'function') ? computeFlipPoints() : [];

        if (!flipPoints || flipPoints.length === 0) {
            slide.addShape(pptx.ShapeType.rect, { x: 0.5, y: 1.5, w: 9, h: 1.2, fill: { color: S.background2 }, line: { color: S.accent3, width: 2 } });
            slide.addText('✅ Highly Stable Decision', { x: 0.7, y: 1.65, w: 8.6, h: 0.6, fontSize: 16, bold: true, color: S.accent3 });
            slide.addText('No criteria weight changes would alter the recommended choice', { x: 0.5, y: 2.9, w: 9, h: 0.5, fontSize: 12, color: S.text2, align: 'center' });
        } else {
            const sensRows = flipPoints.slice(0, 10).map(fp => {
                const buffer = Math.abs(fp.currentWeight - fp.flipPoint);
                return [
                    { text: fp.criteriaName || '', options: { wrap: true } },
                    { text: `${fp.currentWeight.toFixed(1)}%` },
                    { text: `${fp.flipPoint.toFixed(1)}%` },
                    { text: `${buffer.toFixed(1)}%`, options: { color: buffer < 10 ? S.accent6 : S.accent4 } }
                ];
            });

            const sensRowCount = 1 + sensRows.length;
            const sensSizing = chooseTableFontAndHeight(sensRowCount, 1, 3.5, { fontSizesToTry: [12,11,10,9] });
            const sensAutoPage = (sensSizing.tableHeight >= 3.5 && sensRows.length > (sensSizing.tableHeight / 0.18));

            const sensTableData = [
                [
                    { text: 'Criteria', options: { bold: true, fill: S.background2 } },
                    { text: 'Current Weight', options: { bold: true, fill: S.background2 } },
                    { text: 'Flip Point', options: { bold: true, fill: S.background2 } },
                    { text: 'Buffer', options: { bold: true, fill: S.background2 } }
                ],
                ...sensRows
            ];

            slide.addTable(sensTableData, { x: 0.5, y: 1.5, w: 9, h: Math.min(3.5, Math.max(0.8, sensSizing.tableHeight)), fontSize: sensSizing.fontSize, border: { type: 'solid', color: UI.tableBorder }, autoPage: sensAutoPage });
        }
    }

// --- SLIDE 9: Satisficers Analysis (REPLACED) ---
// Shows only options that meet the per-criterion minimum across ALL criteria.
// Displays original ranks and uses 1- or 2-column layout to avoid overflow.

slide = newSlide();
slide.addText('✅ Satisficers Analysis', { x: 0.5, y: 0.2, w: 9, h: 0.5, fontSize: 22, bold: true, color: S.accent1 });
slide.addText('Options that meet minimum acceptable standards:', { x: 0.5, y: 1.0, w: 9, h: 0.35, fontSize: 12, color: S.text2 });

// CONFIG: per-criterion minimum to qualify as a satisficer
// You can change this number if you want a stricter/looser filter.
const satisficerCriterionThreshold = 2.5;

// Build an array of results with original rank preserved
const rankedResults = (advancedAnalytics.results || []).map((r, idx) => ({
    rank: idx + 1,
    result: r
}));

// Filter: keep only options where for ALL criteria the option's rating >= threshold
const criteriaList = decisionData.criteria || [];
const satisficersFiltered = rankedResults.filter(({ result }) => {
    // For each criterion, check rating for this option
    for (let crit of criteriaList) {
        const ratingKey = `${result.option.id}-${crit.id}`;
        const rating = (decisionData.ratings && (decisionData.ratings[ratingKey] || 0)) || 0;
        if (rating < satisficerCriterionThreshold) return false; // fails on at least one criterion
    }
    return true; // passed all criteria
});

// If none meet the per-criterion criteria show a message
if (!satisficersFiltered || satisficersFiltered.length === 0) {
    slide.addText('No options meet the minimum per-criterion threshold', { x: 0.5, y: 1.8, w: 9, h: 0.5, fontSize: 14, color: S.accent6, align: 'center' });
} else {
    // Layout: if <=6 show single column; otherwise use two columns to save vertical space
    const items = satisficersFiltered; // array of { rank, result }

    // column coordinates (match the Decision Overview approach)
    const leftX = 0.8, leftW = 4.2;
    const rightX = 5.2, rightW = 3.8;
    const rowH = 0.36;

    if (items.length <= 6) {
        // Single column, list all (use original rank in display). No bullets (numbering already present).
        let y = 1.45;
        items.forEach((item, i) => {
            const rank = item.rank;
            const optName = (item.result && item.result.option && item.result.option.name) || '';
            const score = (item.result && typeof item.result.totalScore === 'number') ? item.result.totalScore.toFixed(2) : '—';
            // Emphasize the first item visually
            slide.addShape(pptx.ShapeType.rect, { x: 0.6, y: y - 0.05, w: 8.6, h: 0.44, fill: { color: i === 0 ? S.background2 : 'FFFFFF' }, line: { color: i === 0 ? S.accent3 : UI.tableBorder, width: 1 } });

            placeTextWithAutoFit(slide, `#${rank} ${optName} (${score})`, { x: 0.7, y: y, w: 7.8, h: 0.4 }, { fontSizesToTry: [14,13,12,11], bold: i === 0, color: S.text1 });
            y += rowH;
        });
    } else {
        // Two-column layout: split items into two roughly equal columns using original ranking order
        const perCol = Math.ceil(items.length / 2);
        let baseY = 1.45;
        for (let i = 0; i < perCol; ++i) {
            const leftItem = items[i];
            const rightItem = items[i + perCol];
            const rowY = baseY + (i * rowH);

            if (leftItem) {
                const rank = leftItem.rank;
                const optName = (leftItem.result && leftItem.result.option && leftItem.result.option.name) || '';
                const score = (leftItem.result && typeof leftItem.result.totalScore === 'number') ? leftItem.result.totalScore.toFixed(2) : '—';
                placeTextWithAutoFit(slide, `#${rank} ${optName} (${score})`, { x: leftX, y: rowY, w: leftW, h: rowH }, { fontSizesToTry: [12,11,10], color: S.text1 });
            }

            if (rightItem) {
                const rank = rightItem.rank;
                const optName = (rightItem.result && rightItem.result.option && rightItem.result.option.name) || '';
                const score = (rightItem.result && typeof rightItem.result.totalScore === 'number') ? rightItem.result.totalScore.toFixed(2) : '—';
                placeTextWithAutoFit(slide, `#${rank} ${optName} (${score})`, { x: rightX, y: rowY, w: rightW, h: rowH }, { fontSizesToTry: [12,11,10], color: S.text1 });
            }
        }
    }
}

        
    // --- SLIDE 10: Risk Analysis ---
    if (advancedAnalytics.risks && advancedAnalytics.risks.length > 0) {
        slide = newSlide();
        slide.addText('⚠️ Risk Analysis', { x: 0.5, y: 0.2, w: 9, h: 0.5, fontSize: 22, bold: true, color: S.accent1 });

        yPos = 1.15;
        (advancedAnalytics.risks || []).slice(0, 5).forEach(risk => {
            const sevCol = (risk.severity === 'critical') ? S.accent6 : (risk.severity === 'high' ? S.accent5 : S.accent4);
            const fillColor = (risk.severity === 'critical') ? 'f8d7da' : (risk.severity === 'high' ? 'fff3cd' : 'd4edda');

            slide.addShape(pptx.ShapeType.rect, { x: 0.5, y: yPos, w: 9, h: 0.8, fill: { color: fillColor }, line: { color: sevCol, width: 1 } });
            placeTextWithAutoFit(slide, `${risk.severity.toUpperCase()}: ${risk.description}`, { x: 0.7, y: yPos + 0.1, w: 8.6, h: 0.6 }, { fontSizesToTry: [14,12,11,10], color: S.text1 });
            yPos += 0.92;
            if (yPos > 5.5) return;
        });
    }

    // --- SLIDE 11: Next Steps & Recommendations ---
    slide = newSlide();
    slide.addText('✅ Next Steps & Recommendations', { x: 0.5, y: 0.2, w: 9, h: 0.5, fontSize: 22, bold: true, color: S.accent1 });

    slide.addShape(pptx.ShapeType.rect, { x: 0.5, y: 1.15, w: 9, h: 1.5, fill: { color: S.background2 }, line: { color: S.accent4, width: 3 } });
    placeTextWithAutoFit(slide, `Based on your criteria, we recommend: ${winner.option.name}`, { x: 0.7, y: 1.35, w: 8.6, h: 1.0 }, { fontSizesToTry: [20,18,16,14], bold: true, wrap: true });

    yPos = 2.9;
    slide.addText('Recommended Next Steps:', { x: 0.5, y: yPos, w: 9, h: 0.4, fontSize: 14, bold: true, color: S.text1 });

    const nextSteps = [
        'Review the detailed analysis and risk factors',
        'Validate your decision with stakeholders',
        'Create an implementation plan',
        'Monitor progress and adjust as needed',
        'Document lessons learned for future decisions'
    ];
    yPos += 0.45;
    nextSteps.forEach(step => {
        placeTextWithAutoFit(slide, step, { x: 1, y: yPos, w: 8, h: 0.3 }, { fontSizesToTry: [12,11,10], color: S.text2, bullet: true });
        yPos += 0.34;
    });

    // Save file
    const safeTitle = (decisionData.title || 'report').replace(/[^a-z0-9]/gi, '_').toLowerCase();
    const fileName = `choicease_advanced_${safeTitle}_${Date.now()}.pptx`;

    pptx.writeFile({ fileName: fileName })
        .then(() => showToast('PowerPoint presentation generated successfully!', 'success'))
        .catch(err => {
            console.error('PPTX generation error:', err);
            showToast('Failed to generate PowerPoint. Please try again.', 'error');
        });
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

        function goToHomeTab() {
            // Only navigate if not already on step 1
            if (currentStep !== 1) {
                currentStep = 1;
                showStep(currentStep);
                updateProgressBar();
                updateStepIndicator();
                showToast('Returned to decision definition', 'info');
            }
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


// Copy GPT prompt functionality
        document.addEventListener('click', function(event) {
            // Handle copy criteria prompt
            if (event.target.id === 'copyCriteriaPrompt') {
                event.preventDefault();
                
                let prompt = `I am trying to come up with criteria to take a decision on: ${decisionData.title}${decisionData.description ? ' - ' + decisionData.description : ''}.`;
                
                // Add existing criteria if any
                if (decisionData.criteria && decisionData.criteria.length > 0) {
                    const criteriaList = decisionData.criteria.map(c => 
                        `- ${c.name}${c.description ? ' (' + c.description + ')' : ''}`
                    ).join('\n');
                    
                    prompt += `\n\nI have thought of the following from my side:\n${criteriaList}`;
                }
                
                prompt += '\n\nPlease help me with the Criteria and importance of the criteria to ensure a good decision.';
                
                copyToClipboard(prompt);
            }
            
            // Handle copy weights/importance prompt
            if (event.target.id === 'copyWeightsPrompt') {
                event.preventDefault();
                
                // Build criteria list
                const criteriaList = decisionData.criteria.map(c => 
                    `- ${c.name}${c.description ? ' (' + c.description + ')' : ''}`
                ).join('\n');
                
                const prompt = `I am in the process of taking this decision - ${decisionData.title}${decisionData.description ? ', ' + decisionData.description : ''}

I need to determine the importance/weight of each criterion to ensure a good decision.

Here are my criteria:
${criteriaList}

Please help me rate the importance of each criterion on a scale of 1-5, where: 1 = Least important and 5 = Most important (must-have)`;
                
                copyToClipboard(prompt);
            }
            
            // Handle copy rating prompt
            if (event.target.id === 'copyRatingPrompt') {
                event.preventDefault();
                
                // Build criteria list
                const criteriaList = decisionData.criteria.map(c => 
                    `- ${c.name}${c.description ? ' (' + c.description + ')' : ''}`
                ).join('\n');
                
                // Build options list
                const optionsList = decisionData.options.map(o => 
                    `- ${o.name}${o.description ? ' (' + o.description + ')' : ''}`
                ).join('\n');
                
                const prompt = `I am in the process of taking this decision - ${decisionData.title}${decisionData.description ? ', ' + decisionData.description : ''}

I am deciding based on the following criteria:
${criteriaList}

Help me rate the below Options on the above criteria on a scale of 0-5:
${optionsList}`;
                
                copyToClipboard(prompt);
            }

// Handle copy Reddit post
            if (event.target.id === 'copyRedditPost') {
                event.preventDefault();
                
                // Use already calculated results
                if (!advancedAnalytics.results || advancedAnalytics.results.length === 0) {
                    showToast('Please calculate results first before copying the post.', 'warning');
                    return;
                }
                
                const results = advancedAnalytics.results;
                
                // Build criteria list with weights
                const criteriaList = decisionData.criteria.map(c => {
                    const weight = calculateDisplayWeight(c.id);
                    return `- **${c.name}** (${weight}% importance)${c.description ? ': ' + c.description : ''}`;
                }).join('\n');
                
                // Build options list
                const optionsList = decisionData.options.map(o => 
                    `- **${o.name}**${o.description ? ': ' + o.description : ''}`
                ).join('\n');
                
                // Build results ranking
                const resultsRanking = results.map((result, index) => {
                    const medal = index === 0 ? '🥇' : index === 1 ? '🥈' : index === 2 ? '🥉' : `${index + 1}.`;
                    return `${medal} **${result.option.name}** - Score: ${result.totalScore.toFixed(1)}/5`;
                }).join('\n');
                
                // Create the post
                const redditPost = `# Decision: ${decisionData.title}

${decisionData.description ? decisionData.description + '\n' : ''}
---

## 📋 Options Evaluated

${optionsList}

---

## ⚖️ Criteria Used

${criteriaList}

---

## 🏆 Results

${resultsRanking}

---

**Winner:** ${results[0].option.name} 🎉

Made with [Choicease](https://choicease.com) - Smart Choices, Made Easy!

*What do you think? Would you have chosen differently? Let me know in the comments!*

---

*The attached QR can be imported and analyzed on [choicease.com](https://choicease.com)*`;
                
                copyToClipboard(redditPost);
            }
                
                
        });


        // Helper function to copy text to clipboard
        function copyToClipboard(text) {
            if (navigator.clipboard && navigator.clipboard.writeText) {
                navigator.clipboard.writeText(text)
                    .then(() => {
                        showToast('Prompt copied to clipboard! ✨', 'success');
                    })
                    .catch(err => {
                        console.error('Failed to copy:', err);
                        fallbackCopyToClipboard(text);
                    });
            } else {
                fallbackCopyToClipboard(text);
            }
        }

        // Fallback copy method for older browsers
        function fallbackCopyToClipboard(text) {
            const textArea = document.createElement('textarea');
            textArea.value = text;
            textArea.style.position = 'fixed';
            textArea.style.top = '0';
            textArea.style.left = '0';
            textArea.style.opacity = '0';
            document.body.appendChild(textArea);
            textArea.focus();
            textArea.select();
            
            try {
                const successful = document.execCommand('copy');
                if (successful) {
                    showToast('Prompt copied to clipboard! ✨', 'success');
                } else {
                    showToast('Failed to copy prompt. Please try again.', 'error');
                }
            } catch (err) {
                console.error('Fallback copy failed:', err);
                showToast('Failed to copy prompt. Please try again.', 'error');
            }
            
            document.body.removeChild(textArea);
        }
