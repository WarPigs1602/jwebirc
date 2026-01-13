/**
 * jWebirc Emoji Picker Handler - Enhanced Version with Search & Recent Emojis
 * Provides an improved emoji picker with search functionality, recently used tracking, and better organization
 */

class EmojiPickerHandler {
    constructor() {
        this.messageInput = null;
        this.emojiBtn = null;
        this.pickerModal = null;
        this.currentCategory = null;
        this.isOpen = false;
        this.recentEmojis = [];
        this.searchInput = null;
        this.allEmojisFlat = [];
        this.selectedSkinTone = ''; // No modifier by default
        this.skinTonePicker = null;
        this.t = (key) => (window.jwebircTranslate ? window.jwebircTranslate(key) : key);
        
        // Load recently used emojis from localStorage
        this.loadRecentEmojis();
        this.loadSkinTonePreference();
        
        // Emojis that support skin tone modifiers
        this.skinToneSupportingEmojis = new Set([
            // Hands & Gestures
            '👋', '🤚', '🖐️', '✋', '🖖', '👌', '🤌', '🤏', '✌️', '🤞', '🫰', '🤟', '🤘', '🤙', 
            '👍', '👎', '✊', '👊', '🤛', '🤜', '👏', '🙌', '👐', '🤲', '🤝', '🫳', '🫴', '🫶', 
            '💪', '🦵', '🦶', '👂', '👃', '🧠', '🦷', '🦴',
            // Variants without VS-16
            '🖐', '✋', '✌', '👏', '👐', '🤲',
            // People and body parts
            '👶', '🧒', '👦', '👧', '🧑', '👨', '👩', '🧓', '👴', '👵',
            '👨‍⚕️', '👩‍⚕️', '👨‍🎓', '👩‍🎓', '👨‍🏫', '👩‍🏫', '👨‍⚖️', '👩‍⚖️',
            '👨‍🌾', '👩‍🌾', '👨‍🍳', '👩‍🍳', '👨‍🔧', '👩‍🔧', '👨‍🏭', '👩‍🏭',
            '👨‍💼', '👩‍💼', '👨‍🔬', '👩‍🔬', '👨‍💻', '👩‍💻', '👨‍🎤', '👩‍🎤',
            '👨‍🎨', '👩‍🎨', '👨‍✈️', '👩‍✈️', '👨‍🚀', '👩‍🚀', '👨‍🚒', '👩‍🚒',
            '👮', '👮‍♂️', '👮‍♀️', '🕵️', '🕵️‍♂️', '🕵️‍♀️', '💂', '💂‍♂️', '💂‍♀️',
            '👷', '👷‍♂️', '👷‍♀️', '🤴', '👸', '👳', '👳‍♂️', '👳‍♀️', '👲',
            '🧕', '🤵', '👰', '🤰', '🤱', '👼',
            '🙍', '🙍‍♂️', '🙍‍♀️', '🙎', '🙎‍♂️', '🙎‍♀️', '🙅', '🙅‍♂️', '🙅‍♀️',
            '🙆', '🙆‍♂️', '🙆‍♀️', '💁', '💁‍♂️', '💁‍♀️', '🙋', '🙋‍♂️', '🙋‍♀️',
            '🙇', '🙇‍♂️', '🙇‍♀️', '🤦', '🤦‍♂️', '🤦‍♀️', '🤷', '🤷‍♂️', '🤷‍♀️',
            '💆', '💆‍♂️', '💆‍♀️', '💇', '💇‍♂️', '💇‍♀️', '🚶', '🚶‍♂️', '🚶‍♀️',
            '🏃', '🏃‍♂️', '🏃‍♀️', '💃', '🕺', '🕴️', '👯', '👯‍♂️', '👯‍♀️',
            '🧖', '🧖‍♂️', '🧖‍♀️', '🧗', '🧗‍♂️', '🧗‍♀️', '🧘', '🧘‍♂️', '🧘‍♀️',
            '🛀', '🛌', '🤸', '🤸‍♂️', '🤸‍♀️', '🤽', '🤽‍♂️', '🤽‍♀️',
            '🤾', '🤾‍♂️', '🤾‍♀️', '🤹', '🤹‍♂️', '🤹‍♀️',
            '🏇', '⛷️', '🏂', '🏌️', '🏌️‍♂️', '🏌️‍♀️', '🏄', '🏄‍♂️', '🏄‍♀️',
            '🚣', '🚣‍♂️', '🚣‍♀️', '🏊', '🏊‍♂️', '🏊‍♀️', '⛹️', '⛹️‍♂️', '⛹️‍♀️',
            '🏋️', '🏋️‍♂️', '🏋️‍♀️', '🚴', '🚴‍♂️', '🚴‍♀️', '🚵', '🚵‍♂️', '🚵‍♀️',
            '🤺', '🤼', '🤼‍♂️', '🤼‍♀️', '🤽', '🤽‍♂️', '🤽‍♀️',
            '🧙', '🧙‍♂️', '🧙‍♀️', '🧚', '🧚‍♂️', '🧚‍♀️', '🧛', '🧛‍♂️', '🧛‍♀️',
            '🧜', '🧜‍♂️', '🧜‍♀️', '🧝', '🧝‍♂️', '🧝‍♀️', '🧞', '🧞‍♂️', '🧞‍♀️',
            '🧟', '🧟‍♂️', '🧟‍♀️', '💅', '🤳',
            '🦸', '🦸‍♂️', '🦸‍♀️', '🦹', '🦹‍♂️', '🦹‍♀️', '🧑‍🦰', '🧑‍🦱', '🧑‍🦲', '🧑‍🦳',
            '🤝', '🦻', '🦾', '🦿', '🙏'
        ]);
        
        // Comprehensive emoji list organized by category
        this.emojis = {
            'Smileys': ['😀', '😃', '😄', '😁', '😆', '😅', '🤣', '😂', '🙂', '🙃', '😉', '😊', '😇', '🥰', '😍', '🤩', '😘', '😗', '😚', '😙', '🥲', '😋', '😛', '😜', '🤪', '😌', '😔', '😑', '😐', '😶', '🙁', '☹️', '🤨', '🤓', '😎', '🥸', '😕', '😟', '🥺', '😮', '😯', '😲', '😳', '😦', '😧', '😨', '😰', '😥', '😢', '😭', '😱', '😖', '😣', '😞', '😓', '😩', '😫', '🥱', '😤', '😡', '😠', '🤬', '😈', '👿', '💀', '☠️', '💩', '🤡', '👹', '👺', '👻', '👽', '👾', '🤖'],
            'Gestures': ['👋', '🤚', '🖐️', '✋', '🖖', '👌', '🤌', '🤏', '✌️', '🤞', '🫰', '🤟', '🤘', '🤙', '👍', '👎', '✊', '👊', '🤛', '🤜', '👏', '🙌', '👐', '🤲', '🤝', '🫳', '🫴', '🫶', '💪', '🦵', '🦶', '👂', '👃', '🧠', '🦷', '🦴'],
            'Hearts': ['❤️', '🧡', '💛', '💚', '💙', '💜', '🖤', '🤍', '🤎', '💔', '💕', '💞', '💓', '💗', '💖', '💘', '💝', '💟', '💌'],
            'Food': ['🍏', '🍎', '🍐', '🍊', '🍋', '🍌', '🍉', '🍇', '🍓', '🫐', '🍈', '🍒', '🍑', '🥭', '🍍', '🥥', '🥝', '🍅', '🍆', '🥑', '🥦', '🥬', '🥒', '🌶️', '🌽', '🥔', '🍠', '🥐', '🥯', '🍞', '🥖', '🥨', '🧀', '🥚', '🍳', '🧈', '🥞', '🥓', '🍗', '🍖', '🌭', '🍔', '🍟', '🍕', '🥪', '🥙', '🧆', '🌮', '🌯', '🥗', '🥘', '🥫', '🍝', '🍜', '🍲', '🍛', '🍣', '🍱', '🥟', '🦪', '🍤', '🍙', '🍚', '🍘', '🍥', '🥠', '🥮', '🍢', '🍡', '🍧', '🍨', '🍦', '🍰', '🎂', '🧁', '🍮', '🍭', '🍬', '🍫', '🍿', '🍩', '🍪', '🌰', '🍯', '🥛', '☕', '🍵', '🍶', '🍾', '🍷', '🍸', '🍹', '🍺', '🍻', '🥂', '🥃'],
            'Nature': ['🌸', '🌼', '🌻', '🌞', '🌝', '🌛', '🌜', '🌚', '🌕', '🌖', '🌗', '🌘', '🌑', '🌒', '🌓', '🌔', '⭐', '🌟', '✨', '⚡', '☄️', '💥', '🔥', '🌪️', '🌈', '☀️', '🌤️', '⛅', '🌥️', '☁️', '🌦️', '🌧️', '⛈️', '🌨️', '❄️', '☃️', '⛄', '🌬️', '💨', '💧', '💦', '☔'],
            'Activities': ['⚽', '🏀', '🏈', '⚾', '🥎', '🎾', '🏐', '🏉', '🥏', '🎳', '🏓', '🏸', '🏒', '🏑', '🥍', '🏏', '🥅', '⛳', '⛸️', '🎣', '🎽', '🎿', '⛷️', '🏂', '🪂', '🛼', '🛹', '🛷', '🥌', '🎯', '🎨', '🎬', '🎤', '🎧', '🎼', '🎹', '🥁', '🎷', '🎺', '🎸', '🎻', '🎲'],
            'Travel': ['🚗', '🚕', '🚙', '🚌', '🚎', '🏎️', '🚐', '🛻', '🚚', '🚛', '🚜', '🏍️', '🛵', '🚲', '🛴', '🛹', '🛼', '🚨', '🚔', '🚍', '🚘', '🚖', '🚡', '🚠', '🚟', '🚃', '🚋', '🚞', '🚝', '🚄', '🚅', '🚈', '🚂', '🚆', '🚇', '🚊', '🚉', '✈️', '🛫', '🛬', '🛰️', '🚁', '🛶', '⛵', '🚤', '🛳️', '⛴️', '⚓', '⛽', '🚥', '🚦', '🛑'],
            'Recent': []
        };
        
        // Build flat list of all emojis for search
        this.buildFlatEmojiList();

        // Re-render texts when language changes
        window.addEventListener('jwebirc:languageChanged', () => {
            if (this.isOpen) this.closePicker();
            this.createModal();
        });
    }

