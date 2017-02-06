// It seems I cannot control the order these files are loaded.
window.SA = window.SA || {};

// Utilities to manage cookies

(function () {
  'use strict';

  SA.setCookie = function (cName, value, exdays) {
    var exdate = new Date();
    exdate.setDate(exdate.getDate() + exdays);
    var cValue = escape(value) + ((exdays === null) ? '' : '; expires=' + exdate.toUTCString());
    document.cookie = cName + '=' + cValue;
  };

  SA.getCookie = function (cName) {
    var i, x, y;
    var ARRcookies = document.cookie.split(';');
    for (i = 0; i < ARRcookies.length; i++) {
      x = ARRcookies[i].substr(0, ARRcookies[i].indexOf('='));
      y = ARRcookies[i].substr(ARRcookies[i].indexOf('=') + 1);
      x = x.replace(/^\s+|\s+$/g, '');
      if (x === cName) {
        return unescape(y);
      }
    }
  };
})();
