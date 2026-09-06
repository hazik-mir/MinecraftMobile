// ============= API BASE URL =============
const API_BASE_URL = 'https://minecraftmobilebackend.onrender.com/';

// ============= INITIALIZATION =============
document.addEventListener('DOMContentLoaded', () => {
    initializeApp();
});

async function initializeApp() {
    loadPlayers();
    loadFAQs();
    setupEventListeners();
    loadVerificationQuestions();
}

// ============= EVENT LISTENERS =============
function setupEventListeners() {
    // Mobile navigation
    const navToggle = document.getElementById('navToggle');
    const navMenu = document.querySelector('.nav-menu');
    
    if (navToggle) {
        navToggle.addEventListener('click', () => {
            navMenu.classList.toggle('active');
        });
    }

    // Close mobile menu when link clicked
    document.querySelectorAll('.nav-link').forEach(link => {
        link.addEventListener('click', () => {
            navMenu?.classList.remove('active');
        });
    });

    // Application form
    const applicationForm = document.getElementById('applicationForm');
    if (applicationForm) {
        applicationForm.addEventListener('submit', handleApplicationSubmit);
    }

    // Staff form
    const staffForm = document.getElementById('staffForm');
    if (staffForm) {
        staffForm.addEventListener('submit', handleStaffSubmit);
    }

    // Player search
    const playerSearch = document.getElementById('playerSearch');
    if (playerSearch) {
        playerSearch.addEventListener('input', filterPlayers);
    }

    // Playstyle filter
    const filterPlaystyle = document.getElementById('filterPlaystyle');
    if (filterPlaystyle) {
        filterPlaystyle.addEventListener('change', filterPlayers);
    }

    // FAQ search
    const faqSearch = document.getElementById('faqSearch');
    if (faqSearch) {
        faqSearch.addEventListener('input', searchFAQs);
    }

    // FAQ accordion
    document.addEventListener('click', (e) => {
        if (e.target.closest('.faq-question')) {
            const faqItem = e.target.closest('.faq-item');
            faqItem.classList.toggle('open');
        }
    });
}

// ============= PLAYER MANAGEMENT =============
async function loadPlayers() {
    try {
        const response = await fetch(`${API_BASE_URL}/api/players`);
        const players = await response.json();
        displayPlayers(players);
        updatePlayerCount(players.length);
    } catch (error) {
        console.error('Error loading players:', error);
        document.getElementById('tiersContainer').innerHTML = 
            '<div class="empty-state">📋 No players yet. Be the first to apply!</div>';
    }
}

function displayPlayers(players) {
    const container = document.getElementById('tiersContainer');
    
    if (players.length === 0) {
        container.innerHTML = '<div class="empty-state">📋 No players yet. Be the first to apply!</div>';
        return;
    }

    // Group players by tier
    const tiers = {
        'S': players.filter(p => p.rank >= 1 && p.rank <= 5),
        'A': players.filter(p => p.rank >= 6 && p.rank <= 15),
        'B': players.filter(p => p.rank >= 16 && p.rank <= 30),
        'C': players.filter(p => p.rank > 30)
    };

    let html = '';
    const tierLabels = {
        'S': '👑 S-Tier (Legendary)',
        'A': '⭐ A-Tier (Professional)',
        'B': '🎮 B-Tier (Competitive)',
        'C': '🏅 C-Tier (Casual Competitive)'
    };

    for (const [tier, tierPlayers] of Object.entries(tiers)) {
        if (tierPlayers.length === 0) continue;

        html += `
            <div class="tier-group">
                <div class="tier-header ${tier}">${tierLabels[tier]}</div>
                <div class="tier-players">
                    ${tierPlayers.map(player => `
                        <div class="player-card">
                            <div class="player-rank">#${player.rank}</div>
                            <div class="player-name">${escapeHtml(player.username)}</div>
                            <div class="player-info">📍 ${escapeHtml(player.server)}</div>
                            <div class="player-info">🎯 ${player.wins} Wins</div>
                            <span class="player-playstyle">${escapeHtml(player.playstyle)}</span>
                        </div>
                    `).join('')}
                </div>
            </div>
        `;
    }

    container.innerHTML = html || '<div class="empty-state">📋 No players yet. Be the first to apply!</div>';
}

