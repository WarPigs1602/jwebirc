(function() {
    'use strict';

    function getTargetContainer(page) {
        if (page === 'login') {
            return document.querySelector('.login-container');
        }
        if (page === 'chat') {
            return document.querySelector('.chat-container');
        }
        return null;
    }

    window.jwebircRegisterPlugin({
        id: 'welcome-banner',
        pages: ['chat', 'login'],
        initialize: function(context) {
            const targetContainer = getTargetContainer(context.page);
            if (!targetContainer || document.getElementById('pluginWelcomeBanner')) {
                return;
            }

            const banner = document.createElement('div');
            banner.id = 'pluginWelcomeBanner';
            banner.className = 'plugin-welcome-banner';
            banner.textContent = context.lang === 'de'
                ? 'Plugin-System aktiv: welcome-banner wurde auf ' + context.page + ' geladen.'
                : 'Plugin system active: welcome-banner loaded on ' + context.page + '.';

            targetContainer.insertAdjacentElement('afterbegin', banner);
            context.emit('jwebirc:plugin:welcome-banner:shown', {
                page: context.page
            });
        }
    });
})();