class ChunDietApp {
    constructor() {
        this.currentPage = 'home';
        this.currentUser = { id: 1 }; // Default user
        this.apiBase = '/api';
        this.currentGoals = {};
        this.init();
    }

    async init() {
        this.setupEventListeners();
        this.initializeBranding();
        this.initializeAnimations();
        await this.loadUserProfile();
        await this.loadDailyProgress();
        this.showPage('home');
        
        // Make app instance globally available for mobile integration
        window.chunDietApp = this;
    }

    initializeBranding() {
        // Set proper user name
        const userNameElement = document.getElementById('userName');
        if (userNameElement) {
            userNameElement.textContent = 'Welcome to ChunDiet!';
        }

        // Add ChunDiet branding to page titles
        const pageHeaders = document.querySelectorAll('.page-header h1');
        pageHeaders.forEach(header => {
            if (!header.textContent.includes('ChunDiet')) {
                header.innerHTML = header.innerHTML.replace('Your', 'ChunDiet');
            }
        });

        // Initialize loading animations
        this.initializeLoadingAnimations();
    }

    initializeLoadingAnimations() {
        // Add custom loading animation for ChunDiet
        const style = document.createElement('style');
        style.textContent = `
            .chundiet-loader {
                display: inline-block;
                width: 20px;
                height: 20px;
                border: 2px solid var(--surface);
                border-top: 2px solid var(--primary-green);
                border-radius: 50%;
                animation: spin 1s linear infinite;
                margin-right: 8px;
            }
        `;
        document.head.appendChild(style);
    }
    setupEventListeners() {
        document.getElementById('mealForm').addEventListener('submit', (e) => {
            e.preventDefault();
            this.analyzeMeal();
        });

        // Navigation - use event delegation for nav menu
        document.getElementById('navMenu').addEventListener('click', (e) => {
            const navItem = e.target.closest('.nav-item');
            if (navItem) {
                const page = navItem.dataset.page;
                this.showPage(page);
                this.setActiveNav(navItem);
            }
        });

        // Planner page buttons
        const refreshPlanBtn = document.getElementById('refreshPlanBtn');
        if (refreshPlanBtn) {
            refreshPlanBtn.addEventListener('click', () => this.loadRecommendations(true));
        }

        // Settings page buttons
        const addApiKeyBtn = document.getElementById('addKeyBtn');
        if (addApiKeyBtn) {
            addApiKeyBtn.addEventListener('click', () => this.addApiKey());
        }

        const profileForm = document.getElementById('profileForm');
        if (profileForm) {
            profileForm.addEventListener('submit', (e) => {
                e.preventDefault();
                this.saveProfile();
            });
        }

        const goalsForm = document.getElementById('goalsForm');
        if (goalsForm) {
            goalsForm.addEventListener('submit', (e) => {
                e.preventDefault();
                this.saveGoals();
            });
        }

        // Goals sliders event listeners
        this.setupGoalsSliders();

        // AI settings sliders
        document.getElementById('temperature').addEventListener('input', (e) => {
            document.getElementById('tempValue').textContent = e.target.value;
            this.saveAiSettings();
        });

        document.getElementById('topP').addEventListener('input', (e) => {
            document.getElementById('topPValue').textContent = e.target.value;
            this.saveAiSettings();
        });

        // Theme toggle
        document.getElementById('themeToggle').addEventListener('change', (e) => {
            this.toggleTheme(e.target.checked);
        });

        // Set default meal time to now
        const now = new Date();
        now.setMinutes(now.getMinutes() - now.getTimezoneOffset());
        document.getElementById('mealTime').value = now.toISOString().slice(0, 16);
    }

    showPage(pageId) {
        // Hide all pages
        document.querySelectorAll('.page').forEach(page => {
            page.classList.add('hidden');
        });

        // Show target page
        const targetPage = document.getElementById(`${pageId}Page`);
        if (targetPage) {
            targetPage.classList.remove('hidden');
            this.currentPage = pageId;

            // Load page-specific data
            this.loadPageData(pageId);
        }
    }

    setActiveNav(activeItem) {
        document.querySelectorAll('.nav-item').forEach(item => {
            item.classList.remove('active');
        });
        activeItem.classList.add('active');
    }

    async loadPageData(pageId) {
        switch (pageId) {
            case 'home':
                await this.loadDailyProgress();
                await this.loadTodaysMeals();
                break;
            case 'history':
                await this.loadHistory();
                break;
            case 'planner':
                // Load stored recommendations first, show empty state if none exist
                await this.loadStoredRecommendations();
                break;
            case 'settings':
                await this.loadSettings();
                await this.loadGoals();
                break;
        }
    }