    getSkinTones() {
        return [
            { name: this.t('emoji.skinTone.default'), modifier: '' },
            { name: this.t('emoji.skinTone.light'), modifier: '🏻' },
            { name: this.t('emoji.skinTone.mediumLight'), modifier: '🏼' },
            { name: this.t('emoji.skinTone.medium'), modifier: '🏽' },
            { name: this.t('emoji.skinTone.mediumDark'), modifier: '🏾' },
            { name: this.t('emoji.skinTone.dark'), modifier: '🏿' }
        ];
    }

    getCategories() {
        return [
            { key: 'Recent', label: this.t('emoji.category.recent'), icon: '⏱️' },
            { key: 'Smileys', label: this.t('emoji.category.smileys'), icon: '😀' },
            { key: 'Gestures', label: this.t('emoji.category.gestures'), icon: '👋' },
            { key: 'Hearts', label: this.t('emoji.category.hearts'), icon: '❤️' },
            { key: 'Food', label: this.t('emoji.category.food'), icon: '🍕' },
            { key: 'Nature', label: this.t('emoji.category.nature'), icon: '🌸' },
            { key: 'Activities', label: this.t('emoji.category.activities'), icon: '⚽' },
            { key: 'Travel', label: this.t('emoji.category.travel'), icon: '✈️' }
        ];
    }
    