function filterPlayers() {
    const searchQuery = document.getElementById('playerSearch').value.toLowerCase();
    const playstyleFilter = document.getElementById('filterPlaystyle').value;

    const cards = document.querySelectorAll('.player-card');
    cards.forEach(card => {
        const playerName = card.querySelector('.player-name').textContent.toLowerCase();
        const playerPlaystyle = card.querySelector('.player-playstyle').textContent.trim();
        
        const matchesSearch = playerName.includes(searchQuery);
        const matchesPlaystyle = !playstyleFilter || playerPlaystyle === playstyleFilter;
        
        card.closest('.tier-players').parentElement.style.display = 
            (matchesSearch && matchesPlaystyle) ? 'block' : 'none';
    });
}

function updatePlayerCount(count) {
    const playerCountElement = document.getElementById('playerCount');
    if (playerCountElement) {
        playerCountElement.textContent = count;
    }
}

// ============= APPLICATION HANDLING =============
async function handleApplicationSubmit(e) {
    e.preventDefault();
    
    const formData = new FormData(e.target);
    const answers = {
        experience: formData.get('experience'),
        winrate: formData.get('winrate'),
        reason: formData.get('reason'),
        videos: formData.get('videos') || 'Not provided'
    };

    const verificationAnswers = getVerificationAnswers();

    const application = {
        username: formData.get('username'),
        email: formData.get('email'),
        playstyle: formData.get('playstyle'),
        server: formData.get('server'),
        answers,
        verificationAnswers
    };

    try {
        const response = await fetch(`${API_BASE_URL}/api/applications`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(application)
        });

        if (!response.ok) throw new Error('Application submission failed');

        const result = await response.json();
        showSuccessModal('Your application has been submitted! Check the Discord server for verification updates.', application.username);
        e.target.reset();
    } catch (error) {
        console.error('Error:', error);
        alert('Error submitting application. Please try again.');
    }
}

async function handleStaffSubmit(e) {
    e.preventDefault();
    
    const formData = new FormData(e.target);
    const staffApplication = {
        username: formData.get('username'),
        email: formData.get('email'),
        reason: formData.get('reason'),
        experience: formData.get('experience')
    };

    try {
        const response = await fetch(`${API_BASE_URL}/api/staff-applications`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(staffApplication)
        });

        if (!response.ok) throw new Error('Staff application submission failed');

        const result = await response.json();
        showSuccessModal('Your staff application has been submitted! Our team will review it and contact you soon.', staffApplication.username);
        e.target.reset();
    } catch (error) {
        console.error('Error:', error);
        alert('Error submitting staff application. Please try again.');
    }
}

function getVerificationAnswers() {
    const answers = {};
    const verificationQuestions = document.querySelectorAll('.verification-question');
    
    verificationQuestions.forEach((question, index) => {
        const select = question.querySelector('select');
        if (select) {
            answers[`question_${index + 1}`] = select.value;
        }
    });

    return answers;
}

// ============= FAQ MANAGEMENT =============
async function loadFAQs() {
    try {
        const response = await fetch(`${API_BASE_URL}/api/faqs`);
        const faqs = await response.json();
        displayFAQs(faqs);
    } catch (error) {
        console.error('Error loading FAQs:', error);
    }
}

function displayFAQs(faqs) {
    const container = document.getElementById('faqListContainer');
    if (!container) return;

    const html = faqs.map(faq => `
        <div class="faq-item">
            <div class="faq-question">${escapeHtml(faq.question)}</div>
            <div class="faq-answer"><p>${escapeHtml(faq.answer)}</p></div>
        </div>
    `).join('');

    container.innerHTML = html;
}

function searchFAQs() {
    const searchQuery = document.getElementById('faqSearch').value.toLowerCase();
    const faqItems = document.querySelectorAll('.faq-item');

    faqItems.forEach(item => {
        const question = item.querySelector('.faq-question').textContent.toLowerCase();
        const answer = item.querySelector('.faq-answer').textContent.toLowerCase();
        
        if (question.includes(searchQuery) || answer.includes(searchQuery)) {
            item.style.display = 'block';
        } else {
            item.style.display = 'none';
        }
    });
}

