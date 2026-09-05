// GSAP Scroll Animations

document.addEventListener('DOMContentLoaded', () => {
    if (typeof gsap === 'undefined' || typeof ScrollTrigger === 'undefined') return;

    gsap.registerPlugin(ScrollTrigger);

    // Navbar scroll effect
    ScrollTrigger.create({
        start: 'top -80',
        end: 99999,
        toggleClass: { className: 'scrolled', targets: '.navbar' }
    });

    // Hero animations
    gsap.from('.hero-badge', { opacity: 0, y: 20, duration: 0.8, delay: 0.2 });
    gsap.from('.title-line', { opacity: 0, y: 40, duration: 1, stagger: 0.15, delay: 0.4, ease: 'power3.out' });
    gsap.from('.hero-subtitle', { opacity: 0, y: 20, duration: 0.8, delay: 0.8 });
    gsap.from('.hero-buttons', { opacity: 0, y: 20, duration: 0.8, delay: 1 });
    gsap.from('.hero-trust', { opacity: 0, y: 20, duration: 0.8, delay: 1.2 });
    gsap.from('.dashboard-mockup', { opacity: 0, x: 60, duration: 1.2, delay: 0.6, ease: 'power3.out' });
    gsap.from('.floating-card', { opacity: 0, scale: 0.8, duration: 0.8, stagger: 0.2, delay: 1 });

    // Features section
    gsap.from('.features-header', {
        scrollTrigger: { trigger: '.features', start: 'top 80%' },
        opacity: 0, y: 40, duration: 0.8
    });

    gsap.from('.feature-flow .flow-card', {
        scrollTrigger: { trigger: '.feature-flow', start: 'top 80%' },
        opacity: 0, x: -40, duration: 0.6, stagger: 0.2
    });

    gsap.from('.feature-card', {
        scrollTrigger: { trigger: '.features-grid', start: 'top 85%' },
        opacity: 0, y: 40, duration: 0.6, stagger: 0.15
    });

    // Workflow section
    gsap.from('.workflow-text', {
        scrollTrigger: { trigger: '.workflow', start: 'top 70%' },
        opacity: 0, x: -40, duration: 0.8
    });

    gsap.from('.builder-mockup', {
        scrollTrigger: { trigger: '.workflow', start: 'top 70%' },
        opacity: 0, x: 40, duration: 0.8, delay: 0.2
    });

    gsap.from('.workflow-list li', {
        scrollTrigger: { trigger: '.workflow-list', start: 'top 85%' },
        opacity: 0, x: -20, duration: 0.5, stagger: 0.1
    });

    // Testimonials
    gsap.from('.testimonials-header', {
        scrollTrigger: { trigger: '.testimonials', start: 'top 80%' },
        opacity: 0, y: 30, duration: 0.8
    });

    gsap.from('.testimonial-card', {
        scrollTrigger: { trigger: '.testimonials-grid', start: 'top 85%' },
        opacity: 0, y: 30, duration: 0.6, stagger: 0.15
    });

    // Pricing
    gsap.from('.pricing-header', {
        scrollTrigger: { trigger: '.pricing', start: 'top 80%' },
        opacity: 0, y: 30, duration: 0.8
    });

    gsap.from('.pricing-card', {
        scrollTrigger: { trigger: '.pricing-grid', start: 'top 85%' },
        opacity: 0, y: 40, duration: 0.6, stagger: 0.15
    });

    // CTA
    gsap.from('.cta-content', {
        scrollTrigger: { trigger: '.cta', start: 'top 70%' },
        opacity: 0, y: 30, duration: 0.8
    });
});
