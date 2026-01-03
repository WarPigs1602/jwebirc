/**
 * jwebirc 2.0 - Browser Notification Manager
 * Handles desktop notifications for messages, highlights, and knocks
 * @author Andreas Pschorn
 * @license MIT
 */

// Ensure NotificationManager is available globally
window.NotificationManager = class NotificationManager {
    constructor(chatManager) {
        this.chatManager = chatManager;
        this.enabled = false;
        this.permission = 'default';
        this.soundEnabled = true;
        
        // Check if notifications are supported
        this.supported = 'Notification' in window;
        
        if (this.supported) {
            this.permission = Notification.permission;
        }
        
        // Audio notification sound (beep)
        this.notificationSound = null;
        this.initSound();
        
        // Track window focus to avoid notifications when user is active
        this.windowFocused = true;
        this.setupFocusTracking();
        
        // Store active notifications to close them when user returns
        this.activeNotifications = new Map(); // Map<id, Notification>
    }
    
    /**
     * Initialize notification sound
     */
    initSound() {
        // Create a simple beep using Web Audio API
        try {
            this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
        } catch (e) {
            console.warn('[Notifications] Web Audio API not supported');
        }
    }
    
    /**
     * Play notification sound
     */
    playSound() {
        if (!this.soundEnabled || !this.audioContext) return;
        
        try {
            const oscillator = this.audioContext.createOscillator();
            const gainNode = this.audioContext.createGain();
            
            oscillator.connect(gainNode);
            gainNode.connect(this.audioContext.destination);
            
            // Create a pleasant notification beep
            oscillator.frequency.value = 800;
            oscillator.type = 'sine';
            
            gainNode.gain.setValueAtTime(0.3, this.audioContext.currentTime);
            gainNode.gain.exponentialRampToValueAtTime(0.01, this.audioContext.currentTime + 0.3);
            
            oscillator.start(this.audioContext.currentTime);
            oscillator.stop(this.audioContext.currentTime + 0.3);
        } catch (e) {
            console.warn('[Notifications] Error playing sound:', e);
        }
    }
    
    /**
     * Track window focus state
     */
    setupFocusTracking() {
        window.addEventListener('focus', () => {
            this.windowFocused = true;
            this.closeAllNotifications();
        });
        
        window.addEventListener('blur', () => {
            this.windowFocused = false;
        });
        
        // Also track visibility changes
        document.addEventListener('visibilitychange', () => {
            if (!document.hidden) {
                this.windowFocused = true;
                this.closeAllNotifications();
            } else {
                this.windowFocused = false;
            }
        });
    }
    
    /**
     * Close all active notifications
     */
    closeAllNotifications() {
        for (const [id, notification] of this.activeNotifications) {
            notification.close();
        }
        this.activeNotifications.clear();
    }
    
    /**
     * Check if notifications are supported
     */
    isSupported() {
        return this.supported;
    }
    
    /**
     * Get current permission status
     */
    getPermission() {
        return this.permission;
    }
    
    /**
     * Request notification permission from user
     */
    async requestPermission() {
        if (!this.supported) {
            console.warn('[Notifications] Browser notifications not supported');
            return false;
        }
        
        if (this.permission === 'granted') {
            this.enabled = true;
            return true;
        }
        
        try {
            const permission = await Notification.requestPermission();
            this.permission = permission;
            this.enabled = permission === 'granted';
            return this.enabled;
        } catch (error) {
            console.error('[Notifications] Error requesting permission:', error);
            return false;
        }
    }
    
    /**
     * Enable notifications
     */
    async enable() {
        if (!this.supported) {
            return false;
        }
        
        if (this.permission !== 'granted') {
            return await this.requestPermission();
        }
        
        this.enabled = true;
        return true;
    }
    
    /**
     * Disable notifications
     */
    disable() {
        this.enabled = false;
        this.closeAllNotifications();
    }
    
    /**
     * Toggle notification sound
     */
    toggleSound(enabled) {
        this.soundEnabled = enabled;
    }
    
    /**
     * Check if should show notification (only when window is not focused)
     */
    shouldShowNotification() {
        return this.enabled && this.supported && this.permission === 'granted' && !this.windowFocused;
    }
    
    /**
     * Show a notification
     * @param {string} title - Notification title
     * @param {object} options - Notification options
     * @returns {Notification|null} The notification object or null
     */
    showNotification(title, options = {}) {
        if (!this.shouldShowNotification()) {
            return null;
        }
        
        const defaultOptions = {
            icon: '/file/bootstrap/favicon.ico',
            badge: '/file/bootstrap/favicon.ico',
            requireInteraction: false,
            ...options
        };
        
        try {
            const notification = new Notification(title, defaultOptions);
            
            // Store notification
            const id = Date.now() + Math.random();
            this.activeNotifications.set(id, notification);
            
            // Play sound if enabled
            if (this.soundEnabled) {
                this.playSound();
            }
            
            // Auto-close after 5 seconds if not requiring interaction
            if (!defaultOptions.requireInteraction) {
                setTimeout(() => {
                    notification.close();
                    this.activeNotifications.delete(id);
                }, 5000);
            }
            
            // Handle click - focus window and switch to relevant channel/query
            notification.onclick = () => {
                window.focus();
                notification.close();
                this.activeNotifications.delete(id);
                
                // Call callback if provided
                if (options.onClick) {
                    options.onClick();
                }
            };
            
            // Clean up when notification closes
            notification.onclose = () => {
                this.activeNotifications.delete(id);
            };
            
            return notification;
            
        } catch (error) {
            console.error('[Notifications] Error showing notification:', error);
            return null;
        }
    }
    
    /**
     * Show notification for private message
     * @param {string} nick - Sender nickname
     * @param {string} message - Message text
     */
    notifyPrivateMessage(nick, message) {
        // Truncate long messages
        const truncatedMessage = message.length > 100 
            ? message.substring(0, 100) + '...' 
            : message;
        
        this.showNotification(`Private Message from ${nick}`, {
            body: truncatedMessage,
            tag: `pm-${nick}`,
            onClick: () => {
                // Switch to private message window
                if (this.chatManager) {
                    this.chatManager.switchTab(nick);
                }
            }
        });
    }
    
    /**
     * Show notification for highlight/mention
     * @param {string} channel - Channel name
     * @param {string} nick - Sender nickname
     * @param {string} message - Message text
     */
    notifyHighlight(channel, nick, message) {
        // Truncate long messages
        const truncatedMessage = message.length > 100 
            ? message.substring(0, 100) + '...' 
            : message;
        
        this.showNotification(`${nick} mentioned you in ${channel}`, {
            body: truncatedMessage,
            tag: `highlight-${channel}`,
            onClick: () => {
                // Switch to channel window
                if (this.chatManager) {
                    this.chatManager.switchTab(channel);
                }
            }
        });
    }
    
    /**
     * Show notification for knock
     * @param {string} channel - Channel name
     * @param {string} nick - Knocker nickname
     * @param {string} message - Optional knock message
     */
    notifyKnock(channel, nick, message = '') {
        const body = message 
            ? `${nick} knocked on ${channel}: ${message}`
            : `${nick} knocked on ${channel}`;
        
        this.showNotification('Knock Notification', {
            body: body,
            tag: `knock-${channel}`,
            requireInteraction: true, // Keep notification visible until clicked
            onClick: () => {
                // Switch to channel window
                if (this.chatManager) {
                    this.chatManager.switchTab(channel);
                }
            }
        });
    }
    
    /**
     * Show notification for channel message (when user is mentioned or channel is special)
     * @param {string} channel - Channel name
     * @param {string} nick - Sender nickname
     * @param {string} message - Message text
     */
    notifyChannelMessage(channel, nick, message) {
        // Truncate long messages
        const truncatedMessage = message.length > 100 
            ? message.substring(0, 100) + '...' 
            : message;
        
        this.showNotification(`${nick} in ${channel}`, {
            body: truncatedMessage,
            tag: `msg-${channel}`,
            onClick: () => {
                // Switch to channel window
                if (this.chatManager) {
                    this.chatManager.switchTab(channel);
                }
            }
        });
    }
    
    /**
     * Show notification for invite
     * @param {string} nick - Inviter nickname
     * @param {string} channel - Channel name
     */
    notifyInvite(nick, channel) {
        this.showNotification('Channel Invitation', {
            body: `${nick} invited you to ${channel}`,
            tag: `invite-${channel}`,
            requireInteraction: true,
            onClick: () => {
                // Could automatically join the channel or just focus window
                window.focus();
            }
        });
    }
}

// Also export for CommonJS if needed
if (typeof module !== 'undefined' && module.exports) {
    module.exports = window.NotificationManager;
}