    async analyzeMeal() {
        const description = document.getElementById('mealDescription').value;
        const time = document.getElementById('mealTime').value;

        if (!description.trim()) {
            this.showNotification('Please describe your meal', 'error');
            return;
        }

        this.showLoading(true);

        try {
            const response = await fetch(`${this.apiBase}/analyze-meal`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    description: description,
                    time: time,
                    user_id: this.currentUser.id
                })
            });

            const result = await response.json();

            if (result.success) {
                this.showNotification('Meal analyzed successfully! 🎉', 'success');
                document.getElementById('mealForm').reset();

                // Set time to now for next entry
                const now = new Date();
                now.setMinutes(now.getMinutes() - now.getTimezoneOffset());
                document.getElementById('mealTime').value = now.toISOString().slice(0, 16);

                // Refresh daily progress
                await this.loadDailyProgress();
                await this.loadTodaysMeals();
            } else {
                this.showNotification(`Error: ${result.error}`, 'error');
            }
        } catch (error) {
            this.showNotification('Failed to analyze meal. Please try again.', 'error');
            console.error('Meal analysis error:', error);
        } finally {
            this.showLoading(false);
        }
    }

    async loadDailyProgress() {
        try {
            const today = new Date().toISOString().split('T')[0];
            const response = await fetch(`${this.apiBase}/daily-summary/${today}?user_id=${this.currentUser.id}`);
            const summary = await response.json();

            // Update sidebar stats
            const calories = summary.total_calories || 0;
            document.getElementById('todayCalories').textContent = calories;

            // Update progress bar with goals if available
            this.updateCalorieProgress();

            // Update daily progress section
            const progressSection = document.getElementById('dailyProgress');
            progressSection.innerHTML = `
                <div class="progress-card">
                    <h3>Today's Summary</h3>
                    <div class="progress-stats">
                        <div class="stat-circle">
                            <div class="circle-progress" data-progress="${Math.min((summary.total_calories || 0) / 2000 * 100, 100)}">
                                <span class="stat-value">${summary.total_calories || 0}</span>
                                <span class="stat-label">Calories</span>
                            </div>
                        </div>
                        <div class="stat-info">
                            <p><strong>${summary.meal_count || 0}</strong> meals logged</p>
                            <p><strong>${summary.foods?.length || 0}</strong> different foods</p>
                        </div>
                    </div>
                </div>
            `;

            // Animate progress circles
            this.animateProgressCircles();

            // Update mobile stats if mobile enhancements are active
            if (window.mobileEnhancements && window.mobileEnhancements.isMobile) {
                window.mobileEnhancements.updateMobileStats({
                    calories: summary.total_calories || 0,
                    protein: summary.total_protein || 0,
                    carbs: summary.total_carbs || 0,
                    fat: summary.total_fat || 0
                });
            }

        } catch (error) {
            console.error('Failed to load daily progress:', error);
        }
    }

    async loadTodaysMeals() {
        try {
            const today = new Date().toISOString().split('T')[0];
            const response = await fetch(`${this.apiBase}/daily-summary/${today}?user_id=${this.currentUser.id}`);
            const summary = await response.json();

            const mealsGrid = document.getElementById('mealsGrid');

            if (summary.meals && summary.meals.length > 0) {
                mealsGrid.innerHTML = summary.meals.map(meal => this.renderEnhancedMealCard(meal)).join('');
            } else {
                mealsGrid.innerHTML = `
                    <div class="empty-state">
                        <p>No meals logged today</p>
                        <p>Start by describing your first meal above!</p>
                    </div>
                `;
            }
        } catch (error) {
            console.error('Failed to load today\'s meals:', error);
        }
    }

    async loadHistory() {
        try {
            const response = await fetch(`${this.apiBase}/history?user_id=${this.currentUser.id}&days=30`);
            const history = await response.json();

            const timeline = document.getElementById('historyTimeline');

            if (history.length > 0) {
                timeline.innerHTML = history.map(day => `
                    <div class="timeline-item">
                        <div class="timeline-date">${this.formatDate(day.date)}</div>
                        <div class="timeline-content">
                            <div class="day-summary">
                                <span class="calorie-count">${day.total_calories} kcal</span>
                                <span class="meal-count">${day.meal_count} meals</span>
                            </div>
                            <div class="food-list">
                                ${day.foods.slice(0, 3).map(food => `<span class="food-tag">${food}</span>`).join('')}
                                ${day.foods.length > 3 ? `<span class="food-tag">+${day.foods.length - 3} more</span>` : ''}
                            </div>
                        </div>
                    </div>
                `).join('');
            } else {
                timeline.innerHTML = `
                    <div class="empty-state">
                        <p>No nutrition history yet</p>
                        <p>Start logging meals to see your progress!</p>
                    </div>
                `;
            }
        } catch (error) {
            console.error('Failed to load history:', error);
        }
    }

    showPlannerEmptyState() {
        const section = document.getElementById('recommendationsSection');
        section.innerHTML = `
            <div class="empty-state">
                <p>Ready to generate your personalized nutrition plan?</p>
                <p>Click "Generate New Plan" above to get AI-powered insights based on your recent meals!</p>
            </div>
        `;
    }

    async loadStoredRecommendations() {
        try {
            const response = await fetch(`${this.apiBase}/ai-recommendations?user_id=${this.currentUser.id}`);
            const recommendations = await response.json();

            console.log('[DEBUG] Stored recommendations data:', recommendations);
            console.log('[DEBUG] Keys in stored recommendations:', Object.keys(recommendations));

            // Check for both old and new format - be more thorough
            const hasOldFormat = recommendations.recommendations && Array.isArray(recommendations.recommendations) && recommendations.recommendations.length > 0;
            const hasNewFormat = recommendations.food_recommendations ||
                recommendations.nutritional_analysis ||
                recommendations.diet_recommendations ||
                recommendations.ingredient_recommendations ||
                recommendations.next_day_plan;
            const hasBasicData = recommendations.overall_assessment && recommendations.overall_assessment.length > 0;

            const hasRecommendations = hasOldFormat || hasNewFormat || hasBasicData;

            if (hasRecommendations) {
                this.displayRecommendations(recommendations);
            } else {
                this.showPlannerEmptyState();
            }
        } catch (error) {
            console.error('Failed to load stored recommendations:', error);
            this.showPlannerEmptyState();
        }
    }

    displayRecommendations(recommendations) {
        const section = document.getElementById('recommendationsSection');

        // Handle both old and new format
        const isNewFormat = recommendations.nutritional_analysis ||
            recommendations.food_recommendations ||
            recommendations.diet_recommendations ||
            recommendations.ingredient_recommendations ||
            recommendations.next_day_plan;

        if (isNewFormat) {
            section.innerHTML = this.renderEnhancedRecommendations(recommendations);
        } else {
            // Fallback to old format
            section.innerHTML = this.renderLegacyRecommendations(recommendations);
        }
    }

    renderEnhancedRecommendations(data) {
        return `
            <div class="enhanced-recommendations">
                <div class="recommendations-header">
                    <h2>🧠 Chun's Comprehensive Nutrition Analysis</h2>
                    <p class="overall-assessment">${data.overall_assessment || 'Analysis in progress...'}</p>
                </div>

                ${data.nutritional_analysis ? this.renderNutritionalAnalysis(data.nutritional_analysis) : ''}
                
                <div class="recommendations-grid">
                    ${data.food_recommendations ? this.renderFoodRecommendations(data.food_recommendations) : ''}
                    ${data.diet_recommendations ? this.renderDietRecommendations(data.diet_recommendations) : ''}
                    ${data.ingredient_recommendations ? this.renderIngredientRecommendations(data.ingredient_recommendations) : ''}
                </div>

                ${data.next_day_plan ? this.renderNextDayPlan(data.next_day_plan) : ''}

                <div class="goals-section">
                    ${data.weekly_goal ? `
                        <div class="weekly-goal-card">
                            <h4>🎯 This Week's Focus</h4>
                            <p>${data.weekly_goal}</p>
                        </div>
                    ` : ''}
                    
                    ${data.hydration_reminder ? `
                        <div class="hydration-card">
                            <h4>💧 Hydration Reminder</h4>
                            <p>${data.hydration_reminder}</p>
                        </div>
                    ` : ''}
                </div>

                ${data.created_at ? `<p class="recommendation-date">Generated: ${new Date(data.created_at).toLocaleDateString()}</p>` : ''}
            </div>
        `;
    }

    renderNutritionalAnalysis(analysis) {
        return `
            <div class="nutritional-analysis-section">
                <h3>📊 Nutritional Status Analysis</h3>
                <div class="analysis-grid">
                    <div class="analysis-card">
                        <h4>🔥 Calorie Analysis</h4>
                        <p>${analysis.calorie_analysis || 'No data available'}</p>
                    </div>
                    <div class="analysis-card">
                        <h4>⚖️ Macronutrient Balance</h4>
                        <p>${analysis.macronutrient_balance || 'No data available'}</p>
                    </div>
                    <div class="analysis-card">
                        <h4>💎 Micronutrient Status</h4>
                        <p>${analysis.micronutrient_status || 'No data available'}</p>
                    </div>
                </div>
                
                ${analysis.deficiencies && analysis.deficiencies.length > 0 ? `
                    <div class="deficiencies-card">
                        <h4>⚠️ Areas for Improvement</h4>
                        <ul class="deficiency-list">
                            ${analysis.deficiencies.map(def => `<li>${def}</li>`).join('')}
                        </ul>
                    </div>
                ` : ''}
                
                ${analysis.strengths && analysis.strengths.length > 0 ? `
                    <div class="strengths-card">
                        <h4>✨ Nutritional Strengths</h4>
                        <ul class="strength-list">
                            ${analysis.strengths.map(strength => `<li>${strength}</li>`).join('')}
                        </ul>
                    </div>
                ` : ''}
            </div>
        `;
    }

    renderFoodRecommendations(foods) {
        return `
            <div class="food-recommendations-section">
                <h3>🍽️ Personalized Food Recommendations</h3>
                <div class="food-cards-grid">
                    ${foods.map(food => `
                        <div class="food-recommendation-card">
                            <div class="meal-type-badge">${food.meal_type || 'Anytime'}</div>
                            <h4>${food.food_name}</h4>
                            <p class="food-benefits">${food.benefits}</p>
                            ${food.nutrients_provided && food.nutrients_provided.length > 0 ? `
                                <div class="nutrients-provided">
                                    <strong>Key Nutrients:</strong>
                                    <div class="nutrient-tags">
                                        ${food.nutrients_provided.map(nutrient => `<span class="nutrient-tag">${nutrient}</span>`).join('')}
                                    </div>
                                </div>
                            ` : ''}
                            ${food.preparation_tip ? `
                                <div class="prep-tip">
                                    <strong>💡 Tip:</strong> ${food.preparation_tip}
                                </div>
                            ` : ''}
                        </div>
                    `).join('')}
                </div>
            </div>
        `;
    }

    renderDietRecommendations(diets) {
        return `
            <div class="diet-recommendations-section">
                <h3>🥗 Diet & Lifestyle Recommendations</h3>
                <div class="diet-cards">
                    ${diets.map(diet => `
                        <div class="diet-recommendation-card">
                            <div class="diet-category">${diet.category}</div>
                            <h4>${diet.recommendation}</h4>
                            <p class="diet-rationale"><strong>Why:</strong> ${diet.rationale}</p>
                            <p class="diet-implementation"><strong>How:</strong> ${diet.implementation}</p>
                        </div>
                    `).join('')}
                </div>
            </div>
        `;
    }

    renderIngredientRecommendations(ingredients) {
        return `
            <div class="ingredient-recommendations-section">
                <h3>🌿 Key Ingredients to Add</h3>
                <div class="ingredient-cards">
                    ${ingredients.map(ingredient => `
                        <div class="ingredient-card">
                            <h4>${ingredient.ingredient}</h4>
                            <div class="nutrient-focus">
                                <strong>Focus Nutrient:</strong> ${ingredient.nutrient_focus}
                            </div>
                            <p class="health-benefits">${ingredient.health_benefits}</p>
                            ${ingredient.usage_suggestions && ingredient.usage_suggestions.length > 0 ? `
                                <div class="usage-suggestions">
                                    <strong>Usage Ideas:</strong>
                                    <ul>
                                        ${ingredient.usage_suggestions.map(suggestion => `<li>${suggestion}</li>`).join('')}
                                    </ul>
                                </div>
                            ` : ''}
                            ${ingredient.daily_amount ? `
                                <div class="daily-amount">
                                    <strong>Recommended Amount:</strong> ${ingredient.daily_amount}
                                </div>
                            ` : ''}
                        </div>
                    `).join('')}
                </div>
            </div>
        `;
    }

    renderNextDayPlan(plan) {
        return `
            <div class="next-day-plan-section">
                <h3>📅 Tomorrow's Meal Plan</h3>
                <div class="meal-plan-grid">
                    ${plan.breakfast ? `
                        <div class="meal-plan-card breakfast">
                            <h4>🌅 Breakfast</h4>
                            <p>${plan.breakfast.suggestion}</p>
                            ${plan.breakfast.focus_nutrients && plan.breakfast.focus_nutrients.length > 0 ? `
                                <div class="focus-nutrients">
                                    <strong>Focus:</strong> ${plan.breakfast.focus_nutrients.join(', ')}
                                </div>
                            ` : ''}
                        </div>
                    ` : ''}
                    
                    ${plan.lunch ? `
                        <div class="meal-plan-card lunch">
                            <h4>☀️ Lunch</h4>
                            <p>${plan.lunch.suggestion}</p>
                            ${plan.lunch.focus_nutrients && plan.lunch.focus_nutrients.length > 0 ? `
                                <div class="focus-nutrients">
                                    <strong>Focus:</strong> ${plan.lunch.focus_nutrients.join(', ')}
                                </div>
                            ` : ''}
                        </div>
                    ` : ''}
                    
                    ${plan.dinner ? `
                        <div class="meal-plan-card dinner">
                            <h4>🌙 Dinner</h4>
                            <p>${plan.dinner.suggestion}</p>
                            ${plan.dinner.focus_nutrients && plan.dinner.focus_nutrients.length > 0 ? `
                                <div class="focus-nutrients">
                                    <strong>Focus:</strong> ${plan.dinner.focus_nutrients.join(', ')}
                                </div>
                            ` : ''}
                        </div>
                    ` : ''}
                </div>
                
                ${plan.snacks && plan.snacks.length > 0 ? `
                    <div class="snacks-section">
                        <h4>🍎 Healthy Snack Options</h4>
                        <div class="snack-tags">
                            ${plan.snacks.map(snack => `<span class="snack-tag">${snack}</span>`).join('')}
                        </div>
                    </div>
                ` : ''}
            </div>
        `;
    }

    renderLegacyRecommendations(recommendations) {
        return `
            <div class="recommendations-card">
                <h3>🤖 Chun's Nutrition Insights</h3>
                <p class="overall-assessment">${recommendations.overall_assessment}</p>
                
                <div class="weekly-goal">
                    <h4>This Week's Goal</h4>
                    <p>${recommendations.weekly_goal}</p>
                </div>
                
                <div class="recommendations-list">
                    ${recommendations.recommendations ? recommendations.recommendations.map(rec => `
                        <div class="recommendation-item priority-${rec.priority}">
                            <h5>${rec.title}</h5>
                            <p>${rec.description}</p>
                            <span class="category-tag">${rec.category}</span>
                        </div>
                    `).join('') : ''}
                </div>
                
                ${recommendations.created_at ? `<p class="recommendation-date">Generated: ${new Date(recommendations.created_at).toLocaleDateString()}</p>` : ''}
            </div>
        `;
    }

    toggleTheme(isDark) {
        const theme = isDark ? 'dark' : 'light';

        // Apply theme to body
        document.body.setAttribute('data-theme', theme);

        // Save theme setting
        this.saveThemeSetting(theme);
    }

    async saveThemeSetting(theme) {
        try {
            const response = await fetch(`${this.apiBase}/settings?user_id=${this.currentUser.id}`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    theme: theme
                })
            });

            const result = await response.json();
            if (result.success) {
                this.showNotification(`Theme switched to ${theme} mode! 🎨`, 'success');
            }
        } catch (error) {
            console.error('Theme save error:', error);
        }
    }

    async loadRecommendations(forceRefresh = false) {
        const section = document.getElementById('recommendationsSection');

        // Show loading state
        section.innerHTML = `
            <div class="empty-state">
                <p>🧠 Analyzing your nutrition patterns...</p>
                <p>Generating personalized recommendations...</p>
            </div>
        `;

        try {
            const response = await fetch(`${this.apiBase}/ai-recommendations`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    user_id: this.currentUser.id
                })
            });

            const recommendations = await response.json();

            console.log('[DEBUG] Received recommendations data:', recommendations);
            console.log('[DEBUG] Keys in recommendations:', Object.keys(recommendations));

            // Check for both old and new format - be more thorough
            const hasOldFormat = recommendations.recommendations && Array.isArray(recommendations.recommendations) && recommendations.recommendations.length > 0;
            const hasNewFormat = recommendations.food_recommendations ||
                recommendations.nutritional_analysis ||
                recommendations.diet_recommendations ||
                recommendations.ingredient_recommendations ||
                recommendations.next_day_plan;
            const hasBasicData = recommendations.overall_assessment && recommendations.overall_assessment.length > 0;

            const hasRecommendations = hasOldFormat || hasNewFormat || hasBasicData;

            console.log('[DEBUG] Format detection:', {
                hasOldFormat,
                hasNewFormat,
                hasBasicData,
                hasRecommendations
            });

            if (hasRecommendations) {
                this.displayRecommendations(recommendations);

                if (forceRefresh) {
                    this.showNotification('New nutrition plan generated! 🎯', 'success');
                }
            } else {
                section.innerHTML = `
                    <div class="empty-state">
                        <p>Not enough data for recommendations</p>
                        <p>Log more meals to get personalized insights!</p>
                    </div>
                `;
            }
        } catch (error) {
            console.error('Failed to load recommendations:', error);
            section.innerHTML = `
                <div class="error-state">
                    <p>Unable to load recommendations</p>
                    <p>Please check your API configuration in Settings</p>
                </div>
            `;
        }
    }

    async loadUserProfile() {
        try {
            const response = await fetch(`${this.apiBase}/user/profile?user_id=${this.currentUser.id}`);
            const profile = await response.json();

            if (profile.name && profile.name !== 'Demo User') {
                document.getElementById('userName').textContent = `Welcome, ${profile.name}!`;
            } else {
                document.getElementById('userName').textContent = 'Welcome!';
            }

            // Populate profile form in settings
            if (profile.age) document.getElementById('age').value = profile.age;
            if (profile.weight) document.getElementById('weight').value = profile.weight;
            if (profile.activity_level) document.getElementById('activityLevel').value = profile.activity_level;

        } catch (error) {
            console.error('Failed to load user profile:', error);
        }
    }

    async loadSettings() {
        try {
            const response = await fetch(`${this.apiBase}/settings?user_id=${this.currentUser.id}`);
            const settings = await response.json();

            // Update AI settings
            if (settings.ai_temperature !== undefined) {
                document.getElementById('temperature').value = settings.ai_temperature;
                document.getElementById('tempValue').textContent = settings.ai_temperature;
            }
            if (settings.ai_top_p !== undefined) {
                document.getElementById('topP').value = settings.ai_top_p;
                document.getElementById('topPValue').textContent = settings.ai_top_p;
            }

            // Update theme
            if (settings.theme) {
                const isDark = settings.theme === 'dark';
                document.getElementById('themeToggle').checked = isDark;
                document.body.setAttribute('data-theme', settings.theme);
            }

            // Update API keys list
            this.updateApiKeysList(settings.gemini_api_keys || []);

        } catch (error) {
            console.error('Failed to load settings:', error);
        }
    }

    async saveProfile() {
        const profileData = {
            age: parseInt(document.getElementById('age').value) || null,
            weight: parseFloat(document.getElementById('weight').value) || null,
            activity_level: document.getElementById('activityLevel').value || null
        };

        try {
            const response = await fetch(`${this.apiBase}/user/profile?user_id=${this.currentUser.id}`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(profileData)
            });

            const result = await response.json();

            if (result.success) {
                this.showNotification('Profile saved successfully! ✅', 'success');
            } else {
                this.showNotification('Failed to save profile', 'error');
            }
        } catch (error) {
            this.showNotification('Failed to save profile', 'error');
            console.error('Profile save error:', error);
        }
    }

    setupGoalsSliders() {
        // Calorie goal slider
        const calorieGoal = document.getElementById('calorieGoal');
        const calorieGoalValue = document.getElementById('calorieGoalValue');
        const clearCalorieGoal = document.getElementById('clearCalorieGoal');
        
        calorieGoal.addEventListener('input', (e) => {
            calorieGoalValue.textContent = e.target.value;
        });
        
        clearCalorieGoal.addEventListener('click', () => {
            calorieGoal.value = calorieGoal.min;
            calorieGoalValue.textContent = 'Not set';
            this.currentGoals.daily_calories = null;
        });

        // Protein goal slider
        const proteinGoal = document.getElementById('proteinGoal');
        const proteinGoalValue = document.getElementById('proteinGoalValue');
        const clearProteinGoal = document.getElementById('clearProteinGoal');
        
        proteinGoal.addEventListener('input', (e) => {
            proteinGoalValue.textContent = e.target.value + 'g';
        });
        
        clearProteinGoal.addEventListener('click', () => {
            proteinGoal.value = proteinGoal.min;
            proteinGoalValue.textContent = 'Not set';
            this.currentGoals.daily_protein = null;
        });

        // Carbs goal slider
        const carbsGoal = document.getElementById('carbsGoal');
        const carbsGoalValue = document.getElementById('carbsGoalValue');
        const clearCarbsGoal = document.getElementById('clearCarbsGoal');
        
        carbsGoal.addEventListener('input', (e) => {
            carbsGoalValue.textContent = e.target.value + 'g';
        });
        
        clearCarbsGoal.addEventListener('click', () => {
            carbsGoal.value = carbsGoal.min;
            carbsGoalValue.textContent = 'Not set';
            this.currentGoals.daily_carbs = null;
        });

        // Fat goal slider
        const fatGoal = document.getElementById('fatGoal');
        const fatGoalValue = document.getElementById('fatGoalValue');
        const clearFatGoal = document.getElementById('clearFatGoal');
        
        fatGoal.addEventListener('input', (e) => {
            fatGoalValue.textContent = e.target.value + 'g';
        });
        
        clearFatGoal.addEventListener('click', () => {
            fatGoal.value = fatGoal.min;
            fatGoalValue.textContent = 'Not set';
            this.currentGoals.daily_fat = null;
        });
    }

    async loadGoals() {
        try {
            const response = await fetch(`${this.apiBase}/user/goals?user_id=${this.currentUser.id}`);
            const goals = await response.json();
            
            this.currentGoals = goals;

            // Update form fields
            if (goals.goal_description) {
                document.getElementById('goalDescription').value = goals.goal_description;
            }

            // Update sliders and values
            if (goals.daily_calories) {
                document.getElementById('calorieGoal').value = goals.daily_calories;
                document.getElementById('calorieGoalValue').textContent = goals.daily_calories;
            }

            if (goals.daily_protein) {
                document.getElementById('proteinGoal').value = goals.daily_protein;
                document.getElementById('proteinGoalValue').textContent = goals.daily_protein + 'g';
            }

            if (goals.daily_carbs) {
                document.getElementById('carbsGoal').value = goals.daily_carbs;
                document.getElementById('carbsGoalValue').textContent = goals.daily_carbs + 'g';
            }

            if (goals.daily_fat) {
                document.getElementById('fatGoal').value = goals.daily_fat;
                document.getElementById('fatGoalValue').textContent = goals.daily_fat + 'g';
            }

            // Update sidebar calorie progress if goals exist
            this.updateCalorieProgress();

        } catch (error) {
            console.error('Failed to load goals:', error);
        }
    }

    async saveGoals() {
        const goalsData = {
            goal_description: document.getElementById('goalDescription').value || null,
            daily_calories: this.currentGoals?.daily_calories || 
                           (document.getElementById('calorieGoalValue').textContent !== 'Not set' ? 
                            parseInt(document.getElementById('calorieGoal').value) : null),
            daily_protein: this.currentGoals?.daily_protein || 
                          (document.getElementById('proteinGoalValue').textContent !== 'Not set' ? 
                           parseInt(document.getElementById('proteinGoal').value) : null),
            daily_carbs: this.currentGoals?.daily_carbs || 
                        (document.getElementById('carbsGoalValue').textContent !== 'Not set' ? 
                         parseInt(document.getElementById('carbsGoal').value) : null),
            daily_fat: this.currentGoals?.daily_fat || 
                      (document.getElementById('fatGoalValue').textContent !== 'Not set' ? 
                       parseInt(document.getElementById('fatGoal').value) : null)
        };

        try {
            const response = await fetch(`${this.apiBase}/user/goals?user_id=${this.currentUser.id}`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(goalsData)
            });

            const result = await response.json();

            if (result.success) {
                this.showNotification('Goals saved successfully! 🎯', 'success');
                this.currentGoals = goalsData;
                this.updateCalorieProgress();
            } else {
                this.showNotification('Failed to save goals', 'error');
            }
        } catch (error) {
            this.showNotification('Failed to save goals', 'error');
            console.error('Goals save error:', error);
        }
    }

    updateCalorieProgress() {
        const progressBar = document.getElementById('calorieProgress');
        const todayCalories = parseInt(document.getElementById('todayCalories').textContent) || 0;
        
        if (this.currentGoals?.daily_calories && progressBar) {
            const percentage = Math.min((todayCalories / this.currentGoals.daily_calories) * 100, 100);
            progressBar.style.width = percentage + '%';
            
            // Update the calorie display to show progress
            const calorieDisplay = document.getElementById('todayCalories');
            if (calorieDisplay) {
                calorieDisplay.textContent = `${todayCalories}/${this.currentGoals.daily_calories}`;
            }
        } else if (progressBar) {
            progressBar.style.width = '0%';
        }
    }

    async saveAiSettings() {
        const settingsData = {
            ai_temperature: parseFloat(document.getElementById('temperature').value),
            ai_top_p: parseFloat(document.getElementById('topP').value)
        };

        try {
            const response = await fetch(`${this.apiBase}/settings?user_id=${this.currentUser.id}`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(settingsData)
            });

            const result = await response.json();

            if (!result.success) {
                console.error('Failed to save AI settings');
            }
        } catch (error) {
            console.error('AI settings save error:', error);
        }
    }

    addApiKey() {
        const keyInput = document.getElementById('geminiKey');
        const apiKey = keyInput.value.trim();

        if (!apiKey) {
            this.showNotification('Please enter an API key', 'error');
            return;
        }

        // Here you would normally validate the API key
        // For now, we'll just add it to the list
        this.saveApiKey(apiKey);
        keyInput.value = '';
    }

    async saveApiKey(apiKey) {
        try {
            // Get current settings
            const response = await fetch(`${this.apiBase}/settings?user_id=${this.currentUser.id}`);
            const settings = await response.json();

            const currentKeys = settings.gemini_api_keys || [];
            currentKeys.push(apiKey);

            // Update settings
            const updateResponse = await fetch(`${this.apiBase}/settings?user_id=${this.currentUser.id}`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    ...settings,
                    gemini_api_keys: currentKeys
                })
            });

            const result = await updateResponse.json();

            if (result.success) {
                this.showNotification('API key added successfully! 🔑', 'success');
                this.updateApiKeysList(currentKeys);
            } else {
                this.showNotification('Failed to save API key', 'error');
            }
        } catch (error) {
            this.showNotification('Failed to save API key', 'error');
            console.error('API key save error:', error);
        }
    }

    updateApiKeysList(apiKeys) {
        const keysList = document.getElementById('apiKeysList');

        if (apiKeys.length > 0) {
            keysList.innerHTML = apiKeys.map((key, index) => `
                <div class="api-key-item">
                    <span class="key-preview">${key.substring(0, 8)}...${key.substring(key.length - 4)}</span>
                    <button type="button" class="btn-danger" onclick="app.removeApiKey(${index})">Remove</button>
                </div>
            `).join('');
        } else {
            keysList.innerHTML = '<p class="empty-keys">No API keys configured</p>';
        }
    }

    async removeApiKey(index) {
        try {
            const response = await fetch(`${this.apiBase}/settings?user_id=${this.currentUser.id}`);
            const settings = await response.json();

            const currentKeys = settings.gemini_api_keys || [];
            currentKeys.splice(index, 1);

            const updateResponse = await fetch(`${this.apiBase}/settings?user_id=${this.currentUser.id}`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    ...settings,
                    gemini_api_keys: currentKeys
                })
            });

            const result = await updateResponse.json();

            if (result.success) {
                this.showNotification('API key removed', 'success');
                this.updateApiKeysList(currentKeys);
            }
        } catch (error) {
            this.showNotification('Failed to remove API key', 'error');
        }
    }

    async deleteMeal(mealId) {
        console.log(`[DELETE] Frontend delete request: mealId=${mealId}, userId=${this.currentUser.id}`);

        if (!confirm('Are you sure you want to delete this meal entry?')) {
            return;
        }

        this.showLoading(true);

        try {
            const url = `${this.apiBase}/delete-meal/${mealId}?user_id=${this.currentUser.id}`;
            console.log(`[API] DELETE request URL: ${url}`);

            const response = await fetch(url, {
                method: 'DELETE',
                headers: {
                    'Content-Type': 'application/json',
                }
            });

            console.log(`[API] Response status: ${response.status}`);

            const result = await response.json();
            console.log(`[API] Response data:`, result);

            if (result.success) {
                this.showNotification('Meal deleted successfully! 🗑️', 'success');
                // Refresh the meals display
                await this.loadDailyProgress();
                await this.loadTodaysMeals();
            } else {
                this.showNotification('Failed to delete meal', 'error');
                console.error('Delete failed:', result);
            }
        } catch (error) {
            this.showNotification('Failed to delete meal', 'error');
            console.error('Meal deletion error:', error);
        } finally {
            this.showLoading(false);
        }
    }

    showLoading(show) {
        const overlay = document.getElementById('loadingOverlay');
        if (show) {
            overlay.classList.add('active');
        } else {
            overlay.classList.remove('active');
        }
    }

    showNotification(message, type = 'info') {
        const container = document.getElementById('notificationContainer');
        const notification = document.createElement('div');
        notification.className = `notification notification-${type}`;

        // Add ChunDiet icon to notifications
        const icon = type === 'success' ? '✅' : type === 'error' ? '❌' : 'ℹ️';

        notification.innerHTML = `
            <div class="notification-content">
                <span class="notification-icon">${icon}</span>
                <span class="notification-message">${message}</span>
            </div>
            <button class="notification-close">&times;</button>
        `;

        container.appendChild(notification);

        // Auto-remove after 5 seconds
        setTimeout(() => {
            if (notification.parentNode) {
                notification.parentNode.removeChild(notification);
            }
        }, 5000);

        // Manual close
        notification.querySelector('.notification-close').addEventListener('click', () => {
            if (notification.parentNode) {
                notification.parentNode.removeChild(notification);
            }
        });
    }

    formatDate(dateStr) {
        const date = new Date(dateStr);
        const today = new Date();
        const yesterday = new Date(today);
        yesterday.setDate(yesterday.getDate() - 1);

        if (dateStr === today.toISOString().split('T')[0]) {
            return 'Today';
        } else if (dateStr === yesterday.toISOString().split('T')[0]) {
            return 'Yesterday';
        } else {
            return date.toLocaleDateString('en-US', {
                weekday: 'short',
                month: 'short',
                day: 'numeric'
            });
        }
    }

    animateProgressCircles() {
        document.querySelectorAll('.circle-progress').forEach(circle => {
            const progress = circle.dataset.progress;
            const circumference = 2 * Math.PI * 40; // radius = 40
            const offset = circumference - (progress / 100) * circumference;

            // This would need additional CSS setup for SVG circles
            // For now, we'll use a simpler approach with CSS animations
            circle.style.setProperty('--progress', `${progress}%`);
        });
    }

    renderEnhancedMealCard(meal) {
        // Check if we have enhanced data or fall back to basic card
        const hasEnhancedData = meal.serving_size || meal.protein || meal.vitamins;

        if (!hasEnhancedData) {
            // Fallback to simple card for meals without detailed data
            return `
                <div class="meal-card meal-entry">
                    <div class="mobile-meal-info">
                        <div class="meal-icon">🍽️</div>
                        <h4>${meal.food_item}</h4>
                        <small>${meal.calories} kcal</small>
                    </div>
                    <div class="mobile-meal-actions">
                        <button class="mobile-action-btn mobile-delete-btn delete-meal-btn" onclick="app.deleteMeal(${meal.id})">
                            🗑️
                        </button>
                    </div>
                </div>
            `;
        }

        // Format time for display
        const timeFormatted = meal.time ? new Date(meal.time).toLocaleTimeString('en-US', {
            hour: '2-digit',
            minute: '2-digit',
            hour12: true
        }) : 'Unknown time';

        // Clean up nutrition values (remove 'g' suffix for display)
        const cleanValue = (value) => {
            if (!value) return '0';
            return typeof value === 'string' ? value.replace('g', '') : value.toString();
        };

        return `
            <div class="enhanced-meal-card meal-entry">
                <div class="meal-card-header">
                    <div class="meal-icon">🍽️</div>
                    <div class="meal-time">${timeFormatted}</div>
                </div>
                
                <div class="meal-card-content">
                    <h4 class="meal-name">${meal.food_item}</h4>
                    <div class="serving-size">${meal.serving_size || 'Standard serving'}</div>
                    
                    <div class="nutrition-summary">
                        <div class="nutrition-grid">
                            <div class="nutrition-item calories">
                                <span class="nutrition-value">${meal.calories || 0}</span>
                                <span class="nutrition-label">kcal</span>
                            </div>
                            <div class="nutrition-item protein">
                                <span class="nutrition-value">${cleanValue(meal.protein)}g</span>
                                <span class="nutrition-label">protein</span>
                            </div>
                            <div class="nutrition-item carbs">
                                <span class="nutrition-value">${cleanValue(meal.carbohydrates)}g</span>
                                <span class="nutrition-label">carbs</span>
                            </div>
                            <div class="nutrition-item fat">
                                <span class="nutrition-value">${cleanValue(meal.fat)}g</span>
                                <span class="nutrition-label">fat</span>
                            </div>
                        </div>
                    </div>
                    
                    ${meal.vitamins && meal.vitamins.length > 0 ? `
                        <div class="vitamins-section">
                            <div class="vitamins-header">Key Nutrients:</div>
                            <div class="vitamins-list">
                                ${meal.vitamins.slice(0, 4).map(vitamin => `
                                    <div class="vitamin-item">
                                        <span class="vitamin-name">${vitamin.name}</span>
                                        <span class="vitamin-value">${vitamin.percent_daily_value}</span>
                                    </div>
                                `).join('')}
                            </div>
                            ${meal.vitamins.length > 4 ? `
                                <div class="vitamins-more">+${meal.vitamins.length - 4} more nutrients</div>
                            ` : ''}
                        </div>
                    ` : `
                        <div class="no-vitamins-note">
                            <span>Detailed nutrient data available after analysis</span>
                        </div>
                    `}
                </div>
                
                <div class="meal-card-actions">
                    <button class="btn-danger delete-meal-btn" onclick="app.deleteMeal(${meal.id})">
                        Delete
                    </button>
                </div>
            </div>
        `;
    }

    initializeAnimations() {
        // Initialize background animations
        if (window.AnimationController) {
            window.AnimationController.init();
        }
    }
}

// Initialize the app when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    window.app = new ChunDietApp();
});
