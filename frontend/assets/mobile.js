/* ChunDiet Mobile Enhancement - JavaScript */
/* Created by Chun - Mobile-First Interactive Features */

class MobileEnhancements {
    constructor() {
        this.isMobile = window.innerWidth <= 768;
        this.currentPage = 'home';
        this.touchStartX = 0;
        this.touchStartY = 0;
        this.swipeThreshold = 50;
        
        if (this.isMobile) {
            this.init();
        }
        
        // Listen for resize events
        window.addEventListener('resize', () => {
            this.handleResize();
        });
    }

    init() {
        this.setupMobileUI();
        this.setupTouchGestures();
        this.setupMobileNavigation();
        this.setupMobileInteractions();
        this.adaptExistingContent();
        this.setupPullToRefresh();
    }

    handleResize() {
        const wasMobile = this.isMobile;
        this.isMobile = window.innerWidth <= 768;
        
        if (this.isMobile && !wasMobile) {
            // Switched to mobile
            this.init();
        } else if (!this.isMobile && wasMobile) {
            // Switched to desktop
            this.removeMobileUI();
        }
    }

    setupMobileUI() {
        // Create mobile header
        const mobileHeader = document.createElement('div');
        mobileHeader.className = 'mobile-header';
        mobileHeader.innerHTML = `
            <h1 id="mobileTitle">ChunDiet</h1>
        `;
        document.body.insertBefore(mobileHeader, document.getElementById('app'));

        // Create mobile navigation
        const mobileNav = document.createElement('div');
        mobileNav.className = 'mobile-nav';
        mobileNav.innerHTML = `
            <div class="mobile-nav-item active" data-page="home">
                <div class="nav-icon">🏠</div>
                <small>Home</small>
            </div>
            <div class="mobile-nav-item" data-page="history">
                <div class="nav-icon">📊</div>
                <small>History</small>
            </div>
            <div class="mobile-nav-item" data-page="planner">
                <div class="nav-icon">🎯</div>
                <small>Planner</small>
            </div>
            <div class="mobile-nav-item" data-page="settings">
                <div class="nav-icon">⚙️</div>
                <small>Settings</small>
            </div>
        `;
        document.body.appendChild(mobileNav);

        // Create mobile FAB
        const fab = document.createElement('button');
        fab.className = 'mobile-fab';
        fab.innerHTML = '➕';
        fab.title = 'Quick Add Meal';
        fab.addEventListener('click', () => this.quickAddMeal());
        document.body.appendChild(fab);

        // Add mobile class to body
        document.body.classList.add('mobile-view');
    }

    removeMobileUI() {
        // Remove mobile-specific elements
        const mobileHeader = document.querySelector('.mobile-header');
        const mobileNav = document.querySelector('.mobile-nav');
        const mobileFab = document.querySelector('.mobile-fab');
        
        if (mobileHeader) mobileHeader.remove();
        if (mobileNav) mobileNav.remove();
        if (mobileFab) mobileFab.remove();
        
        document.body.classList.remove('mobile-view');
    }

    setupMobileNavigation() {
        const navItems = document.querySelectorAll('.mobile-nav-item');
        navItems.forEach(item => {
            item.addEventListener('click', (e) => {
                e.preventDefault();
                const page = item.dataset.page;
                this.switchTab(page);
                
                // Update active state
                navItems.forEach(nav => nav.classList.remove('active'));
                item.classList.add('active');
                
                // Haptic feedback if available
                if (navigator.vibrate) {
                    navigator.vibrate(50);
                }
            });
        });


    }

    switchTab(page) {
        this.currentPage = page;
        
        // Update mobile title
        const titles = {
            'home': 'ChunDiet',
            'history': 'History',
            'planner': 'AI Planner',
            'settings': 'Settings'
        };
        
        const mobileTitle = document.getElementById('mobileTitle');
        if (mobileTitle) {
            mobileTitle.textContent = titles[page] || 'ChunDiet';
        }

        // Use existing app navigation if available
        if (window.chunDietApp && window.chunDietApp.showPage) {
            window.chunDietApp.showPage(page);
        } else {
            // Fallback navigation
            this.showPage(page);
        }

        // Update mobile nav active state
        const navItems = document.querySelectorAll('.mobile-nav-item');
        navItems.forEach(item => {
            item.classList.toggle('active', item.dataset.page === page);
        });
    }