    buildFlatEmojiList() {
        // Create a flat list with category info for better search
        for (let category in this.emojis) {
            if (category !== 'Recent') {
                this.emojis[category].forEach(emoji => {
                    this.allEmojisFlat.push({
                        emoji: emoji,
                        category: category
                    });
                });
            }
        }
    }
    
    loadRecentEmojis() {
        try {
            const stored = localStorage.getItem('jwebirc_recent_emojis');
            this.recentEmojis = stored ? JSON.parse(stored) : [];
            this.emojis['Recent'] = this.recentEmojis;
        } catch (e) {
            this.recentEmojis = [];
        }
    }
    
    saveRecentEmojis() {
        try {
            localStorage.setItem('jwebirc_recent_emojis', JSON.stringify(this.recentEmojis));
        } catch (e) {
            // localStorage not available - silently fail
        }
    }
    
    loadSkinTonePreference() {
        try {
            const stored = localStorage.getItem('jwebirc_skin_tone');
            this.selectedSkinTone = stored || '';
        } catch (e) {
            this.selectedSkinTone = '';
        }
    }
    
    saveSkinTonePreference() {
        try {
            localStorage.setItem('jwebirc_skin_tone', this.selectedSkinTone);
        } catch (e) {
            // localStorage not available
        }
    }
    
