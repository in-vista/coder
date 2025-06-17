/*
Copyright © 2025 Annpoint, s.r.o.

Licensed under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License.
You may obtain a copy of the License at

http://www.apache.org/licenses/LICENSE-2.0

Unless required by applicable law or agreed to in writing, software
distributed under the License is distributed on an "AS IS" BASIS,
WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
See the License for the specific language governing permissions and
limitations under the License.

-------------------------------------------------------------------------

NOTE: Requires the following acknowledgement (see also NOTICE):
This software includes DayPilot (https://www.daypilot.org).
*/

if (typeof DayPilot === 'undefined') {
	var DayPilot = {};
}

if (typeof DayPilot.Global === 'undefined') {
    DayPilot.Global = {};
}

(function(DayPilot) {
    'use strict';

    if (typeof DayPilot.DatePicker !== 'undefined') {
        return;
    }

    DayPilot.DatePicker = function(properties) {
        this.v = '2025.2.678-lite';
        var navigatorId = "navigator_" + new Date().getTime();
        var This = this;

        this.onShow = null;
        this.onTimeRangeSelect = null;
        this.onTimeRangeSelected = null;
        // this.dateFormat = null;

        this.prepare = function() {
            this.locale = "en-us";
            this.target = null;
            this.targetAlignment = "left";
            this.resetTarget = true;
            this.pattern = this._resolved.locale().datePattern;    // "M/d/yyyy"
            this.theme = "navigator_default";
            this.patterns = [];
            this.zIndex = null;

            // load settings
            if (properties) {
                for (var name in properties) {
                    this[name] = properties[name];
                }
            }

        };

        this.init = function() {

            this.date = new DayPilot.Date(this.date);

            var value = this._readFromTarget();

            if (this.resetTarget && !value) {
                this._writeToTarget(this.date);
            }
            else if (!this.resetTarget && value) {
                This.date = value;
            }

            var target = this._element();
            if (target) {
                target.addEventListener("input", function() {
                    This.date = This._readFromTarget();
                    if (This.date) {
                        This.navigator.select(This.date, {dontNotify: true});
                    }
                });
            }

            return this;
        };

        this.close = function() {

            document.removeEventListener("mousedown", This.close);
            document.removeEventListener("wheel", This.close);
            window.removeEventListener("resize", This.close);

            if (!This._visible) {
                return;
            }

            This._visible = false;

            if (This.navigator) {
                This.navigator.dispose();
            }
            This.div.innerHTML = '';
            if (This.div && This.div.parentNode === document.body) {
                document.body.removeChild(This.div);
            }
        };

        this._setDate = function(date) {
            this.date = new DayPilot.Date(date);
            this._writeToTarget(this.date);
        };

        this.select = function(date) {

            var args = {};
            args.date = new DayPilot.Date(date);
            args.preventDefault = function() {
                this.preventDefault.value = true;
            };

            if (typeof This.onTimeRangeSelect ===  'function') {
                This.onTimeRangeSelect(args);
                if (args.preventDefault.value) {
                    return;
                }
            }

            this._setDate(date);

            if (typeof This.onTimeRangeSelected === 'function') {
                This.onTimeRangeSelected(args);
            }

        };

        this._readFromTarget = function() {
            // recognized targets: input (value), other DOM elements (innerHTML)
            var element = this._element();

            if (!element) {
                return this.date;
            }

            var value = null;
            if (element.tagName === "INPUT") {
                value = element.value;
            }
            else {
                value = element.innerText;
            }

            if (!value) {
                return null;
            }

            var date = DayPilot.Date.parse(value, This.pattern);
            for (var i = 0; i < This.patterns.length; i++) {
                if (date) {
                    return date;
                }
                date = DayPilot.Date.parse(value, This.patterns[i]);
            }

            return date;
        };

        this._writeToTarget = function(date) {
            var element = this._element();

            if (!element) {
                return;
            }

            var value = date.toString(This.pattern, This.locale);
            if (element.tagName === "INPUT") {
                element.value = value;
            }
            else {
                element.innerHTML = value;
            }

        };

        this._resolved = {};
        this._resolved.locale = function() {
            return DayPilot.Locale.find(This.locale);
        };

/*        this._resolved.dateFormat = function() {
            if (typeof This.dateFormat === "string") {
                return This.dateFormat;
            }
            return This._resolved.locale().datePattern;
        }*/

        this._element = function() {
            var id = this.target;
            // accept DOM element or id (string)
            var element = (id && id.nodeType && id.nodeType === 1 ) ? id : document.getElementById(id);
            return element;
        };

        Object.defineProperty(this, "visible", {
            get: function() { return This._visible; }
        });

        this.show = function() {

            if (this._visible) {
                return;
            }

            document.addEventListener("mousedown", This.close);
            document.addEventListener("wheel", This.close);
            window.addEventListener("resize", This.close);

            var element = this._element();

            var navigator = new DayPilot.Navigator(navigatorId);
            navigator.api = 2;
            navigator.cssOnly = true;
            navigator.theme = This.theme;
            navigator.weekStarts = "Auto";
            navigator.locale = This.locale;
            navigator.showToday = true;
            navigator.onTodayClick = function(args) {
                navigator.onTimeRangeSelected({start: DayPilot.Date.today()});
                args.preventDefault();
            };
            navigator.onTimeRangeSelected = function(args) {
                This.date = args.start;

                var start = args.start.addTime(navigator._pickerTimePart);
                var value = start.toString(This.pattern, This.locale);

                var args = {};
                args.start = start;
                args.date = start;
                args.preventDefault = function() {
                    this.preventDefault.value = true;
                };

                if (typeof This.onTimeRangeSelect ===  'function') {
                    This.onTimeRangeSelect(args);
                    if (args.preventDefault.value) {
                        return;
                    }
                }

                This._writeToTarget(value);
                This.close();

                if (typeof This.onTimeRangeSelected === 'function') {
                    This.onTimeRangeSelected(args);
                }
            };

            this.navigator = navigator;

            var position = {
                x: 0,
                y: 0,
                w: 0,
                h: 0
            };
            if (element) {
                position = DayPilot.abs(element);
            }

            var height = position.h;

            var align = This.targetAlignment;

            var div = document.createElement("div");
            div.style.position = "absolute";

            if (align === "left") {
                div.style.left = position.x + "px";
            }


            div.style.top = (position.y + height) + "px";
            if (This.zIndex) {
                div.style.zIndex = This.zIndex;
            }

            var nav = document.createElement("div");
            nav.id = navigatorId;
            div.appendChild(nav);

            div.addEventListener("mousedown", function(ev) {
                var ev = ev || window.event;
                ev.cancelBubble = true;
                ev.stopPropagation && ev.stopPropagation();
            });

            document.body.appendChild(div);

            this.div = div;

            var selected = This._readFromTarget() || This.date;

            navigator.startDate = selected;
            navigator._pickerTimePart = selected.getTimePart();
            // navigator.selectionStart = selected.getDatePart();
            navigator.selectionDay = selected.getDatePart();
            navigator.init();

            if (align === "right") {
                var left = (position.x + position.w - navigator.nav.top.offsetWidth);
                div.style.left = left + "px";
            }

            this._visible = true;
            if (this.onShow) {
                this.onShow();
            }
        };

        this.prepare(); // prepare only called once, in the constructor
        this.init();
    };


})(DayPilot);
