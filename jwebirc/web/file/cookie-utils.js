(function (global) {
    'use strict';

    function getCookie(name) {
        const nameEQ = name + '=';
        const ca = document.cookie.split(';');
        for (let c = 0; c < ca.length; c++) {
            let s = ca[c];
            while (s.charAt(0) === ' ') s = s.substring(1, s.length);
            if (s.indexOf(nameEQ) === 0) {
                return decodeURIComponent(s.substring(nameEQ.length, s.length));
            }
        }
        return null;
    }

    function setCookie(name, value, days = 365) {
        const d = new Date();
        d.setTime(d.getTime() + (days * 24 * 60 * 60 * 1000));
        const expires = 'expires=' + d.toUTCString();
        document.cookie = name + '=' + encodeURIComponent(value) + ';' + expires + ';path=/;SameSite=Lax';
    }

    global.jwebircGetCookie = getCookie;
    global.jwebircSetCookie = setCookie;
})(typeof window !== 'undefined' ? window : this);
