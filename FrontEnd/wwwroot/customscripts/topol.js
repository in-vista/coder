"use strict";
! function(t) {
    function e(t) {
        window.TopolPlugin = new function() {
            this.iframe = null;
            this.queue = [];
            
            var p = {},
                el = {},
                o = {},
                message = {},
                loaded = false;
            
            var self = this;
            
            function p(a, d) {

            }

            function messageListener(e) {
                message = e;
                if (e.data.type == 'callback') {
                    if ('function' == typeof o['callbacks'][e.data.action]) {
                        o['callbacks'][e.data.action].apply(window, e.data.data.args);
                    }
                }

            }

            function postMessage(action, data) {
                if (loaded) {
                    self.iframe.contentWindow.postMessage({
                        action,
                        data
                    }, '*');
                } else {
                    self.queue.push({ action, data });
                }
            }


            function r(callback) {
                el.appendChild(self.iframe)
                var parsedOptions = JSON.parse(JSON.stringify(o))
                window.addEventListener("message", messageListener);
                self.iframe.onload = function() {
                    loaded = true;
                    var len = self.queue.length;
                    for (var i = 0; i < len; i++) {
                        var mes = self.queue.shift();
                        postMessage(mes.action, mes.data);
                    }
                }
            }

            function createIframe() {
                self.iframe = document.createElement('iframe');
                self.iframe.width = '100%';
                self.iframe.height = '100%';
                self.iframe.frameBorder = '0';
                self.iframe.allow = 'clipboard-read; clipboard-write';
                self.iframe.setAttribute('allowfullscreen', '');
                self.iframe.setAttribute('webkitallowfullscreen', '');
                self.iframe.setAttribute('mozallowfullscreen', '');
                self.iframe.src = "https://v3.email-assets.topol.io/mjml4-editor-3/index.html";
            }

            this.init = function(options, callback) {
                o = options || {};
                (el = document.querySelectorAll(o.id)[0]) ? (createIframe(), r()) : console.error('Unable to find the element ' + o.id);
                postMessage('init', {
                    options: Object.assign({}, options, { callbacks: null })
                });
            }

            this.save = function() {
                postMessage('save', {});
            }

            this.load = function(json) {
                postMessage('load', { json: json });
            }

            this.togglePreview = function() {
                postMessage('togglePreview', {});
            }

            this.togglePreviewSize = function() {
                postMessage('togglePreviewSize');
            }

            this.chooseFile = function(url) {
                postMessage('chooseFile', { url: url });
            }

            this.undo = function() {
                postMessage('undo', {});
            }

            this.redo = function() {
                postMessage('redo', {});
            }

            this.destroy = function() {
                loaded = false
                self.iframe = null
                postMessage('destroy', {});
                while (el.firstChild) {
                    el.removeChild(el.firstChild);
                }
            }

            this.setSavedBlocks = function(savedBlocks) {
                postMessage('setSavedBlocks', { savedBlocks });
            }

            this.setPreviewHTML = function(html) {
                postMessage('setPreviewHTML', { html });
            }

            this.createNotification = function(notification) {
                postMessage('createNotification', { notification: notification });
            }

            this.setActiveMembers = function(activeMembers) {
                postMessage('setActiveMembers', { activeMembers: activeMembers});
            }

            this.changeEmailToMobile = function() {
                postMessage('changeEmailToMobile');
            }

            this.changeEmailToDesktop = function() {
                postMessage('changeEmailToDesktop');
            }

            this.toggleBlocksAndStructuresVisibility = function() {
                postMessage('toggleBlocksAndStructuresVisibility');
            }

            this.updateCustomBlockContent = function(content) {
                postMessage('updateCustomBlockContent', { content });
            }

            this.refreshComments = function(key) {
                postMessage('refreshComments', { key });
            }

            this.refreshSyncedRows = function() {
                postMessage('refreshSyncedRows');
            }

            this.openPremadeTemplatesSelection = function() {
                postMessage('openPremadeTemplatesSelection')
            }

            this.updateApiAuthorizationHeader = function(newHeader) {
                postMessage('updateApiAuthorizationHeader', { newHeader });
            }

            this.setTemplateName = function(name) {
                postMessage('setTemplateName', { name });
            }

            this.updateOptions = function(options) {
                postMessage('updateOptions', { options });
            }
        }
    }

    if (!window.TopolPlugin) {
        e(t);
    }
}(0);