    showPage(pageId) {
        // Hide all pages
        const pages = document.querySelectorAll('.page');
        pages.forEach(page => {
            page.classList.add('hidden');
        });

        // Show selected page
        const targetPage = document.getElementById(pageId + 'Page');
        if (targetPage) {
            targetPage.classList.remove('hidden');
        }
    }

    setupTouchGestures() {
        let startX, startY, currentX, currentY;

        document.addEventListener('touchstart', (e) => {
            startX = e.touches[0].clientX;
            startY = e.touches[0].clientY;
            this.touchStartX = startX;
            this.touchStartY = startY;
        }, { passive: true });

        document.addEventListener('touchmove', (e) => {
            if (!startX || !startY) return;
            currentX = e.touches[0].clientX;
            currentY = e.touches[0].clientY;
        }, { passive: true });

        document.addEventListener('touchend', (e) => {
            if (!startX || !startY) return;

            const diffX = startX - currentX;
            const diffY = startY - currentY;

            // Horizontal swipe detection
            if (Math.abs(diffX) > Math.abs(diffY) && Math.abs(diffX) > this.swipeThreshold) {
                if (diffX > 0) {
                    this.handleSwipeLeft();
                } else {
                    this.handleSwipeRight();
                }
            }

            // Reset values
            startX = null;
            startY = null;
        }, { passive: true });
    }

    handleSwipeLeft() {
        // Navigate to next tab
        const pages = ['home', 'history', 'planner', 'settings'];
        const currentIndex = pages.indexOf(this.currentPage);
        const nextIndex = (currentIndex + 1) % pages.length;
        this.switchTab(pages[nextIndex]);
    }

    handleSwipeRight() {
        // Navigate to previous tab
        const pages = ['home', 'history', 'planner', 'settings'];
        const currentIndex = pages.indexOf(this.currentPage);
        const prevIndex = currentIndex === 0 ? pages.length - 1 : currentIndex - 1;
        this.switchTab(pages[prevIndex]);
    }

    setupMobileInteractions() {
        // Enhanced touch interactions for buttons
        const buttons = document.querySelectorAll('button, .btn-primary, .btn-secondary');
        buttons.forEach(button => {
            button.addEventListener('touchstart', () => {
                button.style.transform = 'scale(0.95)';
            }, { passive: true });

            button.addEventListener('touchend', () => {
                setTimeout(() => {
                    button.style.transform = '';
                }, 100);
            }, { passive: true });
        });

        // Improve form interactions
        const inputs = document.querySelectorAll('input, textarea, select');
        inputs.forEach(input => {
            input.addEventListener('focus', () => {
                // Scroll input into view on mobile
                setTimeout(() => {
                    input.scrollIntoView({ 
                        behavior: 'smooth', 
                        block: 'center' 
                    });
                }, 300);
            });
        });
    }

    adaptExistingContent() {
        // Adapt meal entries for mobile
        this.adaptMealEntries();
        
        // Adapt daily progress for mobile
        this.adaptDailyProgress();
        
        // Adapt settings for mobile
        this.adaptSettings();
        
        // Adapt recommendations for mobile
        this.adaptRecommendations();
    }

    adaptMealEntries() {
        const mealsGrid = document.getElementById('mealsGrid');
        if (mealsGrid) {
            // Add mobile classes to existing meal items
            const observer = new MutationObserver((mutations) => {
                mutations.forEach((mutation) => {
                    mutation.addedNodes.forEach((node) => {
                        if (node.nodeType === 1 && node.classList.contains('meal-entry')) {
                            this.makeMealEntryMobile(node);
                        }
                    });
                });
            });
            
            observer.observe(mealsGrid, { childList: true });
            
            // Adapt existing meal entries
            const existingMeals = mealsGrid.querySelectorAll('.meal-entry');
            existingMeals.forEach(meal => this.makeMealEntryMobile(meal));
        }
    }

