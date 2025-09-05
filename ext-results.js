/**
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

            const accordionContainer = document.getElementById('ext_resultsAccordion');
            if (!accordionContainer) {
                throw new Error('Results accordion container not found');
            }

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
    function ext_renderWeightsPie(decisionCopy) {
        if (!window.ExtChart) {
            console.warn('Chart.js not available for pie chart');
            return;
        }

        const canvas = document.getElementById('ext_weightsPie');
        const container = document.getElementById('ext_weightsPieContainer');
        if (!canvas || !container) return;

        // Prepare data
        const labels = decisionCopy.criteria.map(c => c.name);
        const data = decisionCopy.criteria.map(c => Math.round(decisionCopy.normalizedWeights[c.id] || 0));
        const colors = ext_generateColors(labels.length);

        // Destroy existing chart if it exists
        if (ext_state.charts.pie) {
            ext_state.charts.pie.destroy();
        }

        const ctx = canvas.getContext('2d');
        ext_state.charts.pie = new ExtChart(ctx, {
            type: 'pie',
            data: {
                labels: labels,
                datasets: [{
                    data: data,
                    backgroundColor: colors,
                    borderColor: '#fff',
                    borderWidth: 2
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
                                const value = context.parsed;
                                return `${label}: ${value}%`;
                            }
                        }
                    },
                    datalabels: {
                        color: '#fff',
                        font: {
                            weight: 'bold',
                            size: 14
                        },
                        formatter: function(value, context) {
                            return value > 5 ? `${value}%` : ''; // Only show label if slice is large enough
                        }
                    }
                },
                animation: {
                    duration: ext_config.animationDuration
                }
            },
            plugins: [window.ChartDataLabels]
        });
    }

    /**
     * Render performance heatmap
     */
    function ext_renderHeatmap(decisionCopy, results) {
        const container = document.getElementById('ext_heatmapContainer');
        if (!container) return;

        const heatmapHTML = `
            <div class="ext-chart-container">
                <h4>Performance Matrix</h4>
                <p style="color: #666; margin-bottom: 15px;">
                    Color scale: Rating 4-5 (green), 3 (yellow), 1-2 (red). Click cells for details.
                </p>
                <div class="ext-heatmap">
                    <table class="ext-heatmap-table">
                        <thead>
                            <tr>
                                <th>Option</th>
                                ${decisionCopy.criteria.map(c => `<th>${ext_safeHtml(c.name)}</th>`).join('')}
                                <th>Total Score</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${results.map(result => `
                                <tr>
                                    <td style="text-align: left; font-weight: 600;">
                                        ${ext_safeHtml(result.option.name)}
                                    </td>
                                    ${decisionCopy.criteria.map(criteria => {
                                        const scores = result.criteriaScores[criteria.name];
                                        const rating = scores ? scores.rating : 3;
                                        const weightedScore = scores ? scores.weightedScore : 0;
                                        const weight = scores ? scores.weight : 0;
                                        
                                        return `
                                            <td class="ext-heatmap-cell rating-${rating}" 
                                                data-rating="${rating}" 
                                                data-weighted="${ext_safeNumber(weightedScore, 3)}"
                                                data-weight="${Math.round(weight)}"
                                                data-option="${ext_safeHtml(result.option.name)}"
                                                data-criteria="${ext_safeHtml(criteria.name)}">
                                                ${rating}
                                            </td>
                                        `;
                                    }).join('')}
                                    <td style="font-weight: bold; background: ${result === results[0] ? '#28a745' : '#f8f9fa'}; color: ${result === results[0] ? 'white' : '#333'};">
                                        ${ext_safeNumber(result.totalScore, 2)}
                                    </td>
                                </tr>
                            `).join('')}
                        </tbody>
                    </table>
                </div>
            </div>
        `;

        container.innerHTML = heatmapHTML;
        ext_initializeHeatmapTooltips();
    }

    /**
     * Initialize heatmap cell tooltips
     */
    function ext_initializeHeatmapTooltips() {
        const cells = document.querySelectorAll('.ext-heatmap-cell[data-rating]');
        const tooltip = document.createElement('div');
        tooltip.className = 'ext-heatmap-tooltip';
        document.body.appendChild(tooltip);

        cells.forEach(cell => {
            cell.addEventListener('mouseenter', function(e) {
                const option = this.dataset.option;
                const criteria = this.dataset.criteria;
                const rating = this.dataset.rating;
                const weighted = this.dataset.weighted;
                const weight = this.dataset.weight;
                
                tooltip.innerHTML = `
                    <strong>${option}</strong><br>
                    ${criteria}: ${rating}/5<br>
                    Weight: ${weight}%<br>
                    Contribution: ${weighted}
                `;
                
                tooltip.classList.add('visible');
            });

            cell.addEventListener('mousemove', function(e) {
                tooltip.style.left = (e.pageX + 10) + 'px';
                tooltip.style.top = (e.pageY - 10) + 'px';
            });

            cell.addEventListener('mouseleave', function() {
                tooltip.classList.remove('visible');
            });
        });
    }

    /**
     * Render sensitivity analysis
     */
    function ext_renderSensitivity(flipPoints) {
        const container = document.getElementById('ext_sensitivityContainer');
        if (!container) return;

        const validFlipPoints = flipPoints.filter(fp => !fp.impossible);
        const criticalThreshold = 5; // Less than 5% change is critical

        container.innerHTML = `
            <div class="ext-sensitivity-container">
                <h4>Decision Sensitivity Analysis</h4>
                <p style="color: #666; margin-bottom: 20px;">
                    How much would criteria weights need to change to flip the decision?
                </p>
                
                <div class="ext-tornado-chart">
                    <h5>Flip-Point Analysis</h5>
                    ${validFlipPoints.length > 0 ? validFlipPoints.map(fp => {
                        const isCritical = Math.abs(fp.flipDeltaPercentPoints) < criticalThreshold;
                        const barWidth = Math.min(Math.abs(fp.flipDeltaPercentPoints) / 20 * 100, 100);
                        
                        return `
                            <div class="ext-tornado-item ${isCritical ? 'ext-flip-point-critical' : ''}">
                                <div class="ext-tornado-label">${ext_safeHtml(fp.criterionName)}</div>
                                <div class="ext-tornado-bar">
                                    <div class="ext-tornado-fill" style="width: ${barWidth}%"></div>
                                </div>
                                <div class="ext-tornado-value">
                                    ${fp.flipDeltaPercentPoints > 0 ? '+' : ''}${fp.flipDeltaPercentPoints}pp
                                </div>
                            </div>
                            ${isCritical ? `
                                <div style="margin-left: 135px; font-size: 0.85rem; color: #dc3545; margin-bottom: 10px;">
                                    <strong>Decision-critical:</strong> Small weight changes on ${fp.criterionName} 
                                    (Δ ${Math.abs(fp.flipDeltaPercentPoints)}pp) could change the winner.
                                </div>
                            ` : ''}
                        `;
                    }).join('') : '<p style="color: #666;">No feasible flip points found - decision is very stable.</p>'}
                </div>

                ${validFlipPoints.length > 0 ? `
                    <div style="margin-top: 20px; padding: 15px; background: #e7f3ff; border-radius: 8px; border-left: 4px solid #17a2b8;">
                        <h5 style="margin: 0 0 8px 0; color: #17a2b8;">Example Scenario:</h5>
                        <p style="margin: 0; color: #17a2b8;">
                            If you increase <strong>${validFlipPoints[0].criterionName}</strong> 
                            by ${Math.abs(validFlipPoints[0].flipDeltaPercentPoints)} percentage points 
                            (from ${validFlipPoints[0].currentWeight}% → ${validFlipPoints[0].newWeight}%), 
                            the runner-up becomes the top choice.
                        </p>
                    </div>
                ` : ''}
            </div>
        `;
    }

    /**
     * Initialize what-if controls
     */
    function ext_initWhatIfControls(decisionCopy) {
        const container = document.getElementById('ext_sensitivityContainer');
        if (!container) return;

        // Add what-if section to sensitivity container
        const whatIfHTML = `
            <div class="ext-what-if-controls" style="margin-top: 30px;">
                <div class="ext-what-if-header">
                    <h4 class="ext-what-if-title">What-If Analysis</h4>
                    <div class="ext-scenario-indicator" id="ext_scenarioIndicator">
                        Scenario-only view - this does not change your saved decision
                    </div>
                </div>
                <p style="color: #666; margin-bottom: 20px;">
                    Adjust criteria weights to see how it affects the ranking. Changes are temporary and for exploration only.
                </p>
                
                <div id="ext_whatIfSliders">
                    ${decisionCopy.criteria.map(criteria => `
                        <div class="ext-what-if-slider">
                            <div class="ext-slider-header">
                                <div class="ext-slider-label">${ext_safeHtml(criteria.name)}</div>
                                <div class="ext-slider-value" id="ext_slider_${criteria.id}">${Math.round(decisionCopy.normalizedWeights[criteria.id])}%</div>
                            </div>
                            <input type="range" 
                                   class="ext-range-slider" 
                                   id="ext_range_${criteria.id}"
                                   min="1" 
                                   max="80" 
                                   value="${Math.round(decisionCopy.normalizedWeights[criteria.id])}"
                                   data-criteria-id="${criteria.id}"
                                   aria-label="Weight for ${criteria.name}">
                        </div>
                    `).join('')}
                </div>
                
                <div class="ext-impact-preview" id="ext_impactPreview">
                    <div class="ext-impact-summary">Adjust weights above to see impact on rankings</div>
                </div>
                
                <div style="text-align: center; margin-top: 20px;">
                    <button class="btn btn-secondary" id="ext_resetWeights">Reset to Original</button>
                </div>
            </div>
        `;

        container.insertAdjacentHTML('beforeend', whatIfHTML);
        ext_initializeWhatIfSliders(decisionCopy);
    }

    /**
     * Initialize what-if slider event handlers
     */
    function ext_initializeWhatIfSliders(decisionCopy) {
        const sliders = document.querySelectorAll('.ext-range-slider');
        const resetBtn = document.getElementById('ext_resetWeights');
        const scenarioIndicator = document.getElementById('ext_scenarioIndicator');
        
        let isModified = false;

        sliders.forEach(slider => {
            slider.addEventListener('input', function() {
                const criteriaId = this.dataset.criteriaId;
                const newValue = parseInt(this.value);
                
                // Update display
                document.getElementById(`ext_slider_${criteriaId}`).textContent = `${newValue}%`;
                
                // Update temporary weights
                ext_state.tmpWeights[criteriaId] = newValue;
                
                // Renormalize weights
                ext_renormalizeWeights();
                
                // Update all slider displays after renormalization
                ext_updateSliderDisplays();
                
                // Show scenario indicator
                if (!isModified) {
                    isModified = true;
                    scenarioIndicator.classList.add('active');
                }
                
                // Update impact preview
                ext_updateWhatIfPreview(decisionCopy);
            });
        });

        resetBtn.addEventListener('click', function() {
            // Reset to original weights
            ext_state.tmpWeights = { ...decisionCopy.normalizedWeights };
            
            // Update all sliders
            ext_updateSliderDisplays();
            
            // Hide scenario indicator
            isModified = false;
            scenarioIndicator.classList.remove('active');
            
            // Update preview
            ext_updateWhatIfPreview(decisionCopy);
        });
    }

    /**
     * Renormalize weights to maintain 100% total
     */
    function ext_renormalizeWeights() {
        const total = Object.values(ext_state.tmpWeights).reduce((sum, weight) => sum + weight, 0);
        if (total <= 0) return;
        
        // Normalize to 100%
        Object.keys(ext_state.tmpWeights).forEach(id => {
            ext_state.tmpWeights[id] = (ext_state.tmpWeights[id] / total) * 100;
        });
    }

    /**
     * Update slider displays after renormalization
     */
    function ext_updateSliderDisplays() {
        Object.keys(ext_state.tmpWeights).forEach(id => {
            const value = Math.round(ext_state.tmpWeights[id]);
            const slider = document.getElementById(`ext_range_${id}`);
            const display = document.getElementById(`ext_slider_${id}`);
            
            if (slider && display) {
                slider.value = value;
                display.textContent = `${value}%`;
            }
        });
    }

    /**
     * Update what-if preview with new rankings
     */
    function ext_updateWhatIfPreview(decisionCopy) {
        const previewContainer = document.getElementById('ext_impactPreview');
        if (!previewContainer) return;

        // Create a copy with modified weights
        const modifiedCopy = ext_cloneDecisionData();
        modifiedCopy.normalizedWeights = { ...ext_state.tmpWeights };
        
        // Compute new results
        const newResults = ext_computeResultsCopy(modifiedCopy);
        const newRanked = ext_assignRanks(newResults);
        
        // Compare with original
        const originalWinner = ext_state.currentResults[0];
        const newWinner = newRanked[0];
        const winnerChanged = originalWinner.option.id !== newWinner.option.id;
        
        previewContainer.innerHTML = `
            <div class="ext-impact-summary">
                Impact Preview: 
                <span class="ext-winner-change ${winnerChanged ? 'different' : 'same'}">
                    ${winnerChanged ? 
                        `Winner changed! Now: ${ext_safeHtml(newWinner.option.name)} (${ext_safeNumber(newWinner.totalScore, 2)})` :
                        `Same winner: ${ext_safeHtml(newWinner.option.name)} (${ext_safeNumber(newWinner.totalScore, 2)})`
                    }
                </span>
            </div>
            <div style="font-size: 0.85rem; color: #666; margin-top: 8px;">
                Top 3: ${newRanked.slice(0, 3).map(r => 
                    `${ext_safeHtml(r.option.name)} (${ext_safeNumber(r.totalScore, 1)})`
                ).join(', ')}
            </div>
        `;
    }

    /**
     * Render risks and weaknesses analysis
     */
    function ext_renderRisksAnalysis(results, decisionCopy) {
        const container = document.getElementById('ext_risksContainer');
        if (!container || !results.length) return;

        const winner = results[0];
        const risks = [];

        // Find criteria where winner scored poorly
        Object.entries(winner.criteriaScores).forEach(([criteriaName, scores]) => {
            if (scores.rating <= 2) {
                risks.push({
                    type: 'low_score',
                    criteria: criteriaName,
                    rating: scores.rating,
                    weight: Math.round(scores.weight),
                    message: `Weak performance on ${criteriaName} (${scores.rating}/5 rating)`
                });
            }
        });

        // Find highly weighted criteria where winner is not the best
        decisionCopy.criteria.forEach(criteria => {
            const weight = Math.round(decisionCopy.normalizedWeights[criteria.id] || 0);
            if (weight > 20) { // High weight threshold
                const allScores = results.map(r => ({
                    option: r.option.name,
                    rating: r.criteriaScores[criteria.name]?.rating || 3
                }));
                
                const maxRating = Math.max(...allScores.map(s => s.rating));
                const winnerRating = winner.criteriaScores[criteria.name]?.rating || 3;
                
                if (winnerRating < maxRating) {
                    const betterOptions = allScores.filter(s => s.rating > winnerRating);
                    risks.push({
                        type: 'not_best',
                        criteria: criteria.name,
                        rating: winnerRating,
                        weight: weight,
                        betterOptions: betterOptions,
                        message: `Not the best choice for highly weighted ${criteria.name} (${weight}% weight)`
                    });
                }
            }
        });

        container.innerHTML = `
            <div class="ext-risks-container">
                <h4>Potential Risks & Weaknesses</h4>
                <p style="color: #666; margin-bottom: 20px;">
                    Areas where ${ext_safeHtml(winner.option.name)} might need attention or consideration.
                </p>
                
                ${risks.length > 0 ? risks.map(risk => `
                    <div class="ext-risk-item">
                        <div class="ext-risk-icon">⚠️</div>
                        <div class="ext-risk-content">
                            <h5>${risk.message}</h5>
                            <p>
                                ${risk.type === 'low_score' ? 
                                    `Consider if this ${risk.weight}%-weighted criterion is acceptable at current level, or if improvements are needed.` :
                                    `Other options (${risk.betterOptions.map(o => o.option).join(', ')}) score higher on this important criterion.`
                                }
                            </p>
                        </div>
                    </div>
                `).join('') : `
                    <div style="text-align: center; padding: 20px; color: #28a745;">
                        <h5>✅ No significant risks identified</h5>
                        <p>${ext_safeHtml(winner.option.name)} performs well across all important criteria!</p>
                    </div>
                `}
                
                ${risks.length > 0 ? `
                    <div style="margin-top: 20px; padding: 15px; background: #e7f3ff; border-radius: 8px; border-left: 4px solid #17a2b8;">
                        <h5 style="margin: 0 0 8px 0; color: #17a2b8;">Suggested Actions:</h5>
                        <ul style="margin: 0; color: #17a2b8;">
                            ${risks.slice(0, 3).map(risk => 
                                `<li>Review and potentially improve ${risk.criteria} aspects</li>`
                            ).join('')}
                            ${risks.length > 1 ? '<li>Consider whether identified weaknesses are deal-breakers</li>' : ''}
                            <li>Compare with runner-up options for these specific criteria</li>
                        </ul>
                    </div>
                ` : ''}
            </div>
        `;
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
    function ext_generateChartsForPDF() {
        return new Promise((resolve, reject) => {
            try {
                const images = {};
                
                // Capture pie chart
                if (ext_state.charts.pie) {
                    images.pieChart = ext_state.charts.pie.toBase64Image('image/png', 1.0);
                }
                
                // Capture heatmap table
                const heatmapTable = document.querySelector('.ext-heatmap-table');
                if (heatmapTable) {
                    html2canvas(heatmapTable, {
                        backgroundColor: '#ffffff',
                        scale: 2
                    }).then(canvas => {
                        images.heatmap = canvas.toDataURL('image/png', 1.0);
                        resolve(images);
                    }).catch(reject);
                } else {
                    resolve(images);
                }
                
            } catch (error) {
                reject(error);
            }
        });
    }

    /**
     * Create the PDF document with all sections
     */
    function ext_createPDFDocument(results, confidence, flipPoints, decisionCopy, chartImages) {
        const { jsPDF } = window.jspdf;
        const doc = new jsPDF('portrait', 'mm', 'a4');
        
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
        doc.text('Decision Analysis Report', 105, 25, { align: 'center' });
        
        doc.setFontSize(14);
        doc.setFont(undefined, 'normal');
        doc.text('Professional Decision Intelligence', 105, 35, { align: 'center' });
        
        doc.setFontSize(10);
        doc.text(`Generated by Choicease - ${new Date().toLocaleDateString()}`, 105, 50, { align: 'center' });
        
        yPos = 80;
        
        // Decision title and context
        doc.setTextColor(...colors.text);
        doc.setFillColor(...colors.background);
        doc.rect(10, yPos, 190, 40, 'F');
        doc.setDrawColor(200, 200, 200);
        doc.rect(10, yPos, 190, 40, 'S');
        
        doc.setFontSize(18);
        doc.setFont(undefined, 'bold');
        doc.text(`Decision: ${decisionCopy.title}`, 15, yPos + 12);
        
        if (decisionCopy.description) {
            doc.setFontSize(12);
            doc.setFont(undefined, 'normal');
            doc.setTextColor(...colors.lightText);
            const descLines = doc.splitTextToSize(`Context: ${decisionCopy.description}`, 180);
            doc.text(descLines, 15, yPos + 25);
        }
        
        yPos = 140;
        
        // Executive Summary
        doc.setTextColor(...colors.primary);
        doc.setFontSize(16);
        doc.setFont(undefined, 'bold');
        doc.text('Executive Summary', 15, yPos);
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
        doc.text('Recommended Choice:', 20, yPos + 8);
        
        doc.setTextColor(...colors.text);
        doc.setFontSize(12);
        doc.setFont(undefined, 'bold');
        doc.text(winner.option.name, 20, yPos + 16);
        doc.setFont(undefined, 'normal');
        doc.text(`Score: ${ext_safeNumber(winner.totalScore, 2)}/5.0 (${Math.round((winner.totalScore/5)*100)}%)`, 20, yPos + 22);
        
        yPos += 35;
        
        // Confidence meter
        doc.setTextColor(...colors.text);
        doc.setFontSize(12);
        doc.setFont(undefined, 'bold');
        doc.text(`Confidence: ${confidence.bucket.toUpperCase()} (${confidence.confidencePercent}%)`, 20, yPos);
        
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
        doc.text('Why this choice won:', 20, yPos);
        yPos += 8;
        
        const topCriteria = Object.entries(winner.criteriaScores)
            .sort((a, b) => b[1].weightedScore - a[1].weightedScore)
            .slice(0, 3);
        
        doc.setFont(undefined, 'normal');
        topCriteria.forEach(([criteriaName, scores], index) => {
            doc.text(`• ${criteriaName}: Scored ${scores.rating}/5 with ${Math.round(scores.weight)}% weight`, 25, yPos);
            yPos += 6;
        });
        
        // Margin information
        if (runnerUp) {
            const margin = winner.totalScore - runnerUp.totalScore;
            yPos += 5;
            doc.setFont(undefined, 'bold');
            doc.text(`Margin vs runner-up: +${ext_safeNumber(margin, 2)} points ahead of ${runnerUp.option.name}`, 20, yPos);
        }
        
        // New page for rankings
        doc.addPage();
        yPos = 20;
        
        // Rankings section
        doc.setTextColor(...colors.primary);
        doc.setFontSize(16);
        doc.setFont(undefined, 'bold');
        doc.text('Complete Rankings', 15, yPos);
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
        doc.text('Rank', 20, yPos + 5);
        doc.text('Option', 45, yPos + 5);
        doc.text('Score', 130, yPos + 5);
        doc.text('Percentage', 160, yPos + 5);
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
            
            doc.text(row[0], 20, yPos + 5);
            doc.text(row[1], 45, yPos + 5);
            doc.text(row[2], 130, yPos + 5);
            doc.text(row[3], 160, yPos + 5);
            yPos += 7;
        });
        
        // Add criteria weights section
        yPos += 20;
        doc.setTextColor(...colors.primary);
        doc.setFontSize(16);
        doc.setFont(undefined, 'bold');
        doc.text('Criteria Analysis', 15, yPos);
        yPos += 15;
        
        // Embed pie chart if available
        if (chartImages.pieChart) {
            try {
                doc.addImage(chartImages.pieChart, 'PNG', 15, yPos, 80, 60);
                yPos += 70;
            } catch (error) {
                console.warn('Could not embed pie chart in PDF:', error);
            }
        }
        
        // Criteria weights table
        doc.setTextColor(...colors.text);
        doc.setFontSize(12);
        doc.setFont(undefined, 'bold');
        doc.text('Criteria Weights:', 100, yPos - 40);
        
        doc.setFontSize(10);
        doc.setFont(undefined, 'normal');
        let criteriaYPos = yPos - 30;
        decisionCopy.criteria.forEach(criteria => {
            const weight = Math.round(decisionCopy.normalizedWeights[criteria.id] || 0);
            doc.text(`${criteria.name}: ${weight}%`, 105, criteriaYPos);
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
        doc.text('Sensitivity Analysis', 15, yPos);
        yPos += 15;
        
        const validFlipPoints = flipPoints.filter(fp => !fp.impossible);
        if (validFlipPoints.length > 0) {
            doc.setTextColor(...colors.text);
            doc.setFontSize(11);
            doc.setFont(undefined, 'bold');
            doc.text('Decision Flip Points:', 20, yPos);
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
                
                doc.text(`• ${fp.criterionName}: ${fp.flipDeltaPercentPoints > 0 ? '+' : ''}${fp.flipDeltaPercentPoints}pp change needed`, 25, yPos);
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
        doc.text('Methodology', 15, yPos);
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
            doc.text(line, 20, yPos);
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
            doc.text('Powered by Choicease - Smart Choices, Made Easy', 105, 290, { align: 'center' });
            doc.text(`choicease.com | Page ${i} of ${pageCount}`, 105, 295, { align: 'center' });
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
 */
