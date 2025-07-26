// ChunDiet Animation Controller - Liquid Nutrition Effects

class AnimationController {
    constructor() {
        this.particles = [];
        this.particleCount = 20;
        this.animationFrame = null;
    }

    init() {
        this.createNutrientParticles();
        this.startAnimationLoop();
        this.setupHoverEffects();
        this.setupScrollAnimations();
    }

    createNutrientParticles() {
        const container = document.querySelector('.nutrient-particles');
        if (!container) return;

        // Clear existing particles
        container.innerHTML = '';
        this.particles = [];

        for (let i = 0; i < this.particleCount; i++) {
            const particle = document.createElement('div');
            particle.className = 'nutrient-particle';
            
            // Random starting position
            const startX = Math.random() * window.innerWidth;
            const delay = Math.random() * 15; // Random delay up to 15s
            
            particle.style.left = startX + 'px';
            particle.style.animationDelay = delay + 's';
            
            // Random color variation
            const colors = ['var(--accent-orange)', 'var(--primary-green)', 'var(--primary-teal)', 'var(--accent-coral)'];
            const color = colors[Math.floor(Math.random() * colors.length)];
            particle.style.background = `radial-gradient(circle, ${color}, transparent)`;
            
            container.appendChild(particle);
            this.particles.push({
                element: particle,
                x: startX,
                y: window.innerHeight,
                speed: 0.5 + Math.random() * 1.5,
                size: 2 + Math.random() * 4
            });
        }
    }

    startAnimationLoop() {
        const animate = () => {
            this.updateParticles();
            this.animationFrame = requestAnimationFrame(animate);
        };
        animate();
    }

    updateParticles() {
        // This is handled by CSS animations, but we can add additional effects here
        // For now, we'll let CSS handle the particle animation
    }

    setupHoverEffects() {
        // Add glow effect to interactive elements
        const interactiveElements = document.querySelectorAll('.nav-item, .btn-primary, .btn-secondary, .meal-card, .settings-card');
        
        interactiveElements.forEach(element => {
            element.addEventListener('mouseenter', (e) => {
                this.addGlowEffect(e.target);
            });
            
            element.addEventListener('mouseleave', (e) => {
                this.removeGlowEffect(e.target);
            });
        });
    }

    addGlowEffect(element) {
        element.style.transition = 'all 0.3s ease';
        element.style.filter = 'drop-shadow(0 0 10px rgba(46, 204, 113, 0.3))';
    }

    removeGlowEffect(element) {
        element.style.filter = 'none';
    }

    setupScrollAnimations() {
        const observerOptions = {
            threshold: 0.1,
            rootMargin: '0px 0px -50px 0px'
        };

        const observer = new IntersectionObserver((entries) => {
            entries.forEach(entry => {
                if (entry.isIntersecting) {
                    entry.target.style.opacity = '1';
                    entry.target.style.transform = 'translateY(0)';
                } else {
                    entry.target.style.opacity = '0.3';
                    entry.target.style.transform = 'translateY(20px)';
                }
            });
        }, observerOptions);

        // Observe cards and sections
        const animatedElements = document.querySelectorAll('.meal-card, .settings-card, .timeline-item, .recommendation-item');
        animatedElements.forEach(el => {
            el.style.transition = 'opacity 0.6s ease, transform 0.6s ease';
            observer.observe(el);
        });
    }

    // Nutrition pulse animation for success states
    createSuccessRipple(element) {
        const ripple = document.createElement('div');
        ripple.className = 'success-ripple';
        ripple.style.cssText = `
            position: absolute;
            top: 50%;
            left: 50%;
            width: 20px;
            height: 20px;
            background: radial-gradient(circle, rgba(46, 204, 113, 0.6), transparent);
            border-radius: 50%;
            transform: translate(-50%, -50%) scale(0);
            animation: successRipple 0.6s ease-out;
            pointer-events: none;
            z-index: 1000;
        `;

        element.style.position = 'relative';
        element.appendChild(ripple);

        setTimeout(() => {
            if (ripple.parentNode) {
                ripple.parentNode.removeChild(ripple);
            }
        }, 600);
    }