    makeMealEntryMobile(mealElement) {
        mealElement.classList.add('mobile-meal-item');
        
        // Add swipe-to-delete functionality
        let startX = 0;
        let currentX = 0;
        let isSwipping = false;
        
        mealElement.addEventListener('touchstart', (e) => {
            startX = e.touches[0].clientX;
            isSwipping = true;
        }, { passive: true });
        
        mealElement.addEventListener('touchmove', (e) => {
            if (!isSwipping) return;
            currentX = e.touches[0].clientX;
            const diffX = startX - currentX;
            
            if (diffX > 0 && diffX < 100) {
                mealElement.style.transform = `translateX(-${diffX}px)`;
            }
        }, { passive: true });
        
        mealElement.addEventListener('touchend', () => {
            const diffX = startX - currentX;
            
            if (diffX > 50) {
                // Show delete confirmation
                this.showDeleteConfirmation(mealElement);
            }
            
            mealElement.style.transform = '';
            isSwipping = false;
        }, { passive: true });
    }

    adaptDailyProgress() {
        const dailyProgress = document.getElementById('dailyProgress');
        if (dailyProgress) {
            // Add mobile stats structure
            const observer = new MutationObserver(() => {
                this.enhanceDailyProgressMobile();
            });
            
            observer.observe(dailyProgress, { childList: true, subtree: true });
        }
    }

    enhanceDailyProgressMobile() {
        const dailyProgress = document.getElementById('dailyProgress');
        if (!dailyProgress || dailyProgress.querySelector('.mobile-stats')) return;
        
        // Create mobile stats grid
        const statsContainer = document.createElement('div');
        statsContainer.className = 'mobile-stats';
        
        const stats = [
            { label: 'Calories', value: '0', id: 'mobile-calories' },
            { label: 'Protein', value: '0g', id: 'mobile-protein' },
            { label: 'Carbs', value: '0g', id: 'mobile-carbs' },
            { label: 'Fat', value: '0g', id: 'mobile-fat' }
        ];
        
        stats.forEach(stat => {
            const statElement = document.createElement('div');
            statElement.className = 'mobile-stat';
            statElement.innerHTML = `
                <span class="mobile-stat-value" id="${stat.id}">${stat.value}</span>
                <span class="mobile-stat-label">${stat.label}</span>
            `;
            statsContainer.appendChild(statElement);
        });
        
        dailyProgress.insertBefore(statsContainer, dailyProgress.firstChild);
    }

    adaptSettings() {
        // Mobile-friendly settings layout is handled by CSS
        // Add any additional mobile-specific settings behavior here
    }

    adaptRecommendations() {
        const recommendationsSection = document.getElementById('recommendationsSection');
        if (recommendationsSection) {
            const observer = new MutationObserver(() => {
                this.enhanceRecommendationsMobile();
            });
            
            observer.observe(recommendationsSection, { childList: true, subtree: true });
        }
    }

    enhanceRecommendationsMobile() {
        const recommendations = document.querySelectorAll('.recommendation-item');
        recommendations.forEach(rec => {
            if (!rec.classList.contains('mobile-recommendation')) {
                rec.classList.add('mobile-recommendation');
            }
        });
    }

    quickAddMeal() {
        // Focus on meal input and scroll to it
        const mealInput = document.getElementById('mealDescription');
        if (mealInput) {
            // Switch to home tab if not already there
            if (this.currentPage !== 'home') {
                this.switchTab('home');
            }
            
            setTimeout(() => {
                mealInput.focus();
                mealInput.scrollIntoView({ 
                    behavior: 'smooth', 
                    block: 'center' 
                });
            }, 300);
        }
    }