    setSkinTone(modifier) {
        this.selectedSkinTone = modifier;
        this.saveSkinTonePreference();
        
        // Update UI
        document.querySelectorAll('.skin-tone-btn').forEach(btn => {
            const btnModifier = btn.getAttribute('data-modifier');
            btn.classList.toggle('active', btnModifier === modifier);
        });
        
        // Refresh display to show emojis with new skin tone
        if (this.currentCategory) {
            this.displayCategory(this.currentCategory);
        }
    }
    
    addRecentEmoji(emoji) {
        // Store base emoji without skin tone modifier
        const baseEmoji = emoji.replace(/\uFE0F/g, '').replace(/[\u{1F3FB}-\u{1F3FF}]/gu, '');
        
        // Remove if already exists
        const idx = this.recentEmojis.indexOf(baseEmoji);
        if (idx > -1) {
            this.recentEmojis.splice(idx, 1);
        }
        
        // Add to beginning and limit to 20 most recent
        this.recentEmojis.unshift(baseEmoji);
        if (this.recentEmojis.length > 20) {
            this.recentEmojis.pop();
        }
        
        this.emojis['Recent'] = this.recentEmojis;
        this.saveRecentEmojis();
        
        // Update Recent category button if it was disabled
        const recentBtn = document.querySelector('.emoji-category-btn[data-category="Recent"]');
        if (recentBtn && this.recentEmojis.length > 0) {
            recentBtn.classList.remove('disabled');
            recentBtn.removeAttribute('disabled');
        }
    }
    