    // Liquid loading animation
    createLiquidLoader(container) {
        const loader = document.createElement('div');
        loader.className = 'liquid-loader';
        loader.innerHTML = `
            <div class="liquid-wave"></div>
            <div class="liquid-wave"></div>
            <div class="liquid-wave"></div>
        `;
        
        loader.style.cssText = `
            display: flex;
            justify-content: center;
            align-items: center;
            gap: 4px;
            padding: 20px;
        `;

        const waveStyle = `
            width: 8px;
            height: 40px;
            background: linear-gradient(45deg, var(--primary-green), var(--primary-teal));
            border-radius: 4px;
            animation: liquidWave 1.4s ease-in-out infinite;
        `;

        loader.querySelectorAll('.liquid-wave').forEach((wave, index) => {
            wave.style.cssText = waveStyle;
            wave.style.animationDelay = `${index * 0.2}s`;
        });

        // Add keyframes if not already present
        if (!document.querySelector('#liquid-wave-keyframes')) {
            const style = document.createElement('style');
            style.id = 'liquid-wave-keyframes';
            style.textContent = `
                @keyframes liquidWave {
                    0%, 40%, 100% { transform: scaleY(0.4); }
                    20% { transform: scaleY(1); }
                }
            `;
            document.head.appendChild(style);
        }

        container.appendChild(loader);
        return loader;
    }

    // Progress circle animation
    animateProgressCircle(element, targetProgress) {
        const circle = element.querySelector('.circle-progress');
        if (!circle) return;

        let currentProgress = 0;
        const increment = targetProgress / 60; // 60 frames for smooth animation
        
        const animate = () => {
            currentProgress += increment;
            if (currentProgress >= targetProgress) {
                currentProgress = targetProgress;
            }
            
            circle.style.setProperty('--progress', `${currentProgress}%`);
            
            if (currentProgress < targetProgress) {
                requestAnimationFrame(animate);
            }
        };
        
        requestAnimationFrame(animate);
    }

    // Typewriter effect for text
    typewriterEffect(element, text, speed = 50) {
        element.textContent = '';
        let i = 0;
        
        const type = () => {
            if (i < text.length) {
                element.textContent += text.charAt(i);
                i++;
                setTimeout(type, speed);
            }
        };
        
        type();
    }

    // Stagger animation for lists
    staggerAnimation(elements, delay = 100) {
        elements.forEach((element, index) => {
            element.style.opacity = '0';
            element.style.transform = 'translateY(20px)';
            element.style.transition = 'opacity 0.6s ease, transform 0.6s ease';
            
            setTimeout(() => {
                element.style.opacity = '1';
                element.style.transform = 'translateY(0)';
            }, index * delay);
        });
    }

    // Floating animation for cards
    addFloatingAnimation(element) {
        element.style.animation = 'float 6s ease-in-out infinite';
        
        // Add keyframes if not already present
        if (!document.querySelector('#float-keyframes')) {
            const style = document.createElement('style');
            style.id = 'float-keyframes';
            style.textContent = `
                @keyframes float {
                    0%, 100% { transform: translateY(0px); }
                    50% { transform: translateY(-10px); }
                }
            `;
            document.head.appendChild(style);
        }
    }

    // Cleanup method
    destroy() {
        if (this.animationFrame) {
            cancelAnimationFrame(this.animationFrame);
        }
        
        // Remove all particles
        const container = document.querySelector('.nutrient-particles');
        if (container) {
            container.innerHTML = '';
        }
        
        this.particles = [];
    }

    // Responsive particle count adjustment
    adjustParticleCount() {
        const width = window.innerWidth;
        if (width < 768) {
            this.particleCount = 10;
        } else if (width < 1024) {
            this.particleCount = 15;
        } else {
            this.particleCount = 20;
        }
        
        this.createNutrientParticles();
    }
}

// Initialize animation controller
window.AnimationController = new AnimationController();

// Handle window resize
window.addEventListener('resize', () => {
    window.AnimationController.adjustParticleCount();
});

// Reduced motion support
if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
    // Disable animations for users who prefer reduced motion
    const style = document.createElement('style');
    style.textContent = `
        *, *::before, *::after {
            animation-duration: 0.01ms !important;
            animation-iteration-count: 1 !important;
            transition-duration: 0.01ms !important;
        }
        .nutrient-particle {
            display: none !important;
        }
        .liquid-waves {
            animation: none !important;
        }
    `;
    document.head.appendChild(style);
}