    showDeleteConfirmation(mealElement) {
        if (confirm('Delete this meal entry?')) {
            // Find delete button and click it
            const deleteBtn = mealElement.querySelector('.delete-btn');
            if (deleteBtn) {
                deleteBtn.click();
            }
        }
    }



    setupPullToRefresh() {
        let startY = 0;
        let currentY = 0;
        let isPulling = false;
        
        document.addEventListener('touchstart', (e) => {
            if (window.scrollY === 0) {
                startY = e.touches[0].clientY;
                isPulling = true;
            }
        }, { passive: true });
        
        document.addEventListener('touchmove', (e) => {
            if (!isPulling) return;
            
            currentY = e.touches[0].clientY;
            const pullDistance = currentY - startY;
            
            if (pullDistance > 100) {
                // Show pull to refresh indicator
                this.showPullToRefreshIndicator();
            }
        }, { passive: true });
        
        document.addEventListener('touchend', () => {
            if (isPulling && (currentY - startY) > 100) {
                this.triggerRefresh();
            }
            isPulling = false;
            this.hidePullToRefreshIndicator();
        }, { passive: true });
    }

    showPullToRefreshIndicator() {
        let indicator = document.getElementById('pullToRefreshIndicator');
        if (!indicator) {
            indicator = document.createElement('div');
            indicator.id = 'pullToRefreshIndicator';
            indicator.style.cssText = `
                position: fixed;
                top: 70px;
                left: 50%;
                transform: translateX(-50%);
                background: white;
                padding: 8px 16px;
                border-radius: 20px;
                box-shadow: 0 2px 10px rgba(0,0,0,0.1);
                z-index: 1001;
                font-size: 14px;
                color: #667eea;
            `;
            indicator.textContent = '↓ Pull to refresh';
            document.body.appendChild(indicator);
        }
    }

    hidePullToRefreshIndicator() {
        const indicator = document.getElementById('pullToRefreshIndicator');
        if (indicator) {
            indicator.remove();
        }
    }

    triggerRefresh() {
        // Trigger a refresh of the current page data
        if (window.chunDietApp && window.chunDietApp.loadPageData) {
            window.chunDietApp.loadPageData(this.currentPage);
        }
        
        // Show refresh feedback
        this.showNotification('Refreshing...', 'info');
    }

    showNotification(message, type = 'info') {
        const notification = document.createElement('div');
        notification.className = `notification ${type}`;
        notification.textContent = message;
        
        document.body.appendChild(notification);
        
        // Show notification
        setTimeout(() => {
            notification.classList.add('show');
        }, 100);
        
        // Hide notification after 3 seconds
        setTimeout(() => {
            notification.classList.remove('show');
            setTimeout(() => {
                notification.remove();
            }, 300);
        }, 3000);
    }

    // Update mobile stats when data changes
    updateMobileStats(data) {
        if (!this.isMobile) return;
        
        const caloriesEl = document.getElementById('mobile-calories');
        const proteinEl = document.getElementById('mobile-protein');
        const carbsEl = document.getElementById('mobile-carbs');
        const fatEl = document.getElementById('mobile-fat');
        
        if (caloriesEl) caloriesEl.textContent = Math.round(data.calories || 0);
        if (proteinEl) proteinEl.textContent = Math.round(data.protein || 0) + 'g';
        if (carbsEl) carbsEl.textContent = Math.round(data.carbs || 0) + 'g';
        if (fatEl) fatEl.textContent = Math.round(data.fat || 0) + 'g';
    }
}

// Initialize mobile enhancements when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    window.mobileEnhancements = new MobileEnhancements();
});

// Handle screen orientation changes
window.addEventListener('orientationchange', () => {
    setTimeout(() => {
        if (window.mobileEnhancements) {
            window.mobileEnhancements.handleResize();
        }
    }, 100);
});

// Export for use in other scripts
if (typeof module !== 'undefined' && module.exports) {
    module.exports = MobileEnhancements;
}