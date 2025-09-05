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
            const currentRating = decisionData.ratings[ratingKey] || 3;
            html += `
                <div class="rating-row">
                    <span class="option-name">${option.name}</span>
                    <div class="rating-controls">
                        <span style="font-size: 0.9rem; color: #666;">[1]</span>
                        <input type="range" min="1" max="5" value="${currentRating}" 
                               class="slider" role="slider" aria-label="Rating for ${option.name} on ${criteria.name}"
                               aria-valuemin="1" aria-valuemax="5" aria-valuenow="${currentRating}"
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
        function calculateResults() {
            const results = [];
            decisionData.options.forEach(option => {
                let totalScore = 0;
                const criteriaScores = {};
                decisionData.criteria.forEach(criteria => {
                    const ratingKey = `${option.id}-${criteria.id}`;
                    const rating = decisionData.ratings[ratingKey] || 3;
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
            displayResults(results);
            nextStep();
        }

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

            const maxScore = Math.max(...results.map(r => r.totalScore));
            results.forEach((result, index) => {
                const card = document.createElement('div');
                card.className = `result-card ${index === 0 ? 'winner' : ''}`;
                
                if (index === 0) {
                    const winnerBadge = document.createElement('div');
                    winnerBadge.style.textAlign = 'center';
                    winnerBadge.style.color = '#28a745';
                    winnerBadge.style.fontWeight = 'bold';
                    winnerBadge.style.marginBottom = '10px';
                    winnerBadge.textContent = '🏆 WINNER';
                    card.appendChild(winnerBadge);
                }

                const h3 = document.createElement('h3');
                h3.style.marginBottom = '10px';
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
                scoreText.textContent = `Score: ${result.totalScore.toFixed(2)}/5.0`;
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
    
    // Decision Title Section
    doc.setTextColor(...textDark);
    doc.setFillColor(...backgroundColor);
    doc.rect(10, yPos - 5, pageWidth, 25, 'F');
    doc.setDrawColor(200, 200, 200);
    doc.rect(10, yPos - 5, pageWidth, 25, 'S');
    
    doc.setFontSize(16);
    doc.setFont(undefined, 'bold');
    doc.text(`Decision: ${decisionData.title}`, 15, yPos + 5);
    yPos += 15;
    
    if (decisionData.description) {
        doc.setFontSize(11);
        doc.setFont(undefined, 'normal');
        doc.setTextColor(...textLight);
        const contextLines = doc.splitTextToSize(`Context: ${decisionData.description}`, pageWidth - 10);
        doc.text(contextLines, 15, yPos);
        yPos += contextLines.length * 5 + 5;
    }
    
    doc.setFontSize(9);
    doc.setTextColor(...textLight);
    doc.text(`Generated: ${new Date().toLocaleString()}`, 15, yPos + 5);
    yPos += 25;
    
    // Calculate results
    const results = [];
    decisionData.options.forEach(option => {
        let totalScore = 0;
        const criteriaScores = {};
        decisionData.criteria.forEach(criteria => {
            const ratingKey = `${option.id}-${criteria.id}`;
            const rating = decisionData.ratings[ratingKey] || 3;
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
    results.sort((a, b) => b.totalScore - a.totalScore);
    
    // Executive Summary Box
    doc.setFillColor(245, 245, 245);
    doc.rect(10, yPos, pageWidth, 30, 'F');
    doc.setDrawColor(...primaryColor);
    doc.setLineWidth(1);
    doc.rect(10, yPos, pageWidth, 30, 'S');
    
    doc.setTextColor(...primaryColor);
    doc.setFontSize(14);
    doc.setFont(undefined, 'bold');
    doc.text('Executive Summary', 15, yPos + 8);
    
    doc.setTextColor(...textDark);
    doc.setFontSize(11);
    doc.setFont(undefined, 'normal');
    doc.text(`Recommended Choice: ${results[0].name}`, 15, yPos + 16);
    doc.text(`Score: ${results[0].totalScore.toFixed(2)}/5.0 (${Math.round((results[0].totalScore/5)*100)}%)`, 15, yPos + 23);
    
    yPos += 45;
    
    // Results Section with Visual Bars
    doc.setTextColor(...primaryColor);
    doc.setFontSize(14);
    doc.setFont(undefined, 'bold');
    doc.text('Ranking & Scores', 15, yPos);
    yPos += 15;
    
    const maxScore = Math.max(...results.map(r => r.totalScore));
    results.forEach((result, index) => {
        if (yPos > 250) {
            doc.addPage();
            yPos = 20;
        }
        
        // Option name and rank
        doc.setTextColor(...textDark);
        doc.setFontSize(12);
        doc.setFont(undefined, 'bold');
        const rankText = `${index + 1}. ${result.name}`;
        doc.text(rankText, 15, yPos);
        
        // Winner badge
        if (index === 0) {
            doc.setTextColor(...successColor);
            doc.setFontSize(10);
            doc.text('WINNER', 170, yPos);
        }
        
        yPos += 8;
        
        // Score bar
        const barWidth = 120;
        const barHeight = 8;
        const scoreWidth = (result.totalScore / maxScore) * barWidth;
        
        // Background bar
        doc.setFillColor(230, 230, 230);
        doc.rect(15, yPos, barWidth, barHeight, 'F');
        
        // Score bar
        if (index === 0) {
            doc.setFillColor(...successColor);
        } else {
            doc.setFillColor(...primaryColor);
        }
        doc.rect(15, yPos, scoreWidth, barHeight, 'F');
        
        // Score text
        doc.setTextColor(...textDark);
        doc.setFontSize(10);
        doc.setFont(undefined, 'bold');
        doc.text(`${result.totalScore.toFixed(2)}/5.0`, 140, yPos + 6);
        
        yPos += 15;
        
        // Description if exists
        if (result.description) {
            doc.setFontSize(9);
            doc.setFont(undefined, 'normal');
            doc.setTextColor(...textLight);
            const descLines = doc.splitTextToSize(result.description, pageWidth - 20);
            doc.text(descLines, 20, yPos);
            yPos += descLines.length * 4 + 5;
        }
        
        yPos += 5;
    });
    
    // New page for criteria details
    doc.addPage();
    yPos = 20;
    
    // Criteria Section
    doc.setTextColor(...primaryColor);
    doc.setFontSize(14);
    doc.setFont(undefined, 'bold');
    doc.text('Decision Criteria & Weights', 15, yPos);
    yPos += 15;
    
    decisionData.criteria.forEach(criteria => {
        const weight = calculateDisplayWeight(criteria.id);
        
        // Criteria name with weight bar
        doc.setTextColor(...textDark);
        doc.setFontSize(11);
        doc.setFont(undefined, 'bold');
        doc.text(`${criteria.name}`, 15, yPos);
        
        // Weight bar
        const weightBarWidth = 60;
        const weightWidth = (weight / 100) * weightBarWidth;
        
        doc.setFillColor(240, 240, 240);
        doc.rect(120, yPos - 4, weightBarWidth, 6, 'F');
        
        doc.setFillColor(...secondaryColor);
        doc.rect(120, yPos - 4, weightWidth, 6, 'F');
        
        doc.setFontSize(9);
        doc.text(`${weight}%`, 185, yPos);
        
        yPos += 8;
        
        if (criteria.description) {
            doc.setFontSize(9);
            doc.setFont(undefined, 'normal');
            doc.setTextColor(...textLight);
            const descLines = doc.splitTextToSize(criteria.description, pageWidth - 20);
            doc.text(descLines, 20, yPos);
            yPos += descLines.length * 4 + 3;
        }
        
        yPos += 5;
    });
    
    // Methodology section
    yPos += 10;
    doc.setFillColor(250, 250, 250);
    doc.rect(10, yPos, pageWidth, 35, 'F');
    doc.setDrawColor(200, 200, 200);
    doc.rect(10, yPos, pageWidth, 35, 'S');
    
    doc.setTextColor(...primaryColor);
    doc.setFontSize(12);
    doc.setFont(undefined, 'bold');
    doc.text('Methodology', 15, yPos + 8);
    
    doc.setTextColor(...textDark);
    doc.setFontSize(9);
    doc.setFont(undefined, 'normal');
    const methodology = [
        'This analysis uses a weighted scoring model where:',
        '• Each option is rated 1-5 on each criteria',
        '• Criteria importance weights are normalized to 100%',
        '• Final scores = Σ(rating × weight) for each option',
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

// Toggle export dropdown visibility
function toggleExportDropdown() {
    const dropdown = document.getElementById('exportDropdown');
    dropdown.classList.toggle('show');
}

// Handle export selection
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
            downloadPDFReport();
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
            const rating = decisionData.ratings[ratingKey] || 3;
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
    csvContent += 'Rating Scale,"1-5 (1=Poor, 5=Excellent)"\n';
    csvContent += 'Weight Calculation,"Normalized to 100% based on importance ratings"\n';
    csvContent += 'Final Score Formula,"Sum of (Rating x Weight) for each criteria"\n';
    csvContent += 'Maximum Possible Score,5.0\n';
    
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
            const rating = decisionData.ratings[ratingKey] || 3;
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
            const rating = decisionData.ratings[ratingKey] || 3;
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
                const rating = decisionData.ratings[ratingKey] || 3;
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
            alert('Error reading file. Please ensure it\'s a valid JSON file.');
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
                alert('QR import failed: ' + error.message);
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
            if (confirm('Are you sure you want to start a new decision? This will clear all current data.')) {
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

function showToast(message, type = 'success') {
    const toast = document.createElement('div');
    toast.textContent = message;
    toast.style.cssText = `
        position: fixed;
        bottom: 20px;
        right: 20px;
        background: ${type === 'success' ? '#4caf50' : '#f44336'};
        color: white;
        padding: 12px 20px;
        border-radius: 8px;
        box-shadow: 0 4px 12px rgba(0,0,0,0.3);
        z-index: 10000;
        font-weight: 500;
        max-width: 300px;
        word-wrap: break-word;
        transition: opacity 0.3s ease;
    `;
    
    document.body.appendChild(toast);
    setTimeout(() => toast.style.opacity = '0', 3000);
    setTimeout(() => toast.remove(), 3500);
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