// ============= VERIFICATION QUESTIONS =============
async function loadVerificationQuestions() {
    try {
        const response = await fetch(`${API_BASE_URL}/api/verification-questions`);
        const questions = await response.json();
        displayVerificationQuestions(questions);
    } catch (error) {
        console.error('Error loading verification questions:', error);
    }
}

function displayVerificationQuestions(questions) {
    const container = document.getElementById('verificationQuestionsContainer');
    if (!container) return;

    const html = questions.map((q, index) => `
        <div class="form-group verification-question">
            <label>${escapeHtml(q.question)} *</label>
            <select name="verification_${index}" required>
                <option value="">Select an answer</option>
                ${q.options.map(opt => `<option value="${escapeHtml(opt)}">${escapeHtml(opt)}</option>`).join('')}
            </select>
        </div>
    `).join('');

    container.innerHTML = html;
}

// ============= FORM NAVIGATION =============
function nextStep(stepNumber) {
    const form = document.getElementById('applicationForm');
    
    // Hide all steps
    document.querySelectorAll('.form-step').forEach(step => {
        step.style.display = 'none';
    });

    // Validate current step before moving forward
    const currentStepNum = Array.from(document.querySelectorAll('.form-step')).findIndex(s => s.style.display !== 'none');
    
    // Show next step
    const nextStep = document.getElementById(`step${stepNumber}`);
    if (nextStep) {
        nextStep.style.display = 'block';
        nextStep.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
}

// ============= MODAL MANAGEMENT =============
function openFormModal() {
    document.getElementById('applicationModal').style.display = 'block';
    document.getElementById('step1').style.display = 'block';
    document.querySelectorAll('.form-step').forEach((step, i) => {
        if (i !== 0) step.style.display = 'none';
    });
}

function openStaffModal() {
    document.getElementById('staffModal').style.display = 'block';
}

function closeModal(modalId) {
    document.getElementById(modalId).style.display = 'none';
}

function showSuccessModal(message, username) {
    const modal = document.getElementById('successModal');
    const messageElement = document.getElementById('successMessage');
    
    messageElement.innerHTML = `
        <p>Thank you, <strong>${escapeHtml(username)}</strong>!</p>
        <p>${message}</p>
    `;
    
    modal.style.display = 'block';
    closeModal('applicationModal');
    closeModal('staffModal');

    // Auto-close after 5 seconds
    setTimeout(() => {
        closeModal('successModal');
    }, 5000);
}

// Close modal when clicking outside
window.addEventListener('click', (e) => {
    const modals = document.querySelectorAll('.modal');
    modals.forEach(modal => {
        if (e.target === modal) {
            modal.style.display = 'none';
        }
    });
});

// ============= UTILITY FUNCTIONS =============
function escapeHtml(text) {
    const map = {
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#039;'
    };
    return text.replace(/[&<>"']/g, m => map[m]);
}

// ============= SMOOTH SCROLL FOR NAVIGATION =============
document.querySelectorAll('a[href^="#"]').forEach(anchor => {
    anchor.addEventListener('click', function (e) {
        const href = this.getAttribute('href');
        if (href !== '#' && document.querySelector(href)) {
            e.preventDefault();
            document.querySelector(href).scrollIntoView({
                behavior: 'smooth'
            });
        }
    });
});

// ============= LOAD MORE BUTTON (Optional) =============
window.addEventListener('load', () => {
    // Animate elements on scroll
    const observerOptions = {
        threshold: 0.1,
        rootMargin: '0px 0px -50px 0px'
    };

    const observer = new IntersectionObserver(function (entries) {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                entry.target.style.opacity = '1';
                entry.target.style.transform = 'translateY(0)';
            }
        });
    }, observerOptions);

    document.querySelectorAll('.feature-card, .apply-card, .player-card').forEach(el => {
        el.style.opacity = '0';
        el.style.transform = 'translateY(20px)';
        el.style.transition = 'all 0.5s ease-out';
        observer.observe(el);
    });
});