    init() {
        this.messageInput = document.getElementById('message');
        this.emojiBtn = document.getElementById('emojiBtn');
        
        if (!this.emojiBtn) return;
        
        // Create modal
        this.createModal();
        
        // Event listener for emoji button
        this.emojiBtn.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            this.togglePicker();
        });
        
        // Close when clicking outside
        document.addEventListener('click', (e) => {
            if (this.isOpen && this.pickerModal && !this.pickerModal.contains(e.target) && !this.emojiBtn.contains(e.target)) {
                this.closePicker();
            }
        });
        
        // Close with Escape key
        document.addEventListener('keydown', (e) => {
            if (this.isOpen && e.key === 'Escape') {
                this.closePicker();
            }
        });
    }
    
    createModal() {
        // Remove existing modal if present
        const existingModal = document.getElementById('emoji-picker-modal');
        if (existingModal) {
            existingModal.remove();
        }

        const categories = this.getCategories();
        const skinTones = this.getSkinTones();
        
        // Create category buttons HTML
        let categoriesHtml = '';
        categories.forEach(cat => {
            const isDisabled = cat.key === 'Recent' && this.recentEmojis.length === 0 ? 'disabled' : '';
            categoriesHtml += `
                <button class="emoji-category-btn ${isDisabled}" 
                        data-category="${cat.key}" 
                        title="${cat.label}"
                        aria-label="${cat.label}">
                    <span class="emoji-category-icon">${cat.icon}</span>
                    <span class="emoji-category-label">${cat.label}</span>
                </button>`;
        });
        
        // Create skin tone buttons HTML
        let skinTonesHtml = '';
        skinTones.forEach(tone => {
            const isActive = tone.modifier === this.selectedSkinTone ? 'active' : '';
            skinTonesHtml += `
                <button class="skin-tone-btn ${isActive}" 
                        data-modifier="${tone.modifier}" 
                        title="${tone.name}"
                        aria-label="${this.t('emoji.skinTone')}: ${tone.name}"
                        type="button">
                    ${tone.modifier ? tone.modifier : '⭐'}
                </button>`;
        });
        
        // Create main modal HTML
        const modalHtml = `
            <div id="emoji-picker-modal" class="emoji-picker-modal">
                <div class="emoji-picker-container">
                    <div class="emoji-picker-header">
                        <h2 class="emoji-picker-title">${this.t('emoji.title')}</h2>
                        <button class="emoji-close-btn" aria-label="${this.t('emoji.close')}" title="${this.t('emoji.closeHint')}">&times;</button>
                    </div>
                    
                    <div class="emoji-skin-tones">
                        <span class="skin-tone-label">${this.t('emoji.skinTone')}:</span>
                        <div class="skin-tone-buttons">
                            ${skinTonesHtml}
                        </div>
                    </div>
                    
                    <div class="emoji-search-container">
                        <input type="text" 
                               class="emoji-search-input" 
                               id="emojiSearchInput" 
                               placeholder="${this.t('emoji.searchPlaceholder')}"
                               aria-label="${this.t('emoji.searchPlaceholder')}">
                    </div>
                    
                    <div class="emoji-categories">
                        ${categoriesHtml}
                    </div>
                    
                    <div class="emoji-content">
                        <div class="emoji-grid" id="emojiGrid"></div>
                        <div class="emoji-no-results" id="emojiNoResults" style="display:none;">
                            <p>${this.t('emoji.noResults')}</p>
                        </div>
                    </div>
                </div>
            </div>
        `;
        
        document.body.insertAdjacentHTML('beforeend', modalHtml);
        this.pickerModal = document.getElementById('emoji-picker-modal');
        this.searchInput = document.getElementById('emojiSearchInput');
        
        // Setup skin tone buttons with proper context
        const self = this;
        setTimeout(() => {
            const skinToneButtons = document.querySelectorAll('.skin-tone-btn');
            skinToneButtons.forEach(btn => {
                btn.addEventListener('click', function(e) {
                    e.preventDefault();
                    e.stopPropagation();
                    const modifier = this.getAttribute('data-modifier');
                    self.setSkinTone(modifier);
                });
            });
        }, 0);
        
        // Setup category buttons
        document.querySelectorAll('.emoji-category-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.preventDefault();
                e.stopPropagation();
                
                if (btn.classList.contains('disabled')) return;
                
                const category = btn.getAttribute('data-category');
                this.switchCategory(category);
                this.searchInput.value = '';
                this.displayCategory(category);
            });
        });
        
        // Setup search input
        this.searchInput.addEventListener('input', (e) => {
            e.preventDefault();
            e.stopPropagation();
            this.searchEmojis(this.searchInput.value);
        });
        
        // Setup close button
        document.querySelector('.emoji-close-btn').addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            this.closePicker();
        });
        
        // Close modal when clicking outside the content area
        this.pickerModal.addEventListener('click', (e) => {
            if (e.target === this.pickerModal) {
                this.closePicker();
            }
        });
        
        // Display initial category
        const initialCat = this.recentEmojis.length > 0 ? 'Recent' : 'Smileys';
        this.switchCategory(initialCat);
        this.displayCategory(initialCat);
    }
    
    switchCategory(category) {
        this.currentCategory = category;
        
        // Update active button
        document.querySelectorAll('.emoji-category-btn').forEach(btn => {
            const isActive = btn.getAttribute('data-category') === category;
            btn.classList.toggle('active', isActive);
            btn.setAttribute('aria-pressed', isActive);
        });
    }
    
    displayCategory(category) {
        const gridEl = document.getElementById('emojiGrid');
        const noResults = document.getElementById('emojiNoResults');
        
        gridEl.innerHTML = '';
        noResults.style.display = 'none';
        
        if (this.emojis[category]) {
            const emojis = this.emojis[category];
            
            if (emojis.length === 0 && category === 'Recent') {
                noResults.innerHTML = `<p>${this.t('emoji.noRecent')}</p>`;
                noResults.style.display = 'block';
            } else {
                emojis.forEach(emoji => {
                    const btn = document.createElement('button');
                    btn.className = 'emoji-btn';
                    
                    // Display emoji with current skin tone if applicable
                    let displayEmoji = emoji;
                    const baseEmoji = emoji.replace(/\uFE0F/g, '').replace(/[\u{1F3FB}-\u{1F3FF}]/gu, '');
                    
                    if (this.selectedSkinTone && this.skinToneSupportingEmojis.has(baseEmoji)) {
                        if (emoji.includes('\uFE0F')) {
                            displayEmoji = baseEmoji + this.selectedSkinTone + '\uFE0F';
                        } else {
                            displayEmoji = baseEmoji + this.selectedSkinTone;
                        }
                    }
                    
                    btn.innerHTML = displayEmoji;
                    btn.setAttribute('data-emoji', emoji);
                    btn.setAttribute('data-display-emoji', displayEmoji);
                    btn.setAttribute('title', displayEmoji);
                    btn.addEventListener('click', (e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        this.insertEmoji(emoji);
                    });
                    gridEl.appendChild(btn);
                });
            }
        }
    }
    
    searchEmojis(query) {
        const gridEl = document.getElementById('emojiGrid');
        const noResults = document.getElementById('emojiNoResults');
        
        if (!query.trim()) {
            // Show current category if search is empty
            if (this.currentCategory) {
                this.displayCategory(this.currentCategory);
            }
            return;
        }
        
        const searchTerm = query.toLowerCase();
        const results = [];
        
        // Search through all emojis with category info
        this.allEmojisFlat.forEach(item => {
            const categoryMatch = item.category.toLowerCase().includes(searchTerm);
            if (categoryMatch) {
                results.push(item.emoji);
            }
        });
        
        // Remove duplicates while preserving order
        const uniqueResults = [...new Set(results)];
        
        gridEl.innerHTML = '';
        
        if (uniqueResults.length === 0) {
            noResults.style.display = 'block';
        } else {
            noResults.style.display = 'none';
            uniqueResults.forEach(emoji => {
                const btn = document.createElement('button');
                btn.className = 'emoji-btn';
                
                // Display emoji with current skin tone if applicable
                let displayEmoji = emoji;
                const baseEmoji = emoji.replace(/\uFE0F/g, '').replace(/[\u{1F3FB}-\u{1F3FF}]/gu, '');
                
                if (this.selectedSkinTone && this.skinToneSupportingEmojis.has(baseEmoji)) {
                    if (emoji.includes('\uFE0F')) {
                        displayEmoji = baseEmoji + this.selectedSkinTone + '\uFE0F';
                    } else {
                        displayEmoji = baseEmoji + this.selectedSkinTone;
                    }
                }
                
                btn.innerHTML = displayEmoji;
                btn.setAttribute('data-emoji', emoji);
                btn.setAttribute('data-display-emoji', displayEmoji);
                btn.setAttribute('title', displayEmoji);
                btn.addEventListener('click', (e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    this.insertEmoji(emoji);
                });
                gridEl.appendChild(btn);
            });
        }
    }
    
    insertEmoji(emoji) {
        // Apply skin tone modifier if applicable and selected
        let finalEmoji = emoji;
        
        // Remove variation selector (VS-16) and any existing skin tone modifiers for checking
        const baseEmoji = emoji.replace(/\uFE0F/g, '').replace(/[\u{1F3FB}-\u{1F3FF}]/gu, '');
        
        // Apply skin tone if selected and emoji supports it
        if (this.selectedSkinTone && this.skinToneSupportingEmojis.has(baseEmoji)) {
            // For emojis with variation selector, insert skin tone before VS-16
            if (emoji.includes('\uFE0F')) {
                finalEmoji = baseEmoji + this.selectedSkinTone + '\uFE0F';
            } else {
                finalEmoji = baseEmoji + this.selectedSkinTone;
            }
        }
        
        if (this.messageInput) {
            const start = this.messageInput.selectionStart;
            const end = this.messageInput.selectionEnd;
            const text = this.messageInput.value;
            
            this.messageInput.value = text.substring(0, start) + finalEmoji + text.substring(end);
            this.messageInput.selectionStart = this.messageInput.selectionEnd = start + finalEmoji.length;
            this.messageInput.focus();
            
            // Trigger input event for any listeners
            this.messageInput.dispatchEvent(new Event('input', { bubbles: true }));
        }
        
        // Track recently used emojis
        this.addRecentEmoji(finalEmoji);
        
        // Close picker after selection
        this.closePicker();
    }
    
    togglePicker() {
        if (this.isOpen) {
            this.closePicker();
        } else {
            this.openPicker();
        }
    }
    
    openPicker() {
        this.pickerModal.classList.add('show');
        this.isOpen = true;
        this.emojiBtn.setAttribute('aria-expanded', 'true');
        this.searchInput.focus();
    }
    
    closePicker() {
        this.pickerModal.classList.remove('show');
        this.isOpen = false;
        this.emojiBtn.setAttribute('aria-expanded', 'false');
        
        // Set focus to the message input field when picker closes
        if (this.messageInput) {
            this.messageInput.focus();
        }
    }
}

// Initialize when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        const emojiPicker = new EmojiPickerHandler();
        emojiPicker.init();
    });
} else {
    const emojiPicker = new EmojiPickerHandler();
    emojiPicker.init();
}
