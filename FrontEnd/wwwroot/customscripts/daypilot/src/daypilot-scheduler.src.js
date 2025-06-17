/* Copyright 2005 - 2025 Annpoint, s.r.o.
   Use of this software is subject to license terms.
   https://www.daypilot.org/
*/

if (typeof DayPilot === 'undefined') {
    var DayPilot = {};
}

if (typeof DayPilot.Global === 'undefined') {
    DayPilot.Global = {};
}

(function(DayPilot) {
    'use strict';

    if (typeof DayPilot.Scheduler !== 'undefined') {
        return;
    }

    var ios = navigator.userAgent.indexOf("iPad") > -1 || navigator.userAgent.indexOf("iPhone") > -1;

    var DayPilotScheduler = {};

    var doNothing = function() { };

    var debug = false;

    var log = function(msg) {
        if (!debug) {
            return;
        }
        window.console && window.console.log.apply(window.console, arguments);
    };

    var qlog = function(msg) {
        if (typeof QUnit === "undefined") {
            return;
        }
        log(msg);
    };

    var console = {
        "log": log
    };

    var body = function() { return document.body;};
    var createDiv = function() { return document.createElement("div"); };

    DayPilot.Scheduler = function(id, options) {
        this.v = '2025.2.678-lite';

        var calendar = this;
        this.isScheduler = true;
        this.id = id; // referenced

        // default values
        this.businessBeginsHour = 9;
        this.businessEndsHour = 18;
        this.businessWeekends = false;
        this.cellDuration = 60;
        this.cellGroupBy = 'Day';
        this.cellSweeping = true;
        this.cellSweepingCacheSize = 1000;
        this.cellWidth = 40;
        this.cellsMarkBusiness = true;
        this.cssClassPrefix = "scheduler_default";
        this.days = 1;
        this.durationBarHeight = 3;
        this.durationBarVisible = true;
        this.dynamicEventRendering = 'Progressive';
        this.dynamicEventRenderingMargin = 50;
        this.dynamicEventRenderingMarginX = null;
        this.dynamicEventRenderingMarginY = null;
        this.dynamicEventRenderingCacheSweeping = false;
        this.dynamicEventRenderingCacheSize = 200;
        this.eventEndSpec = "DateTime";
        this.eventHeight = 35;
        this.eventMinWidth = 1;
        this.eventResizeMargin = 5;
        this.eventTapAndHoldHandling = "Move";
        this.eventTextWrappingEnabled = false;
        this.eventsLoadMethod = "GET";
        this.floatingEvents = ios ? false :true;
        this.floatingTimeHeaders = true;
        this.headerHeight = 30;
        this.heightSpec = 'Max';
        this.height = 600;
        this.locale = "en-us";
        this.progressiveRowRendering = true;
        this.progressiveRowRenderingPreload = 25;
        this.rowHeaderWidth = 80;
        this.rowsLoadMethod = "GET";
        this.scale = "CellDuration";
        this.scrollDelayEvents = 200;
        this.scrollDelayCells = ios ? 100 : 0;
        this.scrollDelayFloats = 0;
        this.scrollDelayRows = 0;
        this.showToolTip = true;
        this.snapToGrid = true;
        this.startDate = DayPilot.Date.today();
        this.tapAndHoldTimeout = 300;
        this.timeHeaders = [ {"groupBy": "Default"}, {"groupBy": "Cell"} ];
        this.timeHeaderTextWrappingEnabled = false;
        this.timeFormat = "Auto";
        this.useEventBoxes = 'Always';
        this.visible = true;
        this.weekStarts = 'Auto'; // 0 = Sunday, 1 = Monday, ... 'Auto' = use .locale
        this.width = null;
        this.xssProtection = "Enabled"; // "Disabled"

        this.eventClickHandling = 'Enabled';
        this.eventDeleteHandling = "Disabled";
        this.eventMoveHandling = 'Update';
        this.eventResizeHandling = 'Update';
        this.eventRightClickHandling = 'ContextMenu';
        this.timeHeaderClickHandling = "Enabled";
        this.timeHeaderRightClickHandling = "Enabled";
        this.timeRangeClickHandling = "Enabled";
        this.timeRangeSelectedHandling = 'Enabled';

        this.onEventClick = null;
        this.onEventClicked = null;
        this.onEventMove = null;
        this.onEventMoved = null;
        this.onEventResize = null;
        this.onEventResized = null;
        this.onRowClick = null;
        this.onRowClicked = null;
        this.onTimeHeaderClick = null;
        this.onTimeHeaderClicked = null;
        this.onTimeHeaderRightClick = null;
        this.onTimeHeaderRightClicked = null;
        this.onTimeRangeClick = null;
        this.onTimeRangeClicked = null;
        this.onTimeRangeSelect = null;
        this.onTimeRangeSelected = null;

        this.onBeforeEventRender = null;
        this.onBeforeRowHeaderRender = null;

        this.onAfterUpdate = null;

        // internal
        this._disposed = false;
        this._gridHeight = -1;
        this._previousVisible = true;

        this.rowlist = [];

        this.events = {};
        this.cells = {};

        // store the element references
        this.elements = {};
        this.elements.events = [];
        this.elements.bars = [];
        this.elements.text = [];
        this.elements.cells = [];
        this.elements.linesVertical = [];  // required for height updating
        this.elements.range = [];
        this.elements.timeHeader = [];

        this._cache = {};
        this._cache.cells = [];
        this._cache.linesVertical = {};
        this._cache.linesHorizontal = {};
        this._cache.timeHeaderGroups = [];
        this._cache.timeHeader = {};
        this._cache.events = []; // processed using client-side beforeEventRender

        this.nav = {};

        this.scrollTo = function(date) {
            calendar._scrollTo(date);
        };

        this._scrollTo = function(date) {
            if (!date) {
                return;
            }

            if (!calendar._initialized) {
                calendar._scrollToAfterInit = date;
                return;
            }

            var pixels;
            if (date instanceof DayPilot.Date) {
                pixels = this.getPixels(date).left;
            }
            else if (typeof date === "string") {
                pixels = this.getPixels(new DayPilot.Date(date)).left;
            }
            else if (typeof date === "number") {
                pixels = date;
            }
            else {
                throw new DayPilot.Exception("Invalid scrollTo() parameter. Accepted parameters: string (ISO date), number (pixels), DayPilot.Date object");
            }

            var max = calendar._maind.clientWidth;
            var width = calendar.nav.scroll.clientWidth;

            if (pixels < 0) {
                pixels = 0;
            }

            if (pixels > max - width) {
                pixels = max - width;
            }

            calendar._setScrollX(pixels);
        };


        this.scrollToResource = function(param) {
            DayPilot.complete(function() {
                var row;
                if (typeof param === "string" || typeof param === "number") {
                    row = calendar._findRowByResourceId(param);
                }
                else if (param instanceof DayPilot.Row) {
                    row = calendar._findRowByResourceId(param.id);
                }
                else {
                    throw new DayPilot.Exception("Invalid scrollToResource() argument: id or DayPilot.Row expected");
                }

                if (!row) {
                    return;
                }
                setTimeout(function() {
                    var scrollY = row.top;
                    calendar.nav.scroll.scrollTop = scrollY;
                }, 100);

            });
        };

        this._findHeadersInViewPort = function() {

            if (!this.floatingTimeHeaders) {
                return;
            }

            if (!this.timeHeader) {
                return;
            }

            var area = calendar._getDrawArea();
            if (!area) {
                return;
            }

            calendar._deleteHeaderSections();

            var start = area.pixels.left;
            var end = area.pixels.right + area.sw;

            var cells = [];

            for (var y = 0; y < this.timeHeader.length; y++) {
                for (var x = 0; x < this.timeHeader[y].length; x++) {
                    var h = this.timeHeader[y][x];
                    var left = h.left;
                    var right = h.left + h.width;

                    var cell = null;

                    if (left < start && start < right) {
                        cell = {};
                        cell.x = x;
                        cell.y = y;
                        cell.marginLeft = start - left;
                        cell.marginRight = 0;
                        cell.div = calendar._cache.timeHeader[x + "_" + y];
                        cells.push(cell);
                    }
                    if (left < end && end < right) {
                        if (!cell) {
                            cell = {};
                            cell.x = x;
                            cell.y = y;
                            cell.marginLeft = 0;
                            cell.div = calendar._cache.timeHeader[x + "_" + y];
                            cells.push(cell);
                        }
                        cell.marginRight = right - end;

                        break; // end of this line
                    }
                }
            }

            for (var i = 0; i < cells.length; i++) {
                var cell = cells[i];
                calendar._createHeaderSection(cell.div, cell.marginLeft, cell.marginRight);
            }

        };

        this._updateFloats = function() {
            calendar._findHeadersInViewPort();
            calendar._findEventsInViewPort();
        };

        this._viewport = {};

        var viewport = calendar._viewport;

        viewport._eventsInRectangle = function(x, y, width, height) {
            var startX = x;
            var endX = x + width;

            var startY = y;
            var endY = y + height;

            return calendar.elements.events.filter(function(e) {
                var data = e.event;
                var left = data.part.left;
                var right = data.part.left + data.part.width;

                var row = calendar.rowlist[data.part.dayIndex];
                var top = row.top + data.part.top;
                var bottom = top + calendar.eventHeight;

                if (DayPilot.Util.overlaps(left, right, startX, endX) && DayPilot.Util.overlaps(top, bottom, startY, endY)) {
                    return true;
                }
            });
        };

        viewport._events = function() {
            var list = [];

            var area = calendar._getDrawArea();
            if (!area) {
                return list;
            }

            var start = area.pixels.left;

            for(var i = 0; i < calendar.elements.events.length; i++) {
                var e = calendar.elements.events[i];
                var data = e.event;
                var left = data.part.left;
                var right = data.part.left + data.part.width;

                if (left < start && start < right) {
                    list.push(e);
                }
            }
            list.area = area;
            return list;
        };

        this._findEventsInViewPort = function() {

            if (!this.floatingEvents) {
                return;
            }

            var events = viewport._events();

            calendar._deleteEventSections();

            events.forEach(function(item) {
                var e = item.event;
                var left = events.area.pixels.left;
                var start = e.part.left;
                var marginLeft = left - start;
                calendar._createEventSection(item, marginLeft, 0);
            });

        };

        this.elements.sections = [];
        this.elements.hsections = [];

        this._createHeaderSection = function(div, marginLeft, marginRight) {
            var section = createDiv();
            section.className = calendar._prefixCssClass("_timeheader_float");
            section.style.position = "absolute";
            section.style.left = marginLeft + "px";
            section.style.right = marginRight + "px";
            section.style.top = "0px";
            section.style.bottom = "0px";
            section.style.overflow = "hidden";

            var inner = createDiv();
            inner.className = calendar._prefixCssClass("_timeheader_float_inner");

            var props = div.cell.th;
            inner.innerHTML = calendar._xssTextHtml(props.text, props.innerHTML);

            if (props.fontColor) {
                inner.style.color = props.fontColor;
            }
            section.appendChild(inner);

            div.section = section;

            div.insertBefore(section, div.firstChild.nextSibling); // after inner

            div.firstChild.innerHTML = ''; // hide the content of inner temporarily

            this.elements.hsections.push(div);
        };

        this._deleteHeaderSections = function() {
            for (var i = 0; i < this.elements.hsections.length; i++) {
                var e = this.elements.hsections[i];

                // restore HTML in inner
                var data = e.cell;
                if (data && e.firstChild) { // might be deleted already
                    e.firstChild.innerHTML = calendar._xssTextHtml(data.th.text, data.th.innerHTML);
                }

                DayPilot.de(e.section);
                e.section = null;
            }
            this.elements.hsections = [];
        };

        this._createEventSection = function(div, marginLeft, marginRight) {

            var section = createDiv();
            section.className = calendar._prefixCssClass("_event_float");
            section.style.position = "absolute";
            section.style.left = marginLeft + "px";
            section.style.right = marginRight + "px";
            section.style.top = "0px";
            section.style.bottom = "0px";
            section.style.overflow = "hidden";

            var inner = createDiv();
            inner.className = calendar._prefixCssClass("_event_float_inner");
            inner.innerHTML = div.event.client.html();
            section.appendChild(inner);

            div.section = section;

            div.insertBefore(section, div.firstChild.nextSibling); // after inner
            div.firstChild.innerHTML = ""; // hide the content of inner temporarily

            var e = div.event;
            var cache = e.cache || e.data;

            if (cache.fontColor) {
                inner.style.color = cache.fontColor;
            }

            this.elements.sections.push(div);
        };

        this._deleteEventSections = function() {
            for (var i = 0; i < this.elements.sections.length; i++) {
                var e = this.elements.sections[i];

                // restore HTML in inner
                var data = e.event;
                if (data) { // might be deleted already
                    e.firstChild.innerHTML = data.client.html();
                }

                DayPilot.de(e.section);

                e.section = null;
            }
            this.elements.sections = [];
        };

        this.setScrollX = function(scrollX) {
            if (!calendar._angular2.enabled) {
                calendar._setScrollX(scrollX);
            }
            else {
                calendar._angular2.scrollXRequested = scrollX;
                setTimeout(function() {
                    var scrollX = calendar._angular2.scrollXRequested;
                    if (typeof scrollX === "number") {
                        calendar._setScrollX(scrollX);
                    }
                }, 0);
            }
        };

        this._setScrollX = function(scrollX) {
            var scroll = calendar.nav.scroll;
            var maxWidth = calendar._getGridWidth();

            if (scroll.clientWidth + scrollX > maxWidth) {
                scrollX = maxWidth - scroll.clientWidth;
            }

            calendar.divTimeScroll.scrollLeft = scrollX;
            scroll.scrollLeft = scrollX;
        };

        this.setScrollY = function(scrollY) {
            if (!calendar._angular2.enabled) {
                calendar._setScrollY(scrollY);
            }
            else {
                calendar._angular2.scrollYRequested = scrollY;
                setTimeout(function() {
                    var scrollY = calendar._angular2.scrollYRequested;
                    if (typeof scrollY === "number") {
                        calendar._setScrollY(scrollY);
                    }
                }, 0);
            }
        };

        this._setScrollY = function(scrollY) {
            var scroll = calendar.nav.scroll;
            var maxHeight = calendar._gridHeight;

            if (scroll.clientHeight + scrollY > maxHeight) {
                scrollY = maxHeight - scroll.clientHeight;
            }

            calendar.divResScroll.scrollTop = scrollY;
            scroll.scrollTop = scrollY;
        };

        this.setScroll = function(scrollX, scrollY) {
            calendar.setScrollX(scrollX);
            calendar.setScrollY(scrollY);
        };

        // updates the height after a resize
        this._updateHeight = function() {

            // only if the control is not disposed already
            if (!this.nav.scroll) {
                return;
            }

            (function fromDrawCells() {
                var width = calendar._getGridWidth();

                calendar._maind.style.height = calendar._gridHeight + "px";
                calendar._maind.style.width = width + "px";

                if (width > calendar.nav.scroll.clientWidth) {
                    calendar.nav.scroll.style.overflowX = "auto";
                }
                else {
                    calendar.nav.scroll.style.overflowX = "hidden";
                }
            })();


            var dividerHeight = 1;

            // getting ready for the scrollbar
            // keep it here, firefox requires it to get the scrollbar height
            this.nav.scroll.style.height = '30px';

            var height = this._getScrollableHeight();

            var total = height + this._getTotalHeaderHeight() + dividerHeight;
            if (height >= 0) {
                this.nav.scroll.style.height = (height) + 'px';
                this._scrollRes.style.height = (height) + 'px';
            }
            if (this.nav.divider) {
                if (!total || isNaN(total) || total < 0) {
                    total = 0;
                }
                this.nav.divider.style.height = (total) + "px";
            }

            this.nav.top.style.height = (total) + "px";

            if (calendar.nav.resScrollSpace) {
                var spaceHeight = 30;
                if (calendar.heightSpec === "Auto") {
                    spaceHeight = DayPilot.sh(calendar.nav.scroll);
                }
                calendar.nav.resScrollSpace.style.height = spaceHeight + "px";
            }

            for (var i = 0; i < this.elements.linesVertical.length; i++) {
                this.elements.linesVertical[i].style.height = this._gridHeight + 'px';
            }
        };

        this._prepareHeaderGroups = function() {
            this.startDate = new DayPilot.Date(this.startDate).getDatePart();
            this.timeHeader = [];

            var timeHeaders = this.timeHeaders;
            if (!timeHeaders) {
                timeHeaders = [
                    {"groupBy": this.cellGroupBy},
                    {"groupBy": "Cell"}
                ];
            }

            var endDate = calendar.startDate.addDays(calendar.days);

            for (var i = 0; i < timeHeaders.length; i++) {

                var groupBy = timeHeaders[i].groupBy;
                var format = timeHeaders[i].format;

                if (groupBy === "Default") {
                    groupBy = this.cellGroupBy;
                }

                var line = [];

                //var cell = {};
                var start = calendar.startDate;

                while (start.ticks < endDate.ticks) {

                    var h = {};
                    h.start = start;
                    h.end = this._addGroupSize(h.start, groupBy);

                    if (h.start.ticks === h.end.ticks) {
                        break;
                    }
                    h.left = this.getPixels(h.start).left;
                    var right = this.getPixels(h.end).left;
                    var width = right - h.left;
                    h.width = width;

                    if (typeof format === "string") {
                        h.text = h.start.toString(format, resolved._locale());
                    }
                    else {
                        h.text = this._getGroupName(h, groupBy);
                    }

                    if (width > 0) {
                        line.push(h);
                    }
                    start = h.end;
                }
                this.timeHeader.push(line);
            }
        };


        // internal
        this.getPixels = function (date) {

            var end = calendar.startDate.addDays(calendar.days);

            date = date.ticks > end.ticks ? end.addTime(-1) : date;

            var ticks= date.ticks - this.startDate.ticks;
            var pixels = calendar._ticksToPixels(ticks);
            var w = calendar.cellWidth;
            var i= Math.floor(pixels / w);
            var boxLeft  = i * w;
            var boxRight = boxLeft + w;

            return {
                left:     pixels,
                boxLeft:  boxLeft,
                boxRight: boxRight,
                i:        i
            };
        };

        // left - pixel offset from start
        // precise - true: calculates exact date from pixels, false: the it's the cell start
        // isEnd - returns the end of the previous cell
        //
        // isEnd and precise can't be combined
        this.getDate = function(left, precise, isEnd) {
            //var x = Math.floor(left / this.cellWidth);
            var position = this._getCellFromPixels(left, isEnd);

            if (!position) {
                return null;
            }

            var x = position.x;

            var itc = calendar._getCell(x);

            if (!itc) {
                return null;
            }

            var start = (isEnd && !precise) ? itc.end : itc.start;

            if (!precise) {
                return start;
            }
            else {
                return start.addTime(this._pixelsToTicks(position.offset));
            }

        };

        this._getCellFromPixels = function(pixels, isEnd) {
            if (isEnd) {
                pixels -= 1;
            }
            var x = Math.floor(pixels / calendar.cellWidth);
            var itc = calendar._getCell(x);
            if (!itc) {
                return null;
            }

            var result = {};
            result.x = x;
            result.offset = pixels % calendar.cellWidth;
            result.cell = itc;
            return result;
        };

        this._getCellFromTime = function(time) {
            var deltaMs = time.ticks - this.startDate.ticks;
            var msPerCell = calendar._getCellDuration() * 60 * 1000;  // minutes → ms
            if (deltaMs < 0) {
                return {
                    past: true
                };
            }
            var i = Math.floor(deltaMs / msPerCell);
            return {
                i: i,
                current: calendar._getCell(i)
            };
        };

        this._ticksToPixels = function(ticks) {
            var duration = calendar._getCellDuration() * 60 * 1000;
            var width = calendar.cellWidth;
            return Math.floor(width * ticks / duration);
        };

        this._pixelsToTicks = function(pixels) {
            var duration = calendar._getCellDuration() * 60 * 1000;
            var width = calendar.cellWidth;
            return Math.floor(pixels / width * duration);
        };

        this._onEventClick = function(ev) {
            if (DayPilot.Global.touch.start) {
                return;
            }
            if (DayPilotScheduler._preventEventClick) {
                return;
            }
            calendar._moving = {}; // clear
            calendar._eventClickDispatch(this, ev);
        };

        this._eventClickDispatch = function(div, ev) {
            var e = div.event;

            if (!e) {  // heavy dynamic loading fix
                return;
            }
            calendar._eventClickSingle(div, ev);
        };

        this._eventRightClickDispatch = function(ev) {

            if (DayPilot.Global.touch.active || DayPilot.Global.touch.start) {
                return;
            }

            var e = this.event;

            ev.cancelBubble = true;
            ev.preventDefault();

            if (!this.event.client.rightClickEnabled()) {
                return false;
            }

            calendar._updateCoords(ev);

            var args = {};
            args.e = e;
            args.div = this;
            args.originalEvent = ev;
            args.preventDefault = function() {
                this.preventDefault.value = true;
            };

            if (typeof calendar.onEventRightClick === 'function') {
                calendar.onEventRightClick(args);
                if (args.preventDefault.value) {
                    return false;
                }
            }

            switch (calendar.eventRightClickHandling) {
                case 'ContextMenu':
                    var menu = e.client.contextMenu();
                    if (menu) {
                        menu.show(e);
                    }
                    else {
                        if (calendar.contextMenu) {
                            calendar.contextMenu.show(this.event);
                        }
                    }
                    break;
                    break;
            }

            if (typeof calendar.onEventRightClicked === 'function') {
                calendar.onEventRightClicked(args);
            }


            return false;
        };


        this._getCell = function (x) {
            var minutesPerCell = calendar._getCellDuration();
            var msPerCell = minutesPerCell * 60 * 1000;
            return {
                start : calendar.startDate.addTime(x * msPerCell),
                end   : calendar.startDate.addTime((x + 1) * msPerCell),
                left: x * calendar.cellWidth,
                width: calendar.cellWidth,
            };
        };

        this._eventClickSingle = function(div, ev) {
            if (typeof ev === "boolean") {
                throw new DayPilot.Exception("Invalid _eventClickSingle parameters");
            }
            var e = div.event;

            if (!e) {
                return;
            }

            var ctrlKey = ev.ctrlKey;
            var metaKey = ev.metaKey;

            if (!e.client.clickEnabled()) {
                return;
            }

            calendar._updateCoords(ev);

            var args = {};
            args.e = e;
            args.control = calendar;
            args.div = div;
            args.originalEvent = ev;
            args.ctrl = ctrlKey;
            args.meta = metaKey;
            args.shift = ev.shiftKey;
            args.preventDefault = function() {
                this.preventDefault.value = true;
            };
            args.toJSON = function() {
                return DayPilot.Util.copyProps(args, {}, ["e", "ctrl", "meta", "shift"]);
            };

            if (typeof calendar.onEventClick === 'function') {
                calendar.onEventClick(args);
                if (args.preventDefault.value) {
                    return;
                }
            }

            if (typeof calendar.onEventClicked === 'function') {
                calendar.onEventClicked(args);
            }


        };

        this._eventDeleteDispatch = function(e) {

            var args = {};
            args.e = e;

            args.preventDefault = function() {
                this.preventDefault.value = true;
            };
            args.control = calendar;
            args.toJSON = function() {
                return DayPilot.Util.copyProps(args, {}, ["e"]);
            };

            if (typeof calendar.onEventDelete === 'function') {
                calendar.onEventDelete(args);
                if (args.preventDefault.value) {
                    return;
                }
            }

            switch (calendar.eventDeleteHandling) {
                case 'Update':
                    calendar.events.remove(e);
                    break;
            }

            if (typeof calendar.onEventDeleted === 'function') {
                calendar.onEventDeleted(args);
            }

        };


        this.getScrollX = function() {
            return this.nav.scroll.scrollLeft;
        };

        this.getScrollY = function() {
            return this.nav.scroll.scrollTop;
        };

        this._eventResizeDispatch = function(e, newStart, newEnd, what) {

            if (this.eventResizeHandling === 'Disabled') {
                return;
            }

            newEnd = calendar._adjustEndOut(newEnd);

            var args = {};

            args.e = e;
            args.async = false;
            args.loaded = function() {
                performResize();
            };
            args.newStart = newStart;
            args.newEnd = newEnd;
            args.what = what;
            args.preventDefault = function() {
                this.preventDefault.value = true;
            };
            args.control = calendar;
            args.toJSON = function() {
                return DayPilot.Util.copyProps(args, {}, ["e", "async", "newStart", "newEnd"]);
            };

            var performResize = function() {

                if (args.preventDefault.value) {
                    return;
                }

                args.loaded = {};

                newStart = args.newStart;
                newEnd = args.newEnd;

                switch (calendar.eventResizeHandling) {
                    case 'Update':
                        calendar._doEventMoveUpdate(args);
                        break;
                }

                if (typeof calendar.onEventResized === 'function') {
                    calendar.onEventResized(args);
                }
            };


            if (typeof calendar.onEventResize === 'function') {
                calendar.onEventResize(args);
            }

            if (!args.async) {
                performResize();
            }


        };

        this._update = function(args) {
            args = args || {};

            clearTimeout(calendar._drawEventsTimeout);

            calendar.timeHeader = null;
            calendar.cellProperties = {};
            calendar._prepareHeaderGroups();

            calendar._loadResources();

            calendar.events._postponedClear();
            calendar._resolved._clearCache();

            calendar.clearSelection();

            this._loadEvents();
            calendar._prepareRowTops();
            calendar._drawResHeader();

            calendar._updateTheme();
            calendar._drawTimeHeader();

            calendar._updateRowHeaderHeights();
            calendar._updateRowHeaderWidth();
            calendar._updateHeaderHeight();

            this._deleteEvents();
            this._deleteCells();

            this._clearCachedValues();

            calendar._updateHeight();

            this._drawCells();

            if (args.immediateEvents) {
                calendar._drawEvents();
            }
            else {
                setTimeout(function() { calendar._drawEvents(); }, 100);
            }

            if (this.visible) {
                if (calendar._previousVisible !== calendar.visible) {
                    this.show();
                }
            }
            else {
                this.hide();
            }
            this._previousVisible = this.visible;

            this._updateFloats();

            calendar._onScroll();

            this._doAfterUpdate();

        };

        this._doAfterUpdate = function() {
            if (typeof calendar.onAfterUpdate !== "function") {
                return;
            }
            var args = {};
            calendar.onAfterUpdate(args);
        };


        // full update
        this.update = function(options) {

            if (!calendar._initialized) {
                throw new DayPilot.Exception("You are trying to update a DayPilot.Scheduler object that hasn't been initialized.");
            }

            if (calendar._disposed) {
                throw new DayPilot.Exception("You are trying to update a DayPilot.Scheduler object that has been disposed already. Calling .dispose() destroys the object and makes it unusable.");
            }

            postponedUpdate.request(options);

        };

        var postponedUpdate = {};
        postponedUpdate.timeout = null;
        postponedUpdate.options = null;

        // if enabled, all update() calls within a single block are merged
        // - but the update itself is performed asynchronously and it's unexpectd behavior
        postponedUpdate.enabled = false;

        postponedUpdate.request = function(options) {
            if (postponedUpdate.enabled) {
                clearTimeout(postponedUpdate.timeout);
                postponedUpdate._mergeOptions(options);
                postponedUpdate.timeout = setTimeout(postponedUpdate.doit);
            }
            else {
                postponedUpdate._mergeOptions(options);
                postponedUpdate.doit();
            }
        };

        postponedUpdate._mergeOptions = function(options) {
            if (!options) {
                return;
            }

            if (!postponedUpdate.options) {
                postponedUpdate.options = {};
            }

            for (var name in options) {
                postponedUpdate.options[name] = options[name];
            }
        };

        postponedUpdate.doit = function() {

            var options = postponedUpdate.options;
            postponedUpdate.options = null;

            if (!calendar._initialized) {
                calendar._loadOptions(options);
                return;
            }

            // full update
            calendar._loadOptions(options);
            calendar._update({"immediateEvents":true});
            calendar._postInit();

        };

        this._drawRowsForced = function(rows) {
            rows.forEach(function(row) {
                calendar._drawRowForced(row.index);
            });
        };

        this._ensureRowsArray = function(rows) {
            if (!rows || rows.length === 0) {
                return [];
            }
            if (rows[0].isRow) {
                return rows;
            }
            return rows.map(function(i) {
                return calendar.rowlist[i];
            });
        };

        this._updateRowsNoLoad = function(rows, appendOnlyIfPossible, finishedCallBack) {

            rows = DayPilot.ua(rows);
            rows = calendar._ensureRowsArray(rows);

            calendar._drawRowsForced(rows);

            if (this._rowsDirty) {
                this._prepareRowTops();
                this._updateRowHeaderHeights();

                this._deleteCells();

                rows.forEach(function(row) {
                    calendar._deleteEventsInRow(row.index);
                });

                rows.forEach(function(row) {
                    calendar._drawEventsInRow(row.index);
                });

                this._drawCells();

                this._updateEventTops();

            }
            else {

                rows.forEach(function(row) {
                    if (!appendOnlyIfPossible) {
                        calendar._deleteEventsInRow(row.index);
                    }
                    calendar._drawEventsInRow(row.index);
                });

                rows.forEach(function(row) {
                    calendar._deleteCellsInRow(row.index);
                });
                calendar._drawCells();
            }

            calendar._findEventsInViewPort();

            if (finishedCallBack) {
                finishedCallBack();
            }

            this._clearCachedValues();

        };

        this._adjustEndOut = function(date) {
            if (calendar.eventEndSpec === "DateTime") {
                return date;
            }
            if (date.getDatePart().ticks === date.ticks) {
                return date.addDays(-1);
            }
            return date.getDatePart();
        };

        this._adjustEndIn = function(date) {
            if (calendar.eventEndSpec === "DateTime") {
                return date;
            }
            return date.getDatePart().addDays(1);
        };

        this._adjustEndNormalize = function(date) {
            if (calendar.eventEndSpec === "DateTime") {
                return date;
            }
            return date.getDatePart();
        };

        this._eventMoveDispatch = function(e, newStart, newEnd, newResource, ev) {

            calendar._lastEventMoving = null;

            if (calendar.eventMoveHandling === 'Disabled') {
                return;
            }

            newEnd = calendar._adjustEndOut(newEnd);

            var args = {};

            args.e = e;
            args.newStart = newStart;
            args.newEnd = newEnd;
            args.newResource = newResource;
            args.ctrl = false;
            args.meta = false;
            args.shift = false;
            if (ev) {
                args.shift = ev.shiftKey;
                args.ctrl = ev.ctrlKey;
                args.meta = ev.metaKey;
            }
            args.control = calendar;
            args.areaData = DayPilot.Global.movingAreaData;
            args.toJSON = function() {
                return DayPilot.Util.copyProps(args, {}, ["e", "newStart", "newEnd", "newResource", "ctrl", "meta", "shift"]);
            };

            args.preventDefault = function() {
                this.preventDefault.value = true;
            };
            var performMove = function() {

                // make sure it can't be fired anymore
                args.loaded = function() {};

                if (args.preventDefault.value) {
                    calendar._clearMovingShadow();
                    return;
                }

                newStart = args.newStart;
                newEnd = args.newEnd;

                switch (calendar.eventMoveHandling) {
                    case 'Update':
                        //newEnd = calendar._adjustEndIn(newEnd);
                        calendar._doEventMoveUpdate(args);
                        break;
                }

                calendar._clearMovingShadow();

                if (typeof calendar.onEventMoved === 'function') {
                    calendar.onEventMoved(args);
                }

            };

            args.async = false;
            args.loaded = function() {
                performMove();
            };

            if (typeof calendar.onEventMove === 'function') {
                calendar.onEventMove(args);
            }

            if (!args.async) {
                performMove();
            }
            else {
            }


        };

        this._doEventMoveUpdate = function(args) {
            var e = args.e;
            var newStart = args.newStart;
            var newEnd = args.newEnd;
            var newResource = args.newResource;

            e.start(newStart);
            e.end(newEnd);
            e.resource(newResource);
            calendar.events.update(e);
            calendar.events._immediateRefresh();

        };

        this._timeRangeSelectedDispatchFromRange = function(range) {
            if (!range) {
                return;
            }

            if (range.args) {
                calendar._timeRangeSelectedDispatch(range.args.start, range.args.end, range.args.resource);
            }
            else {
                var sel = calendar._getSelection(range);
                if (!sel) {
                    return;
                }
                calendar._timeRangeSelectedDispatch(sel.start, sel.end, sel.resource);
            }
        };

        this._timeRangeSelectedDispatch = function(start, end, resource) {

            if (calendar.timeRangeSelectedHandling === 'Disabled') {
                return;
            }

            var rawend = end;
            end = calendar._adjustEndOut(rawend);

            var args = {};
            args.control = calendar;
            args.start = start;
            args.end = end;
            args.resource = resource;
            args.preventDefault = function () {
                this.preventDefault.value = true;
            };
            args.toJSON = function() {
                return DayPilot.Util.copyProps(args, {}, ["start", "end", "resource"]);
            };


            if (typeof calendar.onTimeRangeSelect === 'function') {
                calendar.onTimeRangeSelect(args);
                if (args.preventDefault.value) {
                    return;
                }

                start = args.start;
                end = args.end;
            }

            end = calendar._adjustEndIn(end);

            calendar._updateRange(calendar._rangeHold, start, end);
            calendar._drawRange(calendar._rangeHold);

            if (typeof calendar.onTimeRangeSelected === 'function') {
                calendar.onTimeRangeSelected(args);
            }


        };

        // requires normalized/raw end (timeline)
        this._updateRange = function(range, start, end) {

            if (!range) {
                return;
            }

            // requires normalized end
            // var rawend = calendar._adjustEndIn(end);
            var rawend = end;

            var itc;

            // fix start
            if (start.getTime() < calendar.startDate.getTime()) {
                range.start.x = 0;
                range.start.time = calendar.startDate.getTime();
            }
            else {
                itc = calendar._getCellFromTime(start);
                range.start.x = itc.i;
                range.start.time = start;
            }

            // fix end
            var endDate = calendar.startDate.addDays(calendar.days);
            if (rawend.getTime() > endDate.getTime()) {
                range.end.x = calendar._cellCount();
                range.end.time = endDate.getTime();
            }
            else {
                itc = calendar._getCellFromTime(rawend.addMilliseconds(-1));
                range.end.x = itc.i;
                range.end.time = end;
            }
        };


        this._rowClickDispatch = function(e, ev) {
            calendar._rowClickSingle(e, ev);
        };

        this._rowClickSingle = function(e, ev) {

            var args = {};
            args.resource = e;
            args.row = e;
            args.ctrl = ev.ctrlKey;
            args.shift = ev.shiftKey;
            args.meta = ev.metaKey;
            args.originalEvent = ev;
            args.preventDefault = function() {
                this.preventDefault.value = true;
            };

            if (typeof calendar.onRowClick === 'function') {
                calendar.onRowClick(args);
                if (args.preventDefault.value) {
                    return;
                }
            }

            if (typeof calendar.onRowClicked === 'function') {
                calendar.onRowClicked(args);
            }
        };
        //

        this._timeHeaderClickDispatch = function(e) {
            var args = {};
            args.header = e;
            args.control = calendar;
            args.preventDefault = function() {
                this.preventDefault.value = true;
            };

            if (typeof calendar.onTimeHeaderClick === 'function') {
                calendar.onTimeHeaderClick(args);
                if (args.preventDefault.value) {
                    return;
                }
            }

            if (typeof calendar.onTimeHeaderClicked === 'function') {
                calendar.onTimeHeaderClicked(args);
            }
        };

        this.getViewport = function() {
            var scrollX = this.nav.scroll.scrollLeft;
            var scrollY = this.nav.scroll.scrollTop;

            var viewport = {};

            var area = calendar._getArea(scrollX, scrollY);
            var res = calendar._getAreaResources(area);
            var leftCell = calendar._getCell(area.start.x);
            var rightCell = calendar._getCell(area.end.x);

            viewport.start = calendar.getDate(scrollX, true);
            viewport.end = calendar.getDate(scrollX + calendar.nav.scroll.clientWidth, true, true);
            viewport.resources = res;

            if (leftCell) {
                viewport.topLeft = {
                    "start": leftCell.start,
                    "end": leftCell.end,
                    x: area.start.x,
                    y: area.start.y,
                    "resource": res[0]
                };
            }

            if (rightCell) {
                viewport.bottomRight = {
                    "start": rightCell.start,
                    "end": rightCell.end,
                    x: area.end.x,
                    y: area.end.y,
                    "resource": res[res.length - 1]
                };
            }

            viewport.rows = function() {
                return viewport.resources.map(function(r) { return calendar.rows.find(r)});
            };

            viewport.events = function() {

                var events = [];
                viewport.rows().forEach(function(r) {
                    events = events.concat(r.events.forRange(viewport.start, viewport.end));
                });
                return events;
            };

            return viewport;
        };

        this._getArea = function(scrollX, scrollY) {
            var area = {};
            area.start = {};
            area.end = {};

            var start = calendar._getCellFromPixels(scrollX);
            var end = calendar._getCellFromPixels(scrollX + calendar.nav.scroll.clientWidth);

            if (start) {
                area.start.x = start.x;
            }

            if (end) {
                area.end.x = end.x;
            }

            var topY = scrollY;
            var bottomY = scrollY + calendar.nav.scroll.clientHeight;
            area.start.y = calendar._getRow(topY).i;
            area.end.y = calendar._getRow(bottomY).i;

            area.start.x = DayPilot.Util.atLeast(area.start.x, 0);

            var maxX = calendar._cellCount();
            if (area.end.x >= maxX) {
                area.end.x = maxX - 1;
            }

            return area;
        };

        this._getAreaResources = function(area) {
            if (!area) {
                area = this._getArea(this.nav.scroll.scrollLeft, this.nav.scroll.scrollTop);
            }

            var res = [];
            res.ignoreToJSON = true;  // preventing Gaia and prototype to mess up with Array serialization

            for (var i = area.start.y; i <= area.end.y; i++) {
                var r = calendar.rowlist[i];
                if (r) {
                    res.push(r.id);
                }
            }
            return res;
        };

        this._prefixCssClass = function(part) {
            var prefix = this.theme || this.cssClassPrefix;
            if (prefix) {
                return prefix + part;
            }
            else {
                return "";
            }
        };

        this._updateTheme = function() {
            var needsUpdate = calendar.nav.top.className !== calendar._prefixCssClass("_main");

            if (!needsUpdate) {
                return;
            }

            calendar.nav.top.className = calendar._prefixCssClass("_main");
            calendar.nav.dh1.className = calendar._prefixCssClass("_divider_horizontal");
            calendar.nav.dh2.className = calendar._prefixCssClass("_divider_horizontal");
            calendar.divResScroll.className = calendar._prefixCssClass("_rowheader_scroll");
            calendar.nav.divider.className  = calendar._prefixCssClass("_divider") + " " + calendar._prefixCssClass("_splitter");
            calendar.nav.scroll.className = calendar._prefixCssClass("_scrollable");
            calendar._maind.className = calendar._prefixCssClass("_matrix") + " " + calendar._prefixCssClass("_grid_main");
        };

        this._registerDispose = function() {
            this.nav.top.dispose = this.dispose;
        };

        this.dispose = function() {

            var c = calendar;

            if (!c._initialized) {
                return;
            }

            if (c._disposed) {
                return;
            }

            c._disposed = true;

            for (var name in c._timeouts) {
                var item = c._timeouts[name];
                if (DayPilot.isArray(item)) {
                    item.forEach(function(t) {
                        clearTimeout(t);
                    });
                }
                else {
                    clearTimeout(item);
                }
            }

            c._deleteEvents();

            c.divCells = null;
            c.divCorner = null;
            c.divEvents = null;
            if (c.divHeader) {
                c.divHeader.rows = null;
            }
            c.divHeader = null;
            c.divLines = null;
            c.divNorth = null;
            c.divRange = null;
            c.divResScroll = null;
            c.divStretch = null;
            c.divTimeScroll = null;
            c._scrollRes = null;
            c._maind.calendar = null;
            c._maind = null;

            c.nav.top.onmousemove = null;
            c.nav.top.onmouseout = null;
            c.nav.top.dispose = null;
            c.nav.top.ontouchstart = null;
            c.nav.top.ontouchmove = null;
            c.nav.top.ontouchend = null;

            c.nav.top.removeAttribute('style');
            c.nav.top.removeAttribute('class');
            c.nav.top.innerHTML = "";
            c.nav.top.dp = null;
            c.nav.top = null;

            c.nav.scroll.onscroll = null;
            c.nav.scroll.root = null;
            c.nav.scroll = null;

            DayPilotScheduler._unregister(c);

            eventloading = null;
        };

        this.disposed = function() {
            return calendar._disposed;
        }

        this._createShadow = function(object) {
            var event = null;
            if (object.nodeType) {
                event = object.event;
            }
            else {
                event = object;
            }

            var coords = calendar._getShadowCoords(event);
            var rowlist = calendar.rowlist;

            var height = calendar.eventHeight;
            var top = (event.part && event.part.top && rowlist[event.part.dayIndex]) ? (event.part.top + rowlist[event.part.dayIndex].top) : coords.top;
            var left = coords.left;
            var width = coords.width;

            var shadow = document.createElement('div');
            shadow.style.position = 'absolute';
            shadow.style.width = width + 'px';
            shadow.style.height = height + 'px';
            shadow.style.left = left + 'px';
            shadow.style.top = top + 'px';
            // shadow.style.zIndex = 101;
            shadow.style.overflow = 'hidden';

            var inner = createDiv();
            shadow.appendChild(inner);
            shadow.className = this._prefixCssClass("_shadow");
            inner.className = this._prefixCssClass("_shadow_inner");

            calendar.divShadow.appendChild(shadow);
            shadow.calendar = calendar;

            return shadow;
        };

        // y is in pixels, not row index
        this._getRow = function(y) {
            var rowlist = calendar.rowlist;

            var result = {};
            var element;

            var top = 0;
            var rowEnd = 0;
            var iMax = rowlist.length; // maximum row index

            for (var i = 0; i < iMax; i++) {
                var row = rowlist[i];
                rowEnd += row.height;

                top = rowEnd - row.height;
                element = row;

                // make sure it's the last visible row
                result.top = top;
                result.bottom = rowEnd;
                result.i = i;  // visible row index
                result.element = element;

                if (y < rowEnd) {
                    break;
                }
            }

            return result;
        };

        this._getRowByIndex = function(i) {
            if (i > this.rowlist.length - 1) {
                throw new DayPilot.Exception("Row index too high");
            }

            var bottom = 0;
            for (var j = 0; j <= i; j++) {
                bottom += this.rowlist[j].height;
            }
            var row = this.rowlist[i];
            var top = bottom - row.height;

            return {
                top: top,
                height: row.height,
                bottom: bottom,
                i: i,
                data: row
            };
        };

        this.events.find = function(id) {
            if (!calendar.events.list || typeof calendar.events.list.length === 'undefined') {
                return null;
            }
            if (typeof id === "function") {
                return calendar._eventsFindByFunction(id);
            }
            var len = calendar.events.list.length;
            for (var i = 0; i < len; i++) {
                if (calendar.events.list[i].id === id) {
                    return new DayPilot.Event(calendar.events.list[i], calendar);
                }
            }
            return null;
        };

        this.events.findAll = function(f) {
            if (typeof f === "function") {
                var len = calendar.events.list.length;
                var result = [];
                for (var i = 0; i < len; i++) {
                    var e = new DayPilot.Event(calendar.events.list[i], calendar);
                    if (f(e)) {
                        result.push(e);
                    }
                }
                return result;
            }
            if (typeof f === "object") {
                return calendar.events.findAll(function(e) {
                    for (var name in f) {
                        if (f[name] !== e.data[name]) {
                            return false;
                        }
                    }
                    return true;
                });
            }
            throw new DayPilot.Exception("function or object argument expected");
        };

        this._eventsFindByFunction = function(f) {
            var len = calendar.events.list.length;
            for (var i = 0; i < len; i++) {
                var e = new DayPilot.Event(calendar.events.list[i], calendar);
                if (f(e)) {
                    return e;
                }
            }
            return null;
        };

        this.events.focus = function(e) {
            var div = calendar._findEventDivEnsureRendered(e);
            div && div.focus();
        };

        this.events.scrollIntoView = function(e) {
            var div = calendar._findEventDivEnsureRendered(e);
            if (!div) {
                return;
            }

            var target = e.start();
            var viewport = calendar.getViewport();


            if (!DayPilot.Util.overlaps(viewport.start, viewport.end, e.start(), e.end()) && DayPilot.Util.overlaps(calendar._visibleStart(), calendar._visibleEnd(), e.start(), e.end())) {
                calendar.scrollTo(target, "fast", "middle");
            }

            var r = e.resource();
            if (calendar.getViewport().resources.indexOf(r) === -1) {
                calendar.scrollToResource(r);
            }

        };

        this.events.all = function() {
            var list = [];
            for (var i = 0; i < calendar.events.list.length; i++) {
                var e = new DayPilot.Event(calendar.events.list[i], calendar);
                list.push(e);
            }
            return list;
        };

        this.events.forRange = function(start, end) {
            start = start ? new DayPilot.Date(start) : calendar.visibleStart();
            end = end ?  new DayPilot.Date(end) : calendar.visibleEnd();

            var list = [];
            for (var i = 0; i < calendar.events.list.length; i++) {
                var e = new DayPilot.Event(calendar.events.list[i], calendar);
                if (DayPilot.Util.overlaps(e.start(), e.end(), start, end)) {
                    list.push(e);
                }
            }
            return list;
        };

        this.events.load = function(url, success, error) {

            if (!url) {
                throw new DayPilot.Exception("events.load(): 'url' parameter required");
            }
            var onError = function(args) {
                var largs = {};
                largs.exception = args.exception;
                largs.request = args.request;

                if (typeof error === 'function') {
                    error(largs);
                }
            };

            var onSuccess = function(args) {
                var r = args.request;
                var data;

                // it's supposed to be JSON
                try {
                    data = JSON.parse(r.responseText);
                }
                catch (e) {
                    var fargs = {};
                    fargs.exception = e;
                    onError(fargs);
                    return;
                }

                if (DayPilot.isArray(data)) {
                    var sargs = {};
                    sargs.preventDefault = function() {
                        this.preventDefault.value = true;
                    };
                    sargs.data = data;
                    if (typeof success === "function") {
                        success(sargs);
                    }

                    if (sargs.preventDefault.value) {
                        return;
                    }

                    calendar.events.list = sargs.data;
                    if (calendar._initialized) {
                        calendar.update();
                    }
                }
            };

            var usePost = calendar.eventsLoadMethod && calendar.eventsLoadMethod.toUpperCase() === "POST";

            if (usePost) {
                DayPilot.ajax({
                    "method": "POST",
                    "contentType": "application/json",
                    "data": { "start": calendar.visibleStart().toString(), "end": calendar.visibleEnd().toString()},
                    "url": url,
                    "success": onSuccess,
                    "error": onError
                });
            }
            else {
                var fullUrl = url;
                var queryString = "start=" + calendar.visibleStart().toString() + "&end=" + calendar.visibleEnd().toString();
                if (fullUrl.indexOf("?") > -1) {
                    fullUrl += "&" + queryString;
                }
                else {
                    fullUrl += "?" + queryString;
                }

                DayPilot.ajax({
                    "method": "GET",
                    "url": fullUrl,
                    "success": onSuccess,
                    "error": onError
                });
            }

        };

        // internal
        this.events._removeFromRows = function(data) {
            var rows = [];
            var rowlist = calendar.rowlist;
            rowlist.forEach(function(row) {
                calendar._ensureRowData(row.index);
                for (var r = 0; r < row.events.length; r++) {
                    var rd = row.events[r].data;
                    if (calendar._isSameEvent(rd, data)) {
                        //data.rendered = false;
                        rows.push(row);
                        row.events.splice(r, 1);
                        break; // only once per row
                    }
                }
            });
            return rows;
        };

        // internal
        this.events._findEventInRows = function(data) {

            if (!data) {
                return null;
            }

            var rowlist = calendar.rowlist;
            for (var i = 0; i < rowlist.length; i++) {
                var row = rowlist[i];
                calendar._ensureRowData(row.index);
                for (var r = 0; r < row.events.length; r++) {
                    var re = row.events[r];
                    if (calendar._isSameEvent(re.data, data)) {
                        return row.events[r];
                    }
                }
            }
            return null;
        };

        // internal
        // fast, use instead of full loadEvents()
        this.events._addToRows = function(data) {
            var rows = [];
            var testAll = calendar._containsDuplicateResources();

            var index = DayPilot.indexOf(calendar.events.list, data);
            calendar._doBeforeEventRender(index);

            var rowlist = calendar.rowlist;
            var quit = false;
            rowlist.forEach(function(row) {
                if (quit) {
                    return;
                }
                calendar._ensureRowData(row.index);
                var ep = calendar._loadEvent(data, row);
                if (ep) {
                    if (typeof calendar.onBeforeEventRender === 'function') {
                        ep.cache = calendar._cache.events[index];
                    }

                    rows.push(row);
                    if (!testAll) {
                        quit = true;
                    }
                }
            });
            return rows;
        };


        this._isSameEvent = function(data1, data2) {
            return DayPilot.Util.isSameEvent(data1, data2);
        };

        this.events.update = function(e, data, options) {

            if (typeof e === "object" && !(e instanceof DayPilot.Event)) {
                // updateByData
                // var data = e;
                var ev = calendar.events.find(e.id);
                calendar.events.remove(ev);
                calendar.events.add(e);
                return;
            }

            var params = {};
            params.oldEvent = new DayPilot.Event(e.copy(), calendar);
            params.newEvent = new DayPilot.Event(e.temp(), calendar);

            options = options || {};

            // don't add it if it wasn't in the list
            var inList = calendar.events.list.find(function(item) {
                return calendar._isSameEvent(item, e.data);
            });

            if (!inList) {
                return;
            }

            if (calendar._angular2._eventsFromAttr) {
                calendar._angular2.skip = true;
            }

            var rows = calendar.events._removeFromRows(e.data);
            e.commit();
            rows = rows.concat(calendar.events._addToRows(e.data));
            calendar.events._postponedUpdate(rows);
        };

        this.events.remove = function(e) {

            if (!e) {
                return;
            }

            if (typeof e === "string" || typeof e === "number") {
                var found = calendar.events.find(e);
                calendar.events.remove(found);
                return;
            }

            var params = {};
            params.e = new DayPilot.Event(e.data, calendar);

            var inList = calendar._findEventInList(e.data);
            if (inList) {
                calendar.events.list.splice(inList.index, 1);
            }

            if (calendar._angular2._eventsFromAttr) {
                calendar._angular2.skip = true;
            }

            var rows = calendar.events._removeFromRows(e.data);
            calendar.events._postponedUpdate(rows);
        };

        this.events.add = function(e, data, options) {

            var options = options || {};
            var renderOnly = options.renderOnly;

            if (!(e instanceof DayPilot.Event)) {
                e = new DayPilot.Event(e);
            }

            e.calendar = calendar;

            if (!calendar.events.list) {
                calendar.events.list = [];
            }

            var inList = calendar._findEventInList(e);

            if (renderOnly) {
                if (!inList) {
                    throw new DayPilot.Exception("Unexpected: event not found in list");
                }
            }
            else {
                if (inList) {
                    throw new DayPilot.Exception("The event you are trying to add using DayPilot.Scheduler.events.add() is already loaded. A unique ID is required.");
                }
                if (!inList) {
                    calendar.events.list.push(e.data);
                }
            }

            if (!calendar._initialized) {
                return;
            }

            if (calendar._angular2._eventsFromAttr) {
                calendar._angular2.skip = true;
            }

            var params = {};
            params.e = e;

            var rows = calendar.events._addToRows(e.data);
            calendar.events._postponedUpdate(rows);
        };

        this.events._overlaps = function(e) {
            var data = e instanceof DayPilot.Event ? e.data : e;
            var start = new DayPilot.Date(data.start);
            var end = new DayPilot.Date(data.end);

            var overlapping = calendar.events.list.find(function(item) {
                if (calendar._isSameEvent(data, item)) {
                     return false;
                }
                if (data.resource !== item.resource) {
                    return false;
                }
                var itemStart = new DayPilot.Date(item.start);
                var itemEnd = new DayPilot.Date(item.end);
                return DayPilot.Util.overlaps(start, end, itemStart, itemEnd);
            });
            return !!overlapping;
        };

        this.events._postponedData = { "rows": [] };
        this.events._postponedTimeout = null;
        this.events._postponedClear = function() {
            clearTimeout(calendar.events._postponedTimeout);
            calendar.events._postponedTimeout = null;
            calendar.events._postponedData.rows = [];
        };
        this.events._queueUpdateInterval = 0;

        this.events._postponedUpdate = function(rows) {

            var update = calendar.events._postponedData.rows;
            rows.forEach(function(row) {
                update.push(row);
            });

            calendar.events._postponedData.rows = DayPilot.ua(update); // merge

            var doit = calendar.events._immediateRefresh;

            if (!calendar.events._postponedTimeout) {
                calendar.events._postponedTimeout = setTimeout(doit, calendar.events._queueUpdateInterval);
            }
        };

        this.events._immediateRefresh = function() {

            clearTimeout(calendar.events._postponedTimeout);
            calendar.events._postponedTimeout = null;

            var rows = calendar.events._postponedData.rows;
            calendar.events._postponedData.rows = [];

            calendar._loadRows(rows);
            calendar._updateRowHeights();

            if (calendar._initialized) {
                if (calendar._rowsDirty){
                    calendar._prepareRowTops();
                }
                calendar._updateHeight();
                calendar._updateRowsNoLoad(rows);
            }
        };

        this._angular2 = {};
        this._angular2.enabled = false;
        this._angular2.skip = false;
        this._angular2.skipUpdate = function() {
            return calendar._angular2.skip;
        };
        this._angular2.skipped = function() {
            calendar._angular2.skip = false;
        };
        this._angular2._resourcesFromAttr = false;
        this._angular2._eventsFromAttr = false;

        this._react = {};
        this._react.reactDOM = null;
        this._react.react = null;

        this._getBoxStart = function(date) {

            var start = calendar.startDate;

            if (date.ticks === start.ticks) {
                return date;
            }

            var cursor = start;

            if (date.ticks < start.ticks) {
                while (cursor.ticks > date.ticks) {
                    cursor = cursor.addTime(-calendar._getCellDuration()*60*1000);
                }
                return cursor;
            }

            var cell = this._getCellFromTime(date);
            if (cell.current) {
                return cell.current.start;
            }

            throw new DayPilot.Exception("getBoxStart(): time not found");
        };

        this._getShadowCoords = function(e) {

            // get row
            var row = this._getRow(calendar.coords.y);

            if (typeof e.end !== 'function') {
                throw new DayPilot.Exception("e.end function is not defined");
            }
            if (!e.end()) {
                throw new DayPilot.Exception("e.end() returns null");
            }
            var duration = DayPilot.DateUtil.diff(e.rawend(), e.start());
            duration = DayPilot.Util.atLeast(duration, 1);

            var useBox = resolved._useBox(duration);

            var startOffsetTime = 0;

            var x = calendar.coords.x;

            if (useBox) {
                startOffsetTime = e.start().getTime() - this._getBoxStart(e.start()).getTime();
            }

            var dragOffsetTime = 0;

            // this keeps the cell offset the same after moving
            if (DayPilotScheduler._moveDragStart) {
                if (useBox) {
                    var estart = e.start();
                    var boxStart = this._getBoxStart(estart);
                    dragOffsetTime = DayPilotScheduler._moveDragStart.getTime() - boxStart.getTime();
                    var cellDurationTicks = calendar._getCellDuration() * 60 * 1000;
                    dragOffsetTime = Math.floor(dragOffsetTime/cellDurationTicks) * cellDurationTicks;
                }
                else {
                    dragOffsetTime = DayPilotScheduler._moveDragStart.getTime() - e.start().getTime();
                }
            }

            var start = this.getDate(x, true).addTime(-dragOffsetTime);

            if (DayPilotScheduler._resizing) {
                start = e.start();
            }

            var snapToGrid = calendar.snapToGrid;

            if (snapToGrid) { // limitation: this blocks moving events before startDate
                start = this._getBoxStart(start);
            }

            start = start.addTime(startOffsetTime);
            var end = start.addTime(duration);

            var adjustedStart = start;
            var adjustedEnd = end;

            var startPixels = this.getPixels(adjustedStart);
            var endPixels = this.getPixels(adjustedEnd.addTime(-1));

            var left = (snapToGrid) ? startPixels.boxLeft : startPixels.left;
            var width = (snapToGrid && useBox) ? (endPixels.boxRight - left) : (endPixels.left - left);

            var coords = {};
            coords.top = row.top;
            coords.left = left;
            coords.row = row.element;
            coords.rowIndex = row.i;
            coords.width = width;
            coords.start = start;
            coords.end = end;
            coords.relativeY = calendar.coords.y - row.top;

            return coords;
        };

        this._getCellDuration = function() {  // approximate, needs to be updated for a specific time (used only for rounding in getShadowCoords
            switch (this.scale) {
                case "CellDuration":
                    return this.cellDuration;
                case "Minute":
                    return 1;
                case "Hour":
                    return 60;
                case "Day":
                    return 60*24;
                case "Week":
                    return 60*24*7;
            }
            throw new DayPilot.Exception("can't guess cellDuration value");
        };

        this._getCellTicks = function(itc) {
            return itc.end.ticks - itc.start.ticks;
        };

        this._updateResizingShadow = function() {
            var shadowWidth = DayPilotScheduler._resizingShadow.width;
            var shadowLeft = DayPilotScheduler._resizingShadow.left;
            var e = DayPilotScheduler._resizingEvent;
            var border = DayPilotScheduler._resizing.dpBorder;

            var newStart = null;
            var newEnd = null;

            var snapToGrid = calendar.snapToGrid;
            var exact = !snapToGrid;

            if (border === 'left') {
                newStart = calendar.getDate(shadowLeft, exact);
                newEnd = e.rawend();
            }
            else if (border === 'right') {
                newStart = e.start();
                newEnd = calendar.getDate(shadowLeft + shadowWidth, exact, true);
            }

            DayPilotScheduler._resizingShadow.start = newStart;
            DayPilotScheduler._resizingShadow.end = newEnd;

        };

        this._resizeShadow = function() {
            var coords = calendar.coords;

            var border = DayPilotScheduler._resizing.dpBorder;

            var e = DayPilotScheduler._resizing.event;

            var refX = e.part.left; // using x relative to maind
            if (border === "right") {
                refX += e.part.width;
            }

            var _step = DayPilotScheduler._resizing.event.calendar.cellWidth;
            var originalWidth = e.part.width;
            var originalLeft = e.part.left;
            var _startOffset = 0;
            var delta = (coords.x - refX);

            var newLeft, newWidth;

            var snapToGrid = calendar.snapToGrid;

            if (border === 'right') {
                newLeft = originalLeft;
                if (snapToGrid) {
                    //newWidth = Math.ceil(((originalWidth + originalLeft + delta)) / _step) * _step - originalLeft;
                    var itc =  calendar._getCellFromPixels(originalWidth + originalLeft + delta).cell;

                    var startitc = calendar._getCellFromPixels(originalLeft).cell;
                    var minWidth = (startitc.left + startitc.width) - originalLeft;

                    var newRight = itc.left + itc.width;
                    newWidth = newRight - originalLeft;

                    if (newWidth < minWidth) {
                        newWidth = minWidth;
                    }

                }
                else {
                    newWidth = originalWidth + delta;
                }

                var max = calendar._getGridWidth();

                if (originalLeft + newWidth > max) {
                    newWidth = max - originalLeft;
                }

                DayPilotScheduler._resizingShadow.left = originalLeft;
                DayPilotScheduler._resizingShadow.width = newWidth;
                DayPilotScheduler._resizingShadow.style.left = originalLeft + "px";
                DayPilotScheduler._resizingShadow.style.width = newWidth + "px";
            }
            else if (border === 'left') {
                if (snapToGrid) {
                    if (delta >= originalWidth) {
                        delta = originalWidth;
                    }
                    newLeft = Math.floor(((originalLeft + delta) + 0) / _step) * _step;
                    if (newLeft < _startOffset) {
                        newLeft = _startOffset;
                    }
                }
                else {
                    newLeft = originalLeft + delta;
                }

                newWidth = originalWidth - (newLeft - originalLeft);
                var right = originalLeft + originalWidth;

                var min = _step;

                if (!snapToGrid) {
                    min = 1;
                }
                else if (calendar.useEventBoxes === "Never") {
                    if (originalWidth < _step) {
                        min = originalWidth;
                    }
                    else {
                        min = 1;
                    }
                }

                if (newWidth < min) {
                    newWidth = min;
                    newLeft = right - newWidth;
                }

                DayPilotScheduler._resizingShadow.left = newLeft;
                DayPilotScheduler._resizingShadow.width = newWidth;
                DayPilotScheduler._resizingShadow.style.left = newLeft + "px";
                DayPilotScheduler._resizingShadow.style.width = newWidth + "px";
            }
            else {
                throw new DayPilot.Exception("Invalid dpBorder.");
            }

            calendar._updateResizingShadow();
            // calendar._doEventResizing();

        };

        this._moveShadow = function() {
            if (!calendar.coords) {
                return;
            }

            if (!DayPilotScheduler._movingEvent) {
                return;
            }

            var shadow = DayPilotScheduler._movingShadow;
            var coords = this._getShadowCoords(DayPilotScheduler._movingEvent);

            shadow.row = coords.row;
            shadow.style.height = DayPilot.Util.atLeast(coords.row.height, 0) + 'px';
            shadow.style.top = (coords.top) + 'px';
            shadow.style.left = coords.left + 'px';
            shadow.style.width = (coords.width) + 'px';
            shadow.start = coords.start;
            shadow.end = coords.end;
        };


        this._getTotalRowHeaderWidth = function() {
            return this.rowHeaderWidth;
        };

        this._getAreaRowsWithMargin = function() {
            return this._getAreaRows(calendar.progressiveRowRenderingPreload);
        };

        this._getAreaRows = function(margin) {
            margin = margin || 0;

            var start = 0;
            var end = calendar.rowlist.length;
            var progressive = calendar.progressiveRowRendering;
            if (progressive) {
                var area = calendar._getDrawArea();
                start = area.yStart;
                end = area.yEnd + 1;

                start = DayPilot.Util.atLeast(0, start - margin);
                end = Math.min(calendar.rowlist.length, end + margin);
            }

            return {
                "start": start,
                "end": end
            }
        };

        this._drawResHeader = function() {

            this._resHeaderDivBased = true;

            var totalWidth = this._getTotalRowHeaderWidth();

            clearHeader();

            var wrap = this.divHeader;
            wrap.style.width = totalWidth + "px";
            wrap.style.height = calendar._gridHeight + "px";
            calendar.divHeader = wrap;

            var progressive = calendar.progressiveRowRendering;
            if (progressive) {
                doNothing();
            }
            else {
                var m = this.rowlist.length;
                for (var i = 0; i < m; i++) {
                    calendar._drawRow(i);
                }
            }

            calendar._drawResScrollSpace();

            this.divResScroll.appendChild(wrap);

            function clearHeader() {
                var wrap = calendar.divHeader;

                if (wrap) {
                    wrap.rows = [];
                }

                var content = wrap;

                if (content) {
                    content.innerHTML = '';
                }

            }

        };

        this._drawResHeadersProgressive = function() {

            if (!calendar.progressiveRowRendering) {
                return;
            }

            var area = this._getAreaRowsWithMargin();

            for (var i = 0; i < calendar.rowlist.length; i++) {
                if (area.start <= i && i < area.end) {
                    calendar._drawRow(i);
                }
                else {
                    calendar._deleteRow(i);
                }
            }

        };

        this._drawResScrollSpace = function() {

            if (calendar._resolved._mobile()) {
                return;
            }

            var wrap = calendar.divHeader;

            var c = createDiv();
            c.style.position = "absolute";
            wrap.appendChild(c);

            calendar.nav.resScrollSpace = c;

            var div = createDiv();
            div.style.position = "relative";
            div.style.height = "100%";
            div.className = this._prefixCssClass("_rowheader");
            c.appendChild(div);


            var totalWidth = this._getTotalRowHeaderWidth();

            var c = calendar.nav.resScrollSpace;
            c.style.width = totalWidth + "px";
            c.style.top = this._gridHeight + "px";

        };

        this._deleteRow = function(i) {

            var row = calendar.divHeader.rows[i];

            if (!row) {
                return;
            }

            DayPilot.de(row);
            calendar.divHeader.rows[i] = null;
        };

        this._drawRowForced = function(i) {
            this._deleteRow(i);
            this._drawRow(i);
        };

        // TODO simplify, remove beforeRowRender
        this._drawRow = function(i) {

            var rowlist = calendar.rowlist;

            var divHeader = calendar.divHeader;

            if (!divHeader) {
                // ResizeObserver fires this in shortInit() when it's not rendered yet.
                return;
            }

            if (divHeader.rows[i]) { // already rendered
                return;
            }

            var totalWidth = this._getTotalRowHeaderWidth();

            var row = rowlist[i];

            if (!row) {  // not found
                return;
            }

            var args = this._doBeforeRowHeaderRender(row);


            var c = createDiv();
            c.style.position = "absolute";
            c.style.top = row.top + "px";

            divHeader.rows[i] = c;

            c.row = row;
            c.index = i;

            var props = args.row;

            var width = this.rowHeaderWidth;
            c.style.width = (width) + "px";
            c.style.border = "0px none";

            var toolTip = props.toolTip || props.toolTip;
            if (toolTip) {
                c.title = toolTip;
            }

            if (typeof props.ariaLabel !== "undefined") {
                c.setAttribute("aria-label", props.ariaLabel);
            }
            else {
                c.setAttribute("aria-label", props.text || "");
            }

            c.onclick = calendar._onResClick;

            var div = createDiv();
            div.style.width = (width) + "px";
            div.className = this._prefixCssClass('_rowheader');
            if (props.cssClass) {
                DayPilot.Util.addClass(div, props.cssClass);
            }
            if (props.cssClass) {
                DayPilot.Util.addClass(div, props.cssClass);
            }
            var backColor = props.backColor || props.backColor;
            if (backColor) {
                div.style.background = backColor;
            }
            var fontColor = props.fontColor || props.fontColor;
            if (fontColor) {
                div.style.color = fontColor;
            }
            var horizontalAlignment = props.horizontalAlignment || props.horizontalAlignment;

            if (horizontalAlignment) {
                div.style.textAlign = horizontalAlignment;
            }
            div.style.height = (row.height) + "px";
            div.style.overflow = 'hidden';
            div.style.position = 'relative';

            var inner = createDiv();
            inner.className = this._prefixCssClass('_rowheader_inner');

            switch (horizontalAlignment) {
                case "right":
                    inner.style.justifyContent = "flex-end";
                    break;
                case "left":
                    inner.style.justifyContent = "flex-start";
                    break;
                case "center":
                    inner.style.justifyContent = "center";
                    break;
            }

            div.appendChild(inner);

            var border = createDiv();
            border.style.position = "absolute";
            border.style.bottom = "0px";
            border.style.width = "100%";
            border.style.height = "0px";
            border.style.boxSizing = "content-box";
            border.style.borderBottom = "1px solid transparent";
            border.className = this._prefixCssClass("_resourcedivider");
            div.appendChild(border);

            var wrap = createDiv();
            var text = createDiv();
            text.innerHTML = calendar._xssTextHtml(props.text, props.html);
            text.className = calendar._prefixCssClass("_rowheader_inner_text");
            c.textDiv = text;
            c.cellDiv = div;

            wrap.appendChild(text);

            inner.appendChild(wrap);

            var va = props.verticalAlignment || props.verticalAlignment;

            if (va) {
                inner.style.display = "flex";
                switch (va) {
                    case "center":
                        inner.style.alignItems = "center";
                        break;
                    case "top":
                        inner.style.alignItems = "flex-start";
                        break;
                    case "bottom":
                        inner.style.alignItems = "flex-end";
                        break;
                }
            }

            c.appendChild(div);

            divHeader.appendChild(c);
            div.style.width = totalWidth + "px";
        };


        this._onResClick = function(ev) {
            var row = this.row;
            var r = calendar._createRowObject(row, this.index);
            calendar._rowClickDispatch(r, ev);
        };


        this._onTimeHeaderClick = function(ev) {

            if (calendar.timeHeaderClickHandling === "Disabled") {
                return;
            }

            var cell = {};

            cell.start = this.cell.start;
            cell.level = this.cell.level;
            cell.end = this.cell.end;
            if (!cell.end) {
                cell.end = new DayPilot.Date(cell.start).addMinutes(calendar._getCellDuration());
            }

            calendar._timeHeaderClickDispatch(cell);
        };

        this._onTimeHeaderRightClick = function(ev) {

            if (calendar.timeHeaderRightClickHandling === "Disabled") {
                return;
            }

            ev.cancelBubble = true;
            ev.preventDefault();

            var cell = {};

            cell.start = this.cell.start;
            cell.level = this.cell.level;
            cell.end = this.cell.end;
            if (!cell.end) {
                cell.end = new DayPilot.Date(cell.start).addMinutes(calendar._getCellDuration());
            }

            var args = {};
            args.header = cell;
            args.preventDefault = function() {
                this.preventDefault.value = true;
            };

            if (typeof calendar.onTimeHeaderRightClick === 'function') {
                calendar.onTimeHeaderRightClick(args);
                if (args.preventDefault.value) {
                    return;
                }
            }

            if (typeof calendar.onTimeHeaderRightClicked === 'function') {
                calendar.onTimeHeaderRightClicked(args);
            }
        };

        this._createRowObject = function(row) {
            return new DayPilot.Row(row, calendar);
        };

        this._ensureRowData = function(i) {

            var rowlist = calendar.rowlist;

            var row = rowlist[i];

            if (!row.events) {
                row.resetEvents();
            }
        };

        this._eventHashes = {};

        this._loadEvents = function(events) {
            if (events) {
                this.events.list = events;
            }
            else if (!this.events.list) {
                this.events.list = [];
            }

            if (this.events.list != null && !DayPilot.isArray(this.events.list)) {
                throw new DayPilot.Exception("DayPilot.Scheduler.events.list expects an array object");
            }

            eventloading.prepareRows(true);

            var list = this.events.list;

            var ober = typeof this.onBeforeEventRender === 'function';
            var rows;

            calendar._eventHashes = {};

            for (var j = 0; j < list.length; j++) {

                var edata = list[j];

                if (!edata) {
                    continue;
                }

                if (typeof edata !== "object") {
                    throw new DayPilot.Exception("Event data item must be an object");
                }
                if (!edata.start) {
                    throw new DayPilot.Exception("Event data item must specify 'start' property");
                }

                if (edata instanceof DayPilot.Event) {
                    throw new DayPilot.Exception("DayPilot.Scheduler: DayPilot.Event object detected in events.list array. Use raw event data instead.");
                    //edata = edata.data;
                }

                // validate id
                var validId = typeof edata.id === "string" || typeof edata.id === "number";
                if (!validId) {
                    throw new DayPilot.Exception("All events must have an id property (string or number)");
                }

                // check id duplicity, backwards compatible with server-side recurrence support
                var hash = "_" + edata.id;
                if (calendar._eventHashes[hash]) {
                    throw new DayPilot.Exception("Duplicate event IDs are not allowed: " + hash);
                }
                calendar._eventHashes[hash] = true;

                if (ober) {
                    this._doBeforeEventRender(j);
                }

                rows = calendar._rowcacheFor(edata.resource);

                for (var x = 0; rows && x < rows.length; x++) {
                    var row = rows[x];
                    var ep = this._loadEvent(edata, row);

                    if (!ep) {
                        continue;
                    }

                    if (ober) {
                        ep.cache = this._cache.events[j];
                    }
                }
            }

            // sort events inside rows
            var rowlist = calendar.rowlist;
            rowlist.forEach(function(row) {
                calendar._loadRow(row);
            });

            calendar._updateRowHeights();
        };

        // assumes rows collection is created

        this._eventloading = {};
        var eventloading = this._eventloading;

        eventloading.rowcache = {};

        eventloading.prepareRows = function(resetEvents) {
            eventloading.rowcache = {};
            var rows = calendar.rowlist;

            // initialize
            for (var i = 0; i < rows.length; i++) {
                var row = rows[i];
                if (resetEvents) {
                    row.resetEvents();
                }
                calendar._ensureRowData(row.index);

                if (!row.id) {
                    continue;
                }
                var key = typeof row.id + "_" + row.id;
                if (!eventloading.rowcache[key]) {
                    eventloading.rowcache[key] = [];
                }
                eventloading.rowcache[key].push(row);
            }
        };

        eventloading.loadEvent = function(edata) {

        };

        this._rowcacheFor = function(id) {
            var key = typeof id + "_" + id;
            return eventloading.rowcache[key] || [];
        };

        this._containsDuplicateResources = function() {
            var idlist = {};

            for (var i = 0; i < calendar.rowlist.length; i++) {
                var row = calendar.rowlist[i];
                var id = row.id;
                if (idlist[id]) {
                    return true;
                }
                idlist[id] = true;
            }
            return false;
        };

        this._doBeforeEventRender = function(i) {
            var cache = this._cache.events;
            var data = this.events.list[i];
            var evc = {};

            if (data instanceof DayPilot.Event) {
                data = data.data;
            }

            // make a copy
            for (var name in data) {
                evc[name] = data[name];
            }

            if (typeof evc.start === "string") {
                evc.start = new DayPilot.Date(evc.start);
            }
            if (typeof evc.end === "string") {
                evc.end = new DayPilot.Date(evc.end);
            }

            if (typeof this.onBeforeEventRender === 'function') {
                var args = {};
                args.e = evc;
                args.data = evc;
                this.onBeforeEventRender(args);
            }

            cache[i] = evc;

        };

        // internal
        this._loadRow = function(row) {
            row.lines = [];
            row.sections = null;
            row.events.sort(this._eventComparer);

            for (var j = 0; j < row.events.length; j++) {
                var e = row.events[j];
                row.putIntoLine(e);
            }
        };

        // internal
        this._loadRows = function(rows) {  // row indices
            rows = DayPilot.ua(rows); // unique
            rows = calendar._ensureRowsArray(rows);

            rows.forEach(function(row) {
                calendar._loadRow(row);
            });

            rows.forEach(function(row) {
                calendar._updateEventPositionsInRow(row);
            });

        };

        this._loadEvent = function(e, row) {

            var start = new DayPilot.Date(e.start);
            var end = new DayPilot.Date(e.end);

            end = calendar._adjustEndIn(end);

            var startTicks = start.ticks;
            var endTicks = end.ticks;

            var schedulerStartTicks = calendar.startDate.ticks;
            var schedulerEndTicks = calendar.startDate.addDays(calendar.days).ticks;

            if (endTicks < startTicks) {  // skip invalid events
                return null;
            }

            var cache = null;
            if (typeof calendar.onBeforeEventRender === 'function') {
                var index = DayPilot.indexOf(calendar.events.list, e);
                cache = calendar._cache.events[index];
            }

            var belongsHere = row.id === e.resource && (!(endTicks <= schedulerStartTicks || startTicks >= schedulerEndTicks) || (startTicks === endTicks && startTicks === schedulerStartTicks));

            if (!belongsHere) {
                return null;
            }

            var ep = new DayPilot.Event(e, calendar); // event part
            ep.part.dayIndex = calendar.rowlist.indexOf(row);
            ep.part.start = schedulerStartTicks < startTicks ? start : calendar.startDate;
            ep.part.end = schedulerEndTicks > endTicks ? end : calendar.startDate.addDays(calendar.days);

            var partStartPixels = this.getPixels(ep.part.start);
            var partEndPixels = this.getPixels(ep.part.end.addTime(-1));

            if (ep.part.start === ep.part.end) {
                partEndPixels = this.getPixels(ep.part.end.addMilliseconds(1));
            }

            var left = partStartPixels.left;
            var right = partEndPixels.left;

            var useBox =  resolved._useBox(endTicks - startTicks);

            if (useBox) {
                var boxLeft = partStartPixels.boxLeft;
                var boxRight = partEndPixels.boxRight;

                ep.part.left = boxLeft;
                ep.part.width = boxRight - boxLeft;
                ep.part.barLeft = Math.max(left - ep.part.left, 0);  // minimum 0
                ep.part.barWidth = Math.max(right - left, 1);  // minimum 1
            }
            else {
                ep.part.left = left;
                ep.part.width = Math.max(right - left, 1);
                ep.part.barLeft = 0;
                ep.part.barWidth = Math.max(right - left - 1, 1);
            }

            var minWidth = calendar.eventMinWidth;
            ep.part.width = Math.max(ep.part.width, minWidth);
            ep.part.right = ep.part.left + ep.part.width;
            ep.cache = cache;  // duplicate, but needed here

            row.events.push(ep);

            return ep;

        };

        this._eventComparer = function(a, b) {
            if (!a || !b || !a.start || !b.start) {
                return 0; // no sorting, invalid arguments
            }

            var byStart = a.start().ticks - b.start().ticks;
            if (byStart !== 0) {
                return byStart;
            }

            var byEnd = b.end().ticks - a.end().ticks; // desc
            return byEnd;
        };


        this.rows = {};

        this.rows.all = function() {
            var list = [];
            for(var i = 0; i < calendar.rowlist.length; i++) {
                var r = calendar._createRowObject(calendar.rowlist[i]);
                list.push(r);
            }
            return list;

        };

        this.rows.each = function(f) {
            calendar.rows.all().forEach(f);
        };

        this.rows.forEach = function(f) {
            calendar.rows.all().forEach(f);
        };

        this.rows.find = function(param, start) {
            if (typeof param === "string" || typeof param === "number" || (!param && start)) {
                var matchingRows = calendar._rowcacheFor(param);

                if (!param) {
                    matchingRows = calendar.rowlist;
                }

                var first = null;
                if (typeof start === "string" || start instanceof DayPilot.Date) {
                    start = new DayPilot.Date(start);
                    first = matchingRows.find(function(item) {
                        return start === item.start;
                    });
                }
                else {
                    first = matchingRows[0];
                }

                if (first) {
                    return new DayPilot.Row(first, calendar);
                }
                return null;
            }
            else if (typeof param === "function") {
                var index = start || 0;
                var r = calendar.rowlist.find(function(r, i) {
                    if (i < index) {
                        return false;
                    }
                    var row = calendar._createRowObject(r);
                    return param(row);
                });
                if (r) {
                    return calendar._createRowObject(r);
                }
            }
            else {
                throw new DayPilot.Exception("Invalid rows.find() argument: id or function expected");
            }
        };

        this.rows.load = function(url, success, error) {

            if (!url) {
                throw new DayPilot.Exception("rows.load(): 'url' parameter required");
            }

            var onError = function(args) {
                var largs = {};
                largs.exception = args.exception;
                largs.request = args.request;

                if (typeof error === 'function') {
                    error(largs);
                }
            };

            var onSuccess = function(args) {
                var r = args.request;
                var data;

                // it's supposed to be JSON
                try {
                    data = JSON.parse(r.responseText);
                }
                catch (e) {
                    var fargs = {};
                    fargs.exception = e;
                    onError(fargs);
                    return;
                }

                if (DayPilot.isArray(data)) {
                    var sargs = {};
                    sargs.preventDefault = function() {
                        this.preventDefault.value = true;
                    };
                    sargs.data = data;
                    if (typeof success === "function") {
                        success(sargs);
                    }

                    if (sargs.preventDefault.value) {
                        return;
                    }

                    calendar.resources = sargs.data;
                    if (calendar._initialized) {
                        calendar.update();
                    }
                }
            };

            var usePost = calendar.rowsLoadMethod && calendar.rowsLoadMethod.toUpperCase() === "POST";

            if (usePost) {
                DayPilot.ajax({
                    "method": "POST",
                    "url": url,
                    "success": onSuccess,
                    "error": onError
                });
            }
            else {
                DayPilot.ajax({
                    "method": "GET",
                    "url": url,
                    "success": onSuccess,
                    "error": onError
                });
            }
        };

        // row - DayPilot.Row object
        this.rows.remove = function(row) {
            if (typeof row === "number" || typeof row === "string") {
                var rf = calendar.rows.find(row);
                if (!rf) {
                    throw new DayPilot.Exception("The row to be removed was not found");
                }
                calendar.rows.remove(rf);
                return;
            }

            var data = row.$.row.resource;

            var sourceIndex = DayPilot.indexOf(calendar.resources, data);
            calendar.resources.splice(sourceIndex, 1);

            calendar.update();
        };

        this.rows.add = function(data) {
            calendar.resources.push(data);
            calendar._update();
        };

        // not supported to be changed: id, children
        this.rows.update = function(row) {
            if (!(row instanceof DayPilot.Row || typeof row === "object")) {
                throw new DayPilot.Exception("DayPilot.Scheduler.rows.update() expects a DayPilot.Row object or a data object.");
            }
            if (!(row instanceof DayPilot.Row)) {
                var data = row;
                row = calendar.rows.find(data.id);
                if (!row) {
                    return;
                }
                row.data = data;
            }

            var index = row.index;
            var rowlist = calendar.rowlist;

            var oldRow = rowlist[index];
            var res = row.data;

            var parent = row.parent() ? row.parent().$.row : null;

            var rcustomized = calendar._createRowParams(res);

            var row = calendar._createRowFromResource(rcustomized, parent);
            row.level = oldRow.level;
            row.index = index;
            row.top = oldRow.top;
            row.height = oldRow.height;
            rowlist[index] = row;

            row.resetEvents();
            calendar._ensureRowData(row.index);

            calendar._loadEventsForRow(row);
            calendar._loadRow(row);
            calendar._drawRowForced(row.index);

            calendar._deleteCells();
            calendar._drawCells();
        };

        this._loadEventsForRow = function(row) {
            var events = calendar.events.list;
            var listlength = events.length;
            var ober = typeof calendar.onBeforeEventRender  === "function";

            for (var j = 0; j < listlength; j++) {

                var edata = events[j];

                if (!edata) {
                    continue;
                }

                if (edata instanceof DayPilot.Event) {
                    throw new DayPilot.Exception("DayPilot.Scheduler: DayPilot.Event object detected in events.list array. Use raw event data instead.");
                }

                var belongsHere = edata.resource === row.id;

                if (!belongsHere) {
                    continue;
                }

                if (ober) {
                    this._doBeforeEventRender(j);
                }

                var ep = this._loadEvent(edata, row);

                if (!ep) {
                    continue;
                }

                if (ober) {
                    ep.cache = this._cache.events[j];
                }
            }
        };




        this._loadResources = function() {
            var resources = this.resources;

            // pass by reference
            var index = {};
            index.i = 0;

            if (resources != null && !DayPilot.isArray(resources)) {
                throw new DayPilot.Exception("DayPilot.Scheduler.resources expects an array object");
            }

            resources = resources || [];

            calendar.rowlist = [];
            this._loadResourcesFromArray(resources);

        };

        this._visibleStart = function() {
            return new DayPilot.Date(this.startDate);
        };

        this._visibleEnd = function() {
            var start = new DayPilot.Date(calendar.startDate);
            return start.addDays(calendar.days);
        };

        this.visibleStart = function() {
            return this._visibleStart();
        };

        this.visibleEnd = function() {
            return this._visibleEnd();
        };

        this._createRowFromResource = function(res) {
            var row = {};

            // defined values
            row.backColor = res.backColor;
            row.fontColor = res.fontColor;
            row.cssClass = res.cssClass;
            row.name = res.name;
            row.html = calendar._xssTextHtml(res.name, res.html);
            row.id = res.id;
            row.toolTip = res.toolTip;

            // custom properties
            row.tags = res.tags;

            // calculated
            row.height = calendar.eventHeight;
            row.level = 0;

            // reference to resource
            row.resource = res._data;

            // event ordering
            row.lines = [];

            row.isRow = true;

            // functions
            row.getHeight = function() {
                return Math.max(calendar.eventHeight, this.lines.length * calendar.eventHeight);
            };

            row.resetEvents = function() {
                var r = this;
                r.events = [];
                r.events.forRange = function(start, end) {
                    start = new DayPilot.Date(start);
                    end = end ? new DayPilot.Date(end) : calendar.startDate.addDays(calendar.days);
                    var result = [];
                    for (var i = 0; i < r.events.length; i++) {
                        var ev = r.events[i];
                        var evEnd = calendar._adjustEndIn(ev.end());
                        if (DayPilot.Util.overlaps(ev.start(), evEnd, start, end)) {
                            result.push(ev);
                        }
                    }
                    return result;
                };
            };

            row._createLine = function() {
                // create a new line
                var line = [];
                line.add = function(ep) {
                    this.push(ep);
                };
                line.isFree = function(colStart, colWidth, except) {
                    var end = colStart + colWidth - 1;
                    var max = this.length;

                    for (var i = 0; i < max; i++) {
                        var e = this[i];
                        if (!(end < e.part.left || colStart > e.part.left + e.part.width - 1)) {
                            if (DayPilot.contains(except, e.data)) {
                                continue;
                            }
                            return false;
                        }

                    }

                    return true;
                };

                return line;
            };

            // pixel-based
            row.findFreeLine = function(left, width) {

                // check space in existing lines
                for (var i = 0; i < this.lines.length; i++) {
                    var line = this.lines[i];
                    if (line.isFree(left, width)) {
                        return i;
                    }
                }

                var line = row._createLine();
                this.lines.push(line);
                return this.lines.length - 1;
            };

            row.putIntoLine = function(ep) {
                var i = row.findFreeLine(ep.part.left, ep.part.width);
                this.lines[i].add(ep);
                return i;
            };

            return row;

        };

        this._loadResourcesFromArray = function(resources) {
            if (!resources) {
                return;
            }

            var rowlist = calendar.rowlist;

            for (var i = 0; i < resources.length; i++) {
                if (!resources[i]) {
                    continue;
                }

                var additional = {};
                additional.index = i;

                var res = this._createRowParams(resources[i], additional);
                var row = calendar._createRowFromResource(res, parent);

                row.index = i;
                rowlist.push(row);

            }
        };

        this._doBeforeRowHeaderRender = function(row) {
            var args = {};
            args.row = this._createRowObject(row);

            DayPilot.Util.copyProps(row, args.row, ['html', 'backColor', 'fontColor', 'cssClass', 'toolTip']);

            if (typeof this.onBeforeRowHeaderRender === "function") {
                this.onBeforeRowHeaderRender(args);
            }

            return args;
        };

        this._createRowParams = function(res, additional) {
            var r = {
                get $data() { return this._data; }
            };

            // extra properties like level, index, hidden
            for (var name in additional) {
                r[name] = additional[name];
            }

            // shallow copy
            for (var name in res) {
                r[name] = res[name];
            }

            r.html = calendar._xssTextHtml(res.name, res.html);
            r._data = res;

            return r;
        };


        this._initPrepareDiv = function() {
            this.nav.top.dp = this;
            this.nav.top.innerHTML = "";
            DayPilot.Util.addClass(this.nav.top, this._prefixCssClass("_main"));

            this.nav.top.setAttribute("role", "region");
            this.nav.top.setAttribute("aria-label", "scheduler");

            this.nav.top.style.userSelect = 'none';
            this.nav.top.style.webkitUserSelect = 'none';

            this.nav.top.style.WebkitTapHighlightColor = "rgba(0,0,0,0)";
            this.nav.top.style.WebkitTouchCallout = "none";

            if (this.width) {
                this.nav.top.style.width = this.width;
            }
            this.nav.top.style.lineHeight = "1.2";
            this.nav.top.style.position = "relative";

            if (!this.visible) {
                this.nav.top.style.display = "none";
            }

            this.nav.top.ontouchstart = touch._onMainTouchStart;
            this.nav.top.ontouchmove = touch._onMainTouchMove;
            this.nav.top.ontouchend = touch._onMainTouchEnd;

            var rowHeaderWidth = this.rowHeaderWidth;

            // left
            var left = createDiv();
            left.style.position = "absolute";
            left.style.left = "0px";
            left.style.width = (rowHeaderWidth) + "px";

            // divider horizontal
            var dh1 = createDiv();
            // prevent the line from disappearing for zoom < 100%
            // dh1.style.height = "1px";
            dh1.style.height = "0px";
            dh1.style.boxSizing = "content-box";
            dh1.style.borderTop = "1px solid transparent";
            dh1.className = this._prefixCssClass("_divider_horizontal");
            this.nav.dh1 = dh1;

            this.nav.left = left;

            left.appendChild(this._drawCorner());
            left.appendChild(dh1);
            left.appendChild(this._drawResScroll());

            // divider
            var divider = createDiv();
            divider.style.position = "absolute";
            divider.style.left = (rowHeaderWidth) + "px";
            divider.style.width = "1px";
            divider.style.height = (this._getTotalHeaderHeight() + this._getScrollableHeight()) + "px";
            divider.className = this._prefixCssClass("_splitter");
            this.nav.divider = divider;

            // right
            var right = createDiv();
            right.style.marginLeft = (rowHeaderWidth + 1) + "px";
            right.style.marginRight = '1px';
            right.style.position = 'relative';

            this.nav.right = right;

            // divider horizontal #2
            var dh2 = createDiv();
            dh2.style.position = "absolute";
            dh2.style.top = this._getTotalHeaderHeight() + "px";
            dh2.style.width = "100%";
            // dh2.style.height = "1px";

            dh2.style.height = "1px";
            dh2.style.boxSizing = "border-box";
            dh2.style.borderBottom = "1px solid transparent";
            dh2.setAttribute("data-dh2", "true");

            dh2.className = this._prefixCssClass("_divider_horizontal");
            this.nav.dh2 = dh2;

            right.appendChild(calendar._drawTimeHeaderDiv());
            right.appendChild(calendar._drawMainContent());
            right.appendChild(dh2);

            // clear
            var clear = createDiv();
            clear.style.clear = 'left';

            var dividerTop = createDiv();
            dividerTop.style.height = "1px";
            dividerTop.style.position = "absolute";
            dividerTop.style.left = "0px";
            dividerTop.style.right = "0px";
            dividerTop.style.display = "none";
            dividerTop.className = this._prefixCssClass("_divider_horizontal");
            this.nav.dividerTop = dividerTop;

            var dividerBottom = createDiv();
            dividerBottom.style.height = "1px";
            dividerBottom.style.position = "absolute";
            dividerBottom.style.left = "0px";
            dividerBottom.style.right = "0px";
            dividerBottom.style.display = "none";
            dividerBottom.className = this._prefixCssClass("_divider_horizontal") + " " + this._prefixCssClass("_divider_horizontal_frozen_bottom");
            this.nav.dividerBottom = dividerBottom;

            // add all at once
            this.nav.top.appendChild(left);
            this.nav.top.appendChild(divider);
            this.nav.top.appendChild(right);
            this.nav.top.appendChild(clear);
            this.nav.top.appendChild(dividerTop);
            this.nav.top.appendChild(dividerBottom);
        };


        // update all positions that depend on header height
        this._updateHeaderHeight = function() {
            var height = this._getTotalHeaderHeight();

            if (this.nav.corner) {
                this.nav.corner.style.height = (height) + "px";
            }

            if (this.divTimeScroll) {
                this.divTimeScroll.style.height = height + "px";
            }

            if (this.divNorth) {
                this.divNorth.style.height = height + "px";
            }

            if (this.nav.dh1 && this.nav.dh2) {
                this.nav.dh1.style.top = height + "px";
                this.nav.dh2.style.top = height + "px";
            }

            this.nav.scroll.style.top = (height + 1) + "px";
        };


        this._updateRowHeaderWidthOuter = function() {
            var dividerWidth = 1;

            var width = this.rowHeaderWidth;
            if (this.nav.corner) this.nav.corner.style.width = width + "px";
            this.divResScroll.style.width = width + "px";

            this.nav.left.style.width = (width) + "px";
            this.nav.divider.style.left = (width - dividerWidth) + "px";
            this.nav.right.style.marginLeft = (width) + "px";

        };

        this._updateRowHeaderWidthInner = function() {
            var total = this.rowHeaderWidth;
            var table = this.divHeader;
            table.style.width = total + "px";

            var range = calendar._getAreaRowsWithMargin();

            for (var i = range.start; i < range.end; i++) {
                var row = table.rows[i];

                if (!row) {
                    continue;
                }

                var width = calendar.rowHeaderWidth;
                row.style.width = width + "px";
                var div = row.firstChild;
                div.style.width = width + "px";

            }

            if (calendar.nav.resScrollSpace) {
                calendar.nav.resScrollSpace.style.width = total + "px";
            }

        };

        this._updateRowHeaderWidth = function() {
            this._updateRowHeaderWidthOuter();
            this._updateRowHeaderWidthInner();
        };

        this._drawCorner = function() {
            var rowHeaderWidth = this.rowHeaderWidth;

            var div = createDiv();
            calendar.nav.corner = div;
            div.style.width = rowHeaderWidth + "px";
            div.style.height = (this._getTotalHeaderHeight()) + "px";
            div.style.overflow = 'hidden';
            div.style.position = 'relative';
            div.oncontextmenu = function() { return false; };
            div.className = this._prefixCssClass('_corner');

            var inner = createDiv();
            inner.style.position = "absolute";
            inner.style.top = "0px";
            inner.style.left = "0px";
            inner.style.right = "0px";
            inner.style.bottom = "0px";
            inner.className = this._prefixCssClass('_corner_inner');
            inner.innerHTML = '&nbsp;';
            this.divCorner = inner;

            div.appendChild(inner);

            return div;
        };

        this._getTotalHeaderHeight = function() {
            if (calendar.timeHeaders) {
                return calendar.timeHeaders.length * calendar.headerHeight;
            }
            else {
                return 0;
            }
        };

        this._rowHeaderScrollSyncTimeout = null;

        this._drawResScroll = function() {
            var div = createDiv();
            div.style.width = (this.rowHeaderWidth) + "px";
            div.style.height = this._getScrollableHeight() + "px";
            div.style.overflow = 'hidden';
            div.style.position = 'relative';
            div.className = calendar._prefixCssClass("_rowheader_scroll"); // divResScroll

            var mobile = calendar._resolved._mobile();

            if (mobile) {
                div.style.overflowY = "auto";
            }

            div.ontouchstart = function() {
                DayPilotScheduler._touchingRes = true;
            };

            div.oncontextmenu = function() { return false; };

            div.onscroll = function() {
                if (calendar._rowHeaderScrollSyncTimeout) {
                    clearTimeout(calendar._rowHeaderScrollSyncTimeout);
                }

                if (mobile) {
                    var f = function() {
                        var maxScrollY = calendar._getScrollableInnerHeight() - calendar.nav.scroll.offsetHeight;
                        div.scrollTop = Math.min(div.scrollTop, maxScrollY);
                        calendar.nav.scroll.scrollTop = div.scrollTop;
                    };
                    if (ios) {
                        if (DayPilotScheduler._touchingRes) {
                            calendar._rowHeaderScrollSyncTimeout = setTimeout(f, 10);
                        }
                    }
                    else {
                        calendar._rowHeaderScrollSyncTimeout = setTimeout(f, 10);
                    }
                }
                else {
                    calendar._rowHeaderScrollSyncTimeout = setTimeout(function() {
                        calendar.nav.scroll.scrollTop = div.scrollTop;
                    }, 500);

                    // delay of 10ms causes jerky scrolling in firefox

                    // calendar.nav.scroll.scrollTop = div.scrollTop;
                }
            };

            div.setAttribute("role", "region");
            div.setAttribute("aria-label", "scheduler rows");

            var wrap = createDiv();
            this.divHeader = wrap;

            div.appendChild(wrap);

            this.divResScroll = div;

            this._scrollRes = div;

            return div;
        };

        this._wd = null;
        this._watchObserver = null;
        this._watchWidthChanges = function() {

            var fix = function() {
                calendar._resize();
                calendar._onScroll();
            };

            var detect = function() {

                var top = calendar.nav.top;

                if (!top) {
                    return;
                }

                if (!calendar._wd) {
                    calendar._wd = {};
                    calendar._wd.width = top.offsetWidth;
                    return;
                }

                var widthChanged = calendar._wd.width !== top.offsetWidth;

                if (widthChanged) {
                    calendar._wd.width = top.offsetWidth;
                    fix();
                }
            };

            if (calendar._watchObserver) {
                return;
            }

            var observer = new ResizeObserver(DayPilot.debounce(detect, 100));
            observer.observe(calendar.nav.top);
            calendar._watchObserver = observer;
        };

        this._resize = function() {

            if (calendar._disposed) {
                return;
            }

            calendar._updateHeight();
            calendar._updateSelectionPosition();
            calendar._cache.drawArea = null;
        };

        this._updateSelectionPosition = function() {
            var range = calendar._rangeHold;
            calendar.clearSelection();
            calendar._rangeHold = range;
            calendar._drawRange(range, {"justDraw": true});
        };

        this._drawTimeHeaderDiv = function() {

            var div = createDiv();
            div.style.overflow = 'hidden';
            div.style.display = 'block';
            div.style.position = 'absolute';
            div.style.top = "0px";
            div.style.width = "100%";
            div.style.height = this._getTotalHeaderHeight() + "px";
            div.style.overflow = "hidden";
            div.className = calendar._prefixCssClass("_timeheader_scroll");

            this.divTimeScroll = div;

            var inner = createDiv();
            inner.style.width = (this._getGridWidth() + 5000) + "px";

            this.divNorth = inner;

            div.appendChild(inner);

            return div;
        };

        this._getScrollableHeight = function() {
            var height = 0;
            var spec = calendar.heightSpec;
            if (spec === 'Fixed') {
                return this.height ? this.height : 0;
            }
            else {
                height = calendar._getScrollableInnerHeight();
            }

            var maxMode = spec === "Max";

            if (maxMode && height > calendar.height) {
                return calendar.height;
            }

            return height;

        };

        this._getScrollableInnerHeight = function() {
            var height;
            if (this._gridHeight !== -1) {
                height = this._gridHeight;
                if (this._gridHeight > 0 && calendar.nav.scroll.style.overflowX === "auto") {
                    height += DayPilot.sh(calendar.nav.scroll) + 1;
                }
            }
            else {
                height = this.rowlist.length * calendar.eventHeight;
            }
            return height;
        };

        this._drawMainContent = function() {

            var div = createDiv();
            div.style.overflow = "auto";
            div.style.overflowX = "auto";
            div.style.overflowY = "auto";

            div.style.height = (this._getScrollableHeight()) + "px";
            div.style.top = (this._getTotalHeaderHeight() + 1) + "px";
            div.style.position = "absolute";
            div.style.width = "100%";
            div.className = this._prefixCssClass("_scrollable");
            div.oncontextmenu = function() { return false; };

            this.nav.scroll = div;

            this._maind = createDiv();
            var maind = this._maind;

            maind.style.userSelect = "none";
            maind.style.webkitUserSelect = "none";
            maind.calendar = this;
            maind.style.position = 'absolute';

            var gridwidth = this._getGridWidth();
            if (gridwidth > 0) {
                maind.style.width = (gridwidth) + "px";
            }

            maind.onmousedown = this._onMaindMouseDown;
            maind.onmousemove = this._onMaindMouseMove;
            maind.onmouseup = this._onMaindMouseUp;
            maind.oncontextmenu = this._onMaindRightClick;

            maind.className = this._prefixCssClass("_matrix");

            this.divStretch = createDiv();
            this.divStretch.style.position = 'absolute';
            this.divStretch.style.height = '1px';
            maind.appendChild(this.divStretch);

            this.divCells = createDiv();
            this.divCells.style.position = 'absolute';
            this.divCells.oncontextmenu = this._onMaindRightClick;
            maind.appendChild(this.divCells);

            this.divLines = createDiv();
            this.divLines.style.position = 'absolute';
            this.divLines.oncontextmenu = this._onMaindRightClick;
            maind.appendChild(this.divLines);

            this.divSeparators = createDiv();
            this.divSeparators.style.position = 'absolute';
            this.divSeparators.oncontextmenu = this._onMaindRightClick;
            maind.appendChild(this.divSeparators);

            this.divRange = createDiv();
            this.divRange.style.position = 'absolute';
            this.divRange.oncontextmenu = this._onMaindRightClick;
            maind.appendChild(this.divRange);

            this.divEvents = createDiv();
            this.divEvents.style.position = 'absolute';
            maind.appendChild(this.divEvents);

            this.divShadow = createDiv();
            this.divShadow.style.position = 'absolute';
            maind.appendChild(this.divShadow);

            div.appendChild(maind);

            return div;
        };

        this._registerGlobalHandlers = function() {
            if (!DayPilotScheduler._globalHandlers) {
                DayPilotScheduler._globalHandlers = true;
                DayPilot.re(document, 'mouseup', DayPilotScheduler._gMouseUp);
                DayPilot.re(document, 'touchmove', DayPilotScheduler._gTouchMove);
                DayPilot.re(document, 'touchend', DayPilotScheduler._gTouchEnd);
            }
        };

        this._registerOnScroll = function() {
            this.nav.scroll.root = this;  // might not be necessary
            this.nav.scroll.onscroll = this._onScroll;

            calendar._scrollPos = this.nav.scroll.scrollLeft;
            calendar._scrollTop = this.nav.scroll.scrollTop;
            if (this.divNorth) {
                calendar._scrollWidth = this.divNorth.clientWidth; // divScroll might not be available (if there are no resources)
            }

        };

        this._batch = {};
        this._batch.step = 300;
        this._batch.delay = 10;
        this._batch.mode = "display";
        this._batch.layers = false;

        this._updateEventPositionsInRow = function(row) {

            var lineTop = 0;
            for (var j = 0; j < row.lines.length; j++) {
                var line = row.lines[j];

                for (var k = 0; k < line.length; k++) {
                    var e = line[k];

                    e.part.line = j;
                    e.part.top = lineTop;
                    e.part.right = e.part.left + e.part.width;
                }
                lineTop += calendar.eventHeight;
            }
        };

        this._drawEventsTimeout = null;

        // batch rendering flushes events in 10-item batches
        this._drawEvents = function(batch) {

            if (calendar._disposed) {
                return;
            }

            var step = this._batch.step;  // batch size
            if (this._batch.mode === 'display') {
                this.divEvents.style.display = 'none';
            }
            else if (this._batch.mode === 'visibility') {
                this.divEvents.style.visibility = 'hidden';
            }

            this.divEvents.setAttribute("role", "region");
            this.divEvents.setAttribute("aria-label", "scheduler events");

            var dynamic = this.dynamicEventRendering === 'Progressive';
            var area = this._getDrawArea();
            var top = area.pixels.top;
            var bottom = area.pixels.bottom;

            var rowlist = calendar.rowlist.filter(function(row) {
                var rowTop = row.top - calendar.dynamicEventRenderingMargin;
                var rowBottom = rowTop + row.height + 2 * calendar.dynamicEventRenderingMargin;
                if (dynamic && (bottom <= rowTop || top >= rowBottom)) {
                    return false;
                }
                return true;
            });

            rowlist.forEach(function(row) {

                calendar._updateEventPositionsInRow(row);

                for (var j = 0; j < row.lines.length; j++) {
                    var line = row.lines[j];
                    for (var k = 0; k < line.length; k++) {
                        var e = line[k];
                        var rendered = calendar._drawEvent(e);

                        if (batch && rendered) {
                            step--;
                            // flush
                            if (step <= 0) {
                                calendar.divEvents.style.visibility = '';
                                calendar.divEvents.style.display = '';
                                calendar._drawEventsTimeout = setTimeout(function() { calendar._drawEvents(batch); }, calendar._batch.delay);
                                //var end = new Date().getTime();
                                return;
                            }
                        }
                    }
                }
            });

            this.divEvents.style.display = '';

            this._findEventsInViewPort();
        };

        this._drawEventsInRow = function(rowIndex) {

            var row = calendar.rowlist[rowIndex];
            this._updateEventPositionsInRow(row);

            for (var j = 0; j < row.lines.length; j++) {
                var line = row.lines[j];
                for (var k = 0; k < line.length; k++) {
                    var e = line[k];
                    this._drawEvent(e);
                }
            }
        };

        this._deleteEvents = function() {
            if (this.elements.events) {
                var length = this.elements.events.length;

                for (var i = 0; i < length; i++) {
                    var div = this.elements.events[i];
                    this._deleteEvent(div);
                }
            }
            this.elements.events = [];
        };

        this._deleteEventsInRow = function(rowIndex) {

            if (this.elements.events) {
                var length = this.elements.events.length;
                var removed = [];

                for (var i = 0; i < length; i++) {
                    var div = this.elements.events[i];
                    var e = div.event;
                    if (e.part.dayIndex === rowIndex) {
                        this._deleteEvent(div);
                        removed.push(i);
                    }
                }

                for (var i = removed.length - 1; i >= 0; i--) {
                    this.elements.events.splice(removed[i], 1);
                }
            }

        };

        this._deleteEvent = function(div) {

            div.remove();

            // direct event handlers
            div.onclick = null;
            div.oncontextmenu = null;
            div.onmouseover = null;
            div.onmouseout = null;
            div.onmousemove = null;
            div.onmousedown = null;
            div.ondblclick = null;

            if (div.event) {
                div.event.rendered = null;
                div.event = null;
            }

        };

        // deletes events that are out of the current view
        // keeps the last "keepPlus" number of events outside of the view
        this._deleteOldEvents = function() {
            if (this.dynamicEventRendering !== 'Progressive') {
                return;
            }

            var deleteOld = calendar.dynamicEventRenderingCacheSweeping;  // deletes old events (outside of the visible area)
            if (!deleteOld) {
                return;
            }

            var keepPlus = calendar.dynamicEventRenderingCacheSize || 0;  // how many old events should be kept visible (cached)

            this.divEvents.style.display = 'none';

            var updated = [];

            var deleted = 0;

            var length = this.elements.events.length;
            for (var i = length - 1; i >= 0; i--) {
                var div = this.elements.events[i];
                if (this._oldEvent(div.event)) {
                    if (keepPlus > 0) {
                        keepPlus--;
                        updated.unshift(div);
                    }
                    else {
                        this._deleteEvent(div);
                        deleted++;
                    }
                }
                else {
                    updated.unshift(div);
                }
            }

            this.elements.events = updated;

            this.divEvents.style.display = '';
        };

        this._deleteOldCells = function(keepPlus) {
            var area = this._getDrawArea();
            var length = this.elements.cells.length;
            for (var i = length - 1; i >= 0; i--) {
                var div = this.elements.cells[i];

                var visible = (area.xStart < div.coords.x && div.coords.x <= area.xEnd) && (area.yStart < div.coords.y && div.coords.y <= area.yEnd);

                if (!visible) {
                    if (keepPlus > 0) {
                        keepPlus--;
                    }
                    else {
                        this._deleteCell(div);
                    }
                }
            }
        };

        this._deleteCell = function(div) {
            if (!div) {
                return;
            }
            if (!div.coords) {
                return;
            }
            var x = div.coords.x;
            var y = div.coords.y;

            // remove div
            DayPilot.rfa(calendar.elements.cells, div);
            DayPilot.de(div);

            calendar._cache.cells[x + "_" + y] = null;
        };

        this._hiddenEvents = function() {
            var dynamic = this.dynamicEventRendering === 'Progressive';

            if (!this.nav.scroll) {
                return false;
            }
            var top = this.nav.scroll.scrollTop;
            var bottom = top + this.nav.scroll.clientHeight;

            for (var i = 0; i < this.rowlist.length; i++) {

                var row = this.rowlist[i];

                var rowTop = row.top;
                var rowBottom = row.top + row.height;
                if (dynamic && (bottom <= rowTop || top >= rowBottom)) {
                    continue;
                }

                for (var j = 0; j < row.lines.length; j++) {
                    var line = row.lines[j];
                    for (var k = 0; k < line.length; k++) {
                        var e = line[k];
                        if (this._hiddenEvent(e)) {
                            return true;
                        }
                    }
                }

            }

            return false;
        };

        this._hiddenEvent = function(data) {
            if (data.rendered) {
                return false;
            }

            var dynamic = this.dynamicEventRendering === 'Progressive';
            var left = this.nav.scroll.scrollLeft;
            var right = left + this.nav.scroll.clientWidth;
            var eventLeft = data.part.left;
            var eventRight = data.part.left + data.part.width;

            if (dynamic && (right <= eventLeft || left >= eventRight)) {
                return false;
            }
            return true;
        };

        this._oldEvent = function(ev) {
            if (!ev.rendered) {  // just for the case, these events might not have Top defined
                return true;
            }

            var area = this._getDrawArea();

            var top = area.pixels.top;
            var bottom = area.pixels.bottom;
            var left = area.pixels.left - this.dynamicEventRenderingMargin;
            var right = area.pixels.right + this.dynamicEventRenderingMargin;

            var eventLeft = ev.part.left;
            var eventRight = ev.part.right;
            var eventTop = ev.part.top;
            var eventBottom = ev.part.top + calendar.eventHeight;

            if (right <= eventLeft || left >= eventRight) {
                return true;
            }

            if (bottom <= eventTop || top >= eventBottom) {
                return true;
            }

            return false;
        };

        // returns true if the event was actually rendered
        this._drawEvent = function(e, options) {

            options = options || {};
            var forced = options.forced;

            if (e.rendered) {
                return false;
            }

            var dynamic = this.dynamicEventRendering === 'Progressive';

            var rowIndex = e.part.dayIndex;

            var divEvents = calendar.divEvents;
            var rowlist = calendar.rowlist;
            var row = rowlist[rowIndex];
            var rowTop = row.top;

            var area = this._getDrawArea();
            var left = area.pixels.left - this.dynamicEventRenderingMargin;
            var right = area.pixels.right + this.dynamicEventRenderingMargin;
            var top = area.pixels.top;
            var bottom = area.pixels.bottom;

            var eventLeft = e.part.left;
            var eventRight = e.part.left + e.part.width;
            var eventTop = e.part.top + rowTop;
            var eventBottom = eventTop + calendar.eventHeight;

            var horizontalOut = right <= eventLeft || left >= eventRight;
            var verticalOut = (bottom <= eventTop || top >= eventBottom);
            if (!forced && dynamic && (horizontalOut || verticalOut)) { // dynamic rendering, event outside of the current view
                return false;
            }

            var width = e.part.width;
            var height = calendar.eventHeight;

            var cache = e.cache || e.data;

            // make sure it's not negative
            width = DayPilot.Util.atLeast(0, width);
            height = DayPilot.Util.atLeast(0, height);

            var div = createDiv();

            div.style.position = 'absolute';
            div.style.left = e.part.left  + 'px';
            div.style.top = (rowTop + e.part.top) + 'px';
            div.style.width = width + 'px';
            div.style.height = height + 'px';
            if (!calendar.eventTextWrappingEnabled) {
                div.style.whiteSpace = 'nowrap';
            }
            div.style.overflow = 'hidden';
            div.className = this._prefixCssClass("_event");
            if (cache.cssClass) {
                DayPilot.Util.addClass(div, cache.cssClass);
            }
            var lineClasses = true;
            if (lineClasses && typeof e.part.line === "number") {
                DayPilot.Util.addClass(div, this._prefixCssClass("_event_line" + e.part.line));
            }

            if (this.showToolTip) {
                div.title = e.client.toolTip() || "";
            }

            div.onmousemove = this._onEventMouseMove;
            div.onmousedown = this._onEventMouseDown;
            div.onmouseup = this._onEventMouseUp;

            div.ontouchstart = touch._onEventTouchStart;
            div.ontouchmove = touch._onEventTouchMove;
            div.ontouchend = touch._onEventTouchEnd;

            if (e.client.clickEnabled()) {
                div.onclick = this._onEventClick;
            }

            if (typeof cache.ariaLabel !== "undefined") {
                div.setAttribute("aria-label", cache.ariaLabel);
            }
            else {
                div.setAttribute("aria-label", cache.text);
            }

            div.setAttribute("tabindex", "-1");

            var inner = createDiv();
            inner.className = calendar._prefixCssClass("_event_inner");

            if (cache.backColor) {
                inner.style.background = cache.backColor;
            }
            if (cache.fontColor) {
                inner.style.color = cache.fontColor;
            }
            if (cache.borderColor === "darker" && cache.backColor) {
                inner.style.borderColor = DayPilot.ColorUtil.darker(cache.backColor, 2);
            }
            else {
                inner.style.borderColor = cache.borderColor;
            }

            if (cache.backImage) {
                inner.style.backgroundImage = "url(" + cache.backImage + ")";
                if (cache.backRepeat) {
                    inner.style.backgroundRepeat = cache.backRepeat;
                }
            }

            div.appendChild(inner);

            var startsHere = e.start().getTime() === e.part.start.getTime();
            var endsHere = e.rawend().getTime() === e.part.end.getTime();

            if (!startsHere) {
                DayPilot.Util.addClass(div, this._prefixCssClass("_event_continueleft"));
            }
            if (!endsHere) {
                DayPilot.Util.addClass(div, this._prefixCssClass("_event_continueright"));
            }

            if (e.client.barVisible() && width > 0) {
                var barLeft = 100 * e.part.barLeft / (width); // %
                var barWidth = Math.ceil(100 * e.part.barWidth / (width)); // %

                var bar = createDiv();
                bar.className = this._prefixCssClass("_event_bar");
                bar.style.position = "absolute";

                if (cache.barBackColor) {
                    bar.style.backgroundColor = cache.barBackColor;
                }

                var barInner = createDiv();
                barInner.className = this._prefixCssClass("_event_bar_inner");
                barInner.style.left = barLeft + "%";
                if (0 < barWidth && barWidth <= 1) {
                    barInner.style.width = "1px";
                }
                else {
                    barInner.style.width = barWidth + "%";
                }

                if (cache.barColor) {
                    barInner.style.backgroundColor = cache.barColor;
                }

                if (cache.barImageUrl) {
                    barInner.style.backgroundImage = "url(" + cache.barImageUrl + ")";
                }

                bar.appendChild(barInner);
                div.appendChild(bar);
            }
            div.row = rowIndex;
            div.event = e;

            inner.innerHTML = e.client.innerHTML();

            var areas = [];
            (function deleteIcon() {
                if (calendar.eventDeleteHandling !== "Disabled" && !cache.deleteDisabled) {

                    var top = calendar.durationBarVisible ? calendar.durationBarHeight : 0;
                    areas.push({
                        v: "Hover",
                        w: 17,
                        h: 17,
                        top: top + 2,
                        right: 2,
                        css: calendar._prefixCssClass("_event_delete"),
                        onClick: function(args) { calendar._eventDeleteDispatch(args.source); }
                    });
                }
            })();

            if (cache.areas) {
                areas = areas.concat(cache.areas);
            }

            DayPilot.Areas.attach(div, e, {areas: areas});

            // add it to the events collection
            this.elements.events.push(div);

            // draw the div
            divEvents.appendChild(div);

            e.rendered = true;

            return true;
        };

        this._xssTextHtml = function(text, html) {

            if (calendar._resolved._xssProtectionEnabled()) {
                return DayPilot.Util.escapeTextHtml(text, html);
            }

            if (!DayPilot.Util.isNullOrUndefined(html)) {
                return html;
            }
            if (DayPilot.Util.isNullOrUndefined(text)) {
                return "";
            }
            return text;
        };

        this._updateEventTops = function() {
            for (var i = 0; i < this.elements.events.length; i++) {
                var div = this.elements.events[i];
                var event = div.event;
                var rowIndex = event.part.dayIndex;
                var row = calendar.rowlist[rowIndex];
                var rowTop = row.top;
                var top = rowTop + event.part.top;
                var rowHeight = row.height;

                var height = calendar.eventHeight;
                var heightDirty = false;
                if (event.part.top + height > rowHeight) {
                    height = Math.max(0, rowHeight - event.part.top);
                    heightDirty = true;
                }

                div.style.top = top + 'px';
                div.style.height = height + "px";
            }
        };

        this._findEventDiv = function(e) {
            if (!e) {
                return null;
            }
            for (var i = 0; i < calendar.elements.events.length; i++) {
                var div = calendar.elements.events[i];
                if (div.event === e || div.event.data === e.data) {
                    return div;
                }
            }
            return null;
        };

        this._findEventDivEnsureRendered = function(e) {
            var ev = calendar.events._findEventInRows(e.data);
            if (!ev) {
                return null;
            }
            var row = calendar.rowlist[ev.part.dayIndex];
            calendar._updateEventPositionsInRow(row);
            calendar._drawEvent(ev, {"forced": true});  // make sure it's rendered
            return calendar._findEventDiv(ev);
        };


        this._onEventMouseMove = function(ev) {

            var div = this;
            while (div && !div.event) { // make sure it's the top event div
                div = div.parentNode;
            }
            var e = div.event;

            calendar._eventUpdateCursor(div, ev);
            calendar._updateCoords(ev);
        };


        this._moving = {};

        this._onEventMouseDown = function(ev) {

            // make sure that coordinates are set
            calendar._updateCoords(ev);

            var button = DayPilot.Util.mouseButton(ev);

            ev.preventDefault();
            ev.stopPropagation();

            if (button.left) {
                if (this.style.cursor === 'w-resize' || this.style.cursor === 'e-resize') {
                    DayPilotScheduler._preventEventClick = true;

                    // set
                    DayPilotScheduler._resizing = this;
                    DayPilotScheduler._resizingEvent = this.event;
                    DayPilotScheduler._originalMouse = DayPilot.mc(ev);

                    // cursor
                    body().style.cursor = this.style.cursor;
                }
                else if ((this.style.cursor === 'move') || (this.event.client.moveEnabled())) {
                    calendar._startMoving(this, ev);
                }
            }

        };

        this._onEventMouseUp = function(ev) {
            var button = DayPilot.Util.mouseButton(ev);
            if (button.right) {
                calendar._eventRightClickDispatch.call(this, ev);
            }
        };


        this._startMoving = function(div, ev) {
            var moving = calendar._moving;

            calendar._updateCoords(ev);

            moving._movingStarted = true;
            moving._moving = div;
            moving._movingEvent = div.event; // need to store it separately because the event box may get cleaned on sweeping
            moving._originalMouse = DayPilot.mc(ev);
            moving._moveOffsetX = DayPilot.mo3(div, ev).x;  // unused?
            moving._moveDragStart = calendar.getDate(calendar.coords.x, true);  // unused?
        };

        this._touch = {};
        var touch = calendar._touch;

        if (typeof DayPilot.Global.touch === "undefined") {
            DayPilot.Global.touch = {};
        }
        DayPilot.Global.touch.active = false;
        DayPilot.Global.touch.start = false;
        touch._timeouts = [];

        touch._onEventTouchStart = function(ev) {

            // iOS
            if (DayPilot.Global.touch.active || DayPilot.Global.touch.start) {
                return;
            }

            // prevent onMainTouchStart
            ev.stopPropagation();

            touch._clearTimeouts();

            DayPilot.Global.touch.start = true;
            DayPilot.Global.touch.active = false;

            var div = this;

            calendar.coords = touch._relativeCoords(ev);

            var holdfor = calendar.tapAndHoldTimeout;
            touch._timeouts.push(setTimeout(function() {

                DayPilot.Global.touch.active = true;
                DayPilot.Global.touch.start = false;

                ev.preventDefault();

                var e = div.event;

                switch (calendar.eventTapAndHoldHandling) {
                    case "Move":
                        if (e.client.moveEnabled()) {
                            var coords = touchMousePos(ev);
                            touch._startMoving(div, coords);
                        }
                        break;
                }


            }, holdfor));


        };

        touch._onEventTouchMove = function(ev) {
            touch._clearTimeouts();
            DayPilot.Global.touch.start = false;
        };

        touch._onEventTouchEnd = function(ev) {
            if (DayPilot.Util.isMouseEvent(ev)) {
                return;
            }

            touch._clearTimeouts();

            // quick tap
            if (DayPilot.Global.touch.start) {
                DayPilot.Global.touch.start = false;
                ev.preventDefault();
                ev.stopPropagation();

                var div = this;
                setTimeout(function() {
                    calendar._eventClickSingle(div, ev);
                });
            }

            setTimeout(function() {
                DayPilot.Global.touch.start = false;
                DayPilot.Global.touch.active = false;
            }, 500);

        };

        touch._onMainTouchStart = function(ev) {

            // prevent after-alert firing on iOS
            if (DayPilot.Global.touch.active || DayPilot.Global.touch.start) {
                return;
            }

            // pinch
            if (ev.touches.length > 1) {
                return;
            }

            if (calendar.timeRangeSelectedHandling === 'Disabled') {
                return;
            }

            touch._clearTimeouts();

            DayPilot.Global.touch.start = true;
            DayPilot.Global.touch.active = false;

            var holdfor = calendar.tapAndHoldTimeout;
            touch._timeouts.push(setTimeout(function() {
                DayPilot.Global.touch.active = true;
                DayPilot.Global.touch.start = false;

                ev.preventDefault();

                calendar.coords = touch._relativeCoords(ev);
                touch._range = calendar._rangeFromCoords();
            }, holdfor));

            var tapAllowed = true;
            if (tapAllowed) {
                calendar.coords = touch._relativeCoords(ev);
            }
        };

        touch._onMainTouchMove = function(ev) {
            touch._clearTimeouts();

            DayPilot.Global.touch.start = false;

            if (DayPilotScheduler._resizing) {
                ev.preventDefault();
                touch._updateResizing();
                return;
            }

            if (DayPilot.Global.touch.active) {
                ev.preventDefault();

                calendar.coords = touch._relativeCoords(ev);

                if (DayPilotScheduler._moving) {
                    touch._updateMoving();
                    return;
                }


                if (touch._range) {
                    var range = touch._range;
                    range.end = {
                        x: Math.floor(calendar.coords.x / calendar.cellWidth),
                        "time": calendar.getDate(calendar.coords.x, true)
                    };

                    calendar._drawRange(range);
                }
            }

        };

        touch.debug = function(msg) {};

        touch._onMainTouchEnd = function(ev) {
            touch._clearTimeouts();

            var tapAllowed = true;

            if (DayPilot.Global.touch.active) {
                if (DayPilotScheduler._moving) {

                    ev.preventDefault();

                    var e = DayPilotScheduler._movingEvent;

                    if (calendar !== DayPilotScheduler._movingShadow.calendar) {
                        return;
                    }

                    var newStart = DayPilotScheduler._movingShadow.start;
                    var newEnd = DayPilotScheduler._movingShadow.end;
                    var newResource = DayPilotScheduler._movingShadow.row.id;

                    DayPilot.Util.removeClass(DayPilotScheduler._moving, calendar._prefixCssClass("_event_moving_source"));

                    // clear the moving state
                    DayPilot.de(DayPilotScheduler._movingShadow);
                    DayPilotScheduler._movingShadow.calendar = null;
                    body().style.cursor = '';
                    DayPilotScheduler._moving = null;
                    DayPilotScheduler._movingEvent = null;
                    DayPilotScheduler._movingShadow = null;

                    calendar._eventMoveDispatch(e, newStart, newEnd, newResource);

                }

                if (touch._range) {
                    var range = touch._range;
                    touch._range = null;

                    var shadow = calendar.elements.range2;
                    if (shadow && shadow.overlapping) {
                        calendar.clearSelection();
                    }
                    else {
                        calendar._timeRangeSelectedDispatchFromRange(range);
                    }
                }
            }
            else if (DayPilot.Global.touch.start && tapAllowed) {  // simple tap
                if (calendar.coords.x < calendar.getScrollX()) {
                    return; // invisible
                }

                var range = calendar._rangeFromCoords();
                calendar._drawRange(range);

                var shadow = calendar.elements.range2;
                if (shadow && shadow.overlapping) {
                    calendar.clearSelection();
                }
                else {
                    calendar._timeRangeSelectedDispatchFromRange(range);
                }
            }

            setTimeout(function() {
                DayPilot.Global.touch.start = false;
                DayPilot.Global.touch.active = false;
            }, 500);

        };

        touch._clearTimeouts = function() {
            for (var i = 0; i < touch._timeouts.length; i++) {
                clearTimeout(touch._timeouts[i]);
            }
            touch._timeouts = [];
        };

        touch._relativeCoords = function(ev) {
            var ref = calendar._maind;

            var t = ev.touches ? ev.touches[0] : ev;

            var x = t.pageX;
            var y = t.pageY;

            var coords = offset(x, y, ref);

            function offset(x, y, div) {
                var abs = DayPilot.abs(div);
                var coords = {x: x - abs.x, y: y - abs.y, toString: function() { return "x: " + this.x + ", y:" + this.y; } };
                return coords;
            }

            return coords;
        };

        // coords - page coords
        touch._startMoving = function(div, coords) {

            DayPilotScheduler._moving = div;
            DayPilotScheduler._movingEvent = div.event;
            DayPilotScheduler._originalMouse = coords;

            var absE = DayPilot.abs(div);
            DayPilotScheduler._moveOffsetX = coords.x - absE.x;
            DayPilotScheduler._moveDragStart = calendar.getDate(calendar.coords.x, true);
            DayPilotScheduler._movingShadow = calendar._createShadow(div);

            // update dimensions
            calendar._moveShadow();
        };


        // coords - relative to maind
        touch._updateResizing = function() {
            if (!DayPilotScheduler._resizingShadow) {
                var mv = DayPilotScheduler._resizing;
                DayPilotScheduler._resizingShadow = calendar._createShadow(mv);
            }

            calendar._resizeShadow();

        };

        // coords - relative to maind
        touch._updateMoving = function() {
            if (!DayPilotScheduler._movingShadow) {
                var mv = DayPilotScheduler._moving;
                DayPilotScheduler._movingShadow = calendar._createShadow(mv);
            }

            var target = DayPilotScheduler._movingShadow.calendar;

            target._moveShadow();
        };

        this._eventUpdateCursor = function(div, ev) {

            // const
            var resizeMargin = this.eventResizeMargin;

            var object = div;

            if (typeof (DayPilotScheduler) === 'undefined') {
                return;
            }

            // position
            var offset = DayPilot.mo3(div, ev);
            if (!offset) {
                return;
            }

            calendar.eventOffset = offset;

            if (DayPilotScheduler._resizing) {
                return;
            }

            if (DayPilotScheduler._moving) {
                return;
            }

            var isFirstPart = object.event.part.start.toString() === object.event.start().toString();
            var isLastPart = object.event.part.end.toString() === object.event.rawend().toString();

            // left resizing
            if (offset.x <= resizeMargin && object.event.client.resizeEnabled()) {
                if (isFirstPart) {
                    div.style.cursor = "w-resize";
                    div.dpBorder = 'left';
                }
                else {
                    div.style.cursor = 'not-allowed';
                }
            }
            // right resizing
            else if (div.offsetWidth - offset.x <= resizeMargin && object.event.client.resizeEnabled()) {
                if (isLastPart) {
                    div.style.cursor = "e-resize";
                    div.dpBorder = 'right';
                }
                else {
                    div.style.cursor = 'not-allowed';
                }
            }
            else if (!DayPilotScheduler._resizing && !DayPilotScheduler._moving) {
                if (object.event.client.clickEnabled()) {
                    div.style.cursor = 'pointer';
                }
                else {
                    div.style.cursor = 'default';
                }
            }
        };

        this._cellCount = function() {
            var cellDuration = calendar._getCellDuration();  // minutes
            var days = calendar.days;
            var cellsPerDay = 1440 / cellDuration;
            return days * cellsPerDay;
        };

        this._getSelection = function(range) {

            var range = range || DayPilotScheduler._range || calendar._rangeHold;

            if (!range) {
                return null;
            }

            var row = calendar.rowlist[range.start.y];

            if (!row) {
                return null;
            }

            var r = range;

            var natural = r.end.time > r.start.time;

            var resource = row.id;
            var startX = natural ? r.start.x : r.end.x;
            var endX = (natural ? r.end.x : r.start.x);

            var snapToGrid = calendar.snapToGrid;

            var start, end;
            if (snapToGrid) {
                start = calendar._getCell(startX).start;
                end = calendar._getCell(endX).end;
            }
            else {
                if (natural) {
                    start = r.start.time;
                    end = r.end.time;
                }
                else {
                    start = r.end.time;
                    end = r.start.time;
                }
            }

            var sel = new DayPilot.Selection(start, end, resource, calendar);
            sel.allowed = !range.div || !range.div.overlapping;

            return sel;
        };

        this._drawTimeHeader = function() {

            this._cache.timeHeader = {};

            if (calendar.elements.timeHeader.length > 0) {
                calendar.elements.timeHeader = [];
            }

            var header = createDiv();
            header.style.position = "relative";
            this.nav.timeHeader = header;

            for (var y = 0; y < this.timeHeader.length; y++) {
                var row = this.timeHeader[y];
                for (var x = 0; x < row.length; x++) {
                    this._drawTimeHeaderCell2(x, y);
                }
            }

            var north = this.divNorth;

            // already rendered, updating
            if (north.childNodes.length === 1) {
                north.replaceChild(header, north.childNodes[0]);
            }
            // not rendered before
            else {
                // just to make sure
                north.innerHTML = '';
                north.appendChild(header);
            }

            var gridwidth = this._getGridWidth();
            north.style.width = (gridwidth + 5000) + "px";

            if (gridwidth > 0) {
                this.divStretch.style.width = (gridwidth) + "px";
            }

        };

        this._getGroupName = function(h, cellGroupBy) {
            var html = null;
            var locale = this._resolved._locale();

            var cellGroupBy = cellGroupBy || this.cellGroupBy;

            var from = h.start;

            switch (cellGroupBy) {
                case 'Minute':
                    html = from.toString("m");
                    break;
                case 'Hour':
                    html = (calendar._resolved._timeFormat() === 'Clock12Hours') ? from.toString("h tt", locale) : from.toString("H", locale);
                    break;
                case 'Day':
                    html = from.toString(locale.datePattern);
                    break;
                case 'Week':
                    html = resolved._weekStarts() === 1 ? from.weekNumberISO() : from.weekNumber();
                    break;
                case 'Month':
                    html = from.toString("MMMM yyyy", locale);
                    break;
                case 'Quarter':
                    html = "Q" + Math.floor(from.getMonth() / 3 + 1);
                    break;
                case 'Year':
                    html = from.toString("yyyy");
                    break;
                case 'None':
                    html = '';
                    break;
                case 'Cell':
                    var duration = (h.end.ticks - h.start.ticks) / 60000;
                    html = this._getCellName(from, duration);
                    break;
                default:
                    throw new DayPilot.Exception("Invalid groupBy value: " + cellGroupBy);
            }

            return html;
        };

        this._getCellName = function(start, duration) {
            var locale = this._resolved._locale();
            var duration = duration || this.cellDuration;
            if (duration < 1) // smaller than minute, use seconds
            {
                return start.toString("ss");
            }
            else if (duration < 60) // smaller than hour, use minutes
            {
                return start.toString("mm");
            }
            else if (duration < 1440) // smaller than day, use hours
            {
                return calendar._resolved._timeFormat() === 'Clock12Hours' ? start.toString("h tt", locale) : start.toString("H", locale);
            }
            else if (duration < 10080) // use days
            {
                return start.toString("d");
            }
            else if (duration === 10080) {
                return resolved._weekStarts() === 1 ? start.weekNumberISO() : start.weekNumber();
            }
            else
            {
                return start.toString("MMMM yyyy", locale);
            }
        };

        this._addGroupSize = function(from, cellGroupBy, isScale) {
            var to;

            var endDate = calendar.startDate.addDays(calendar.days);
            cellGroupBy = cellGroupBy || this.cellGroupBy;
            var cellDuration = 60; // dummy value to make sure it's aligned properly

            switch (cellGroupBy) {
                case 'Minute':
                    if (from.getMinutes() + from.getSeconds() + from.getMilliseconds() > 0) {
                        from = from.getDatePart().addHours(from.getHours()).addMinutes(from.getMinutes());
                    }
                    to = from.addMinutes(1);
                    break;
                case 'Hour':
                    if (from.getHours() + from.getMinutes() + from.getSeconds() + from.getMilliseconds() > 0) {
                        from = from.getDatePart().addHours(from.getHours());
                    }
                    to = from.addHours(1);
                    break;
                case 'Day':
                    to = from.getDatePart().addDays(1);
                    break;
                case 'Week':
                    to = from.getDatePart().addDays(1);
                    while (to.dayOfWeek() !== resolved._weekStarts()) {
                        to = to.addDays(1);
                    }
                    break;
                case 'Month':
                    from = from.getDatePart();
                    to = from.addMonths(1);
                    to = to.firstDayOfMonth();

                    var isInt = (DayPilot.DateUtil.diff(to, from) / (1000.0 * 60)) % cellDuration === 0;
                    while (!isInt) {
                        to = to.addHours(1);
                        isInt = (DayPilot.DateUtil.diff(to, from) / (1000.0 * 60)) % cellDuration === 0;
                    }
                    break;
                case "Quarter":
                    from = from.getDatePart();
                    to = from.addMonths(1);
                    to = to.firstDayOfMonth();

                    while (to.getMonth() % 3) {
                        to = to.addMonths(1);
                    }

                    var isInt = (DayPilot.DateUtil.diff(to, from) / (1000.0 * 60)) % cellDuration === 0;
                    while (!isInt) {
                        to = to.addHours(1);
                        isInt = (DayPilot.DateUtil.diff(to, from) / (1000.0 * 60)) % cellDuration === 0;
                    }

                    break;
                case 'Year':
                    from = from.getDatePart();
                    to = from.addYears(1);
                    to = to.firstDayOfYear();

                    var isInt = (DayPilot.DateUtil.diff(to, from) / (1000.0 * 60)) % cellDuration === 0;
                    while (!isInt) {
                        to = to.addHours(1);
                        isInt = (DayPilot.DateUtil.diff(to, from) / (1000.0 * 60)) % cellDuration === 0;
                    }
                    break;
                case 'None':
                    to = endDate;
                    break;
                case 'Cell':
                    var cell = this._getCellFromTime(from);
                    if (cell.current)
                    {
                        to = cell.current.end;
                    }
                    break;
                default:
                    if (isScale){
                        throw new DayPilot.Exception("Invalid scale value: " + cellGroupBy);
                    }
                    else {
                        throw new DayPilot.Exception("Invalid groupBy value: " + cellGroupBy);
                    }
            }
            if (to.getTime() > endDate.getTime()) {
                to = endDate;
            }

            return to;
        };

        this._drawTimeHeaderCell2 = function(x, y) {

            var header = this.nav.timeHeader;

            var p = this.timeHeader[y][x];

            var isGroup = y < this.timeHeader.length - 1;
            var left = p.left;
            var width = p.width;

            var top = y * calendar.headerHeight;
            var height = calendar.headerHeight;

            var cell = createDiv();
            cell.style.position = "absolute";
            cell.style.top = top + "px";
            cell.style.left = left + "px";
            cell.style.width = width + "px";
            cell.style.height = height + "px";
            if (p.toolTip) {
                cell.title = p.toolTip;
            }

            cell.setAttribute("aria-hidden", "true");

            if (p.cssClass) {
                DayPilot.Util.addClass(cell, p.cssClass);
            }

            cell.style.userSelect = 'none';
            cell.style.webkitUserSelect = 'none';

            cell.oncontextmenu = function() { return false; };
            cell.cell = {};
            cell.cell.start = p.start;
            cell.cell.end = p.end;
            cell.cell.level = y;
            cell.cell.th = p;
            cell.onclick = this._onTimeHeaderClick;
            cell.oncontextmenu = this._onTimeHeaderRightClick;

            DayPilot.re(cell, DayPilot.touch.start, function(ev) {
               ev.stopPropagation();
            });

            cell.style.overflow = 'hidden';

            if (!calendar.timeHeaderTextWrappingEnabled) {
                cell.style.whiteSpace = "nowrap";
            }

            var inner = createDiv();
            inner.innerHTML = calendar._xssTextHtml(p.text, p.innerHTML);

            if (p.backColor) {
                inner.style.background = p.backColor;
            }

            if (p.fontColor) {
                inner.style.color = p.fontColor;
            }

            var cl = this._prefixCssClass("_timeheadercol");
            var cli = this._prefixCssClass("_timeheadercol_inner");
            if (isGroup) {
                cl = this._prefixCssClass("_timeheadergroup");
                cli = this._prefixCssClass("_timeheadergroup_inner");
            }
            DayPilot.Util.addClass(cell, cl);
            DayPilot.Util.addClass(inner, cli);

            DayPilot.Util.addClass(cell, calendar._prefixCssClass("_timeheader_cell"));
            DayPilot.Util.addClass(inner, calendar._prefixCssClass("_timeheader_cell_inner"));

            cell.appendChild(inner);

            this._cache.timeHeader[x + "_" + y] = cell;
            this.elements.timeHeader.push(cell);

            header.appendChild(cell);
        };

        this._updateRowHeights = function() {

            var rowlist = calendar.rowlist;
            rowlist.forEach(function(row) {
                var updated = row.getHeight();
                if (row.height !== updated) {
                    calendar._rowsDirty = true;
                }
                row.height = updated;
            });


            if (calendar._rowsDirty) {
                calendar._cache.drawArea = null;
            }

        };

        this._updateRowHeaderHeights = function() {

            var rowlist = calendar.rowlist;

            rowlist.forEach(function(row) {

                var header = calendar.divHeader;
                if (!header) {
                    return;
                }

                var index = row.index;

                if (!header.rows[index]) {
                    return;
                }

                var headerCell = header.rows[index];

                if (calendar._resHeaderDivBased) {
                    headerCell.style.top = row.top + "px";
                }

                var newHeight = row.height;

                if (headerCell && headerCell.firstChild && parseInt(headerCell.firstChild.style.height, 10) !== newHeight) {
                    headerCell.firstChild.style.height = newHeight + "px";
                }
            });

            if (calendar._resHeaderDivBased) {
                if (calendar.nav.resScrollSpace) {
                    calendar.nav.resScrollSpace.style.top = calendar._gridHeight + "px";
                }
            }

        };

        // handles:
        // - TimeRangeSelected
        this._onMaindMouseDown = function(ev) {

            if (DayPilot.Global.touch.start || DayPilot.Global.touch.active) {
                return;
            }

            if (DayPilotScheduler._timeRangeTimeout && false) {
                clearTimeout(DayPilotScheduler._timeRangeTimeout);
                DayPilotScheduler._timeRangeTimeout = null;
            }

            // make sure that coordinates are set
            calendar._updateCoords(ev);

            var button = DayPilot.Util.mouseButton(ev);

            // cancel all additional mouse down events, the first mouse up will be used when resolving the selection
            if (calendar._dragInProgress()) {
                return false;
            }

            if (button.middle || button.right) {
                return false;
            }

            if (calendar._isWithinRange(calendar.coords)) {
                return false;
            }

            var buttonAsString = button.left ? "left" : (button.right ? "right" : (button.middle ? "middle" : "unknown"));

            calendar._rangeButton = buttonAsString;

            DayPilotScheduler._range = calendar._rangeFromCoords();
            if (DayPilotScheduler._range) {
                DayPilotScheduler._rangeCalendar = calendar;
            }

            return false;
        };

        // creates a single cell range selection at the current position (calendar.coords)
        this._rangeFromCoords = function() {

            var range = {};

            var cx = calendar._getCellFromPixels(calendar.coords.x).x;
            var time = calendar.getDate(calendar.coords.x, true);

            range.start = {
                y: calendar._getRow(calendar.coords.y).i,
                x: cx,
                "time": time
            };

            range.end = {
                x: cx,
                "time": time
            };

            range.calendar = calendar;
            calendar._drawRange(range);

            return range;
        };


        this._onMaindMouseUp = function(ev) {
            calendar._moving = {};  // clear

            if (calendar._rangeHold) {
                // handles clicking an existing time range

                var button = DayPilot.Util.mouseButton(ev);

                if (button.left) {
                    var range = calendar._rangeHold;
                    if (calendar._isWithinRange(calendar.coords)) {

                        var createTimeRangeClickDispatcher = function(range) {
                            return function() {
                                DayPilotScheduler._timeRangeTimeout = null;

                                var sel = calendar._getSelection(range);
                                if (!sel) {
                                    return;
                                }

                                var args = {};
                                args.start = sel.start;
                                args.end = sel.end;
                                args.resource = sel.resource;
                                args.preventDefault = function() {
                                    args.preventDefault.value = true;
                                };
                                if (typeof calendar.onTimeRangeClick === "function") {
                                    calendar.onTimeRangeClick(args);
                                }

                                if (!args.preventDefault.value) {
                                    if (typeof calendar.onTimeRangeClicked === "function") {
                                        calendar.onTimeRangeClicked(args);
                                    }
                                }
                            };
                        };

                        if (calendar.timeRangeClickHandling !== "Disabled") {
                            createTimeRangeClickDispatcher(range)();
                        }
                    }
                }

            }

        };

        this._dragInProgress = function() {
            var inProgress = DayPilotScheduler._resizing || DayPilotScheduler._moving || DayPilotScheduler._range;
            if (inProgress) {
                return true;
            }

            // required for areas
            if (calendar._moving._movingStarted) {
                return true;
            }

            return false;
        };

        this.dragInProgress = function() {
            return calendar._dragInProgress();
        }

        this._updateCoords = function(ev) {
            var coords = DayPilot.mo3(calendar._maind, ev);
            coords = coords || {};
            coords.stamp = coords.x + "_" + coords.y;

            // coords object needs to stay the same unless values have changed
            if (!calendar.coords || calendar.coords.stamp !== coords.stamp) {
                calendar.coords = coords;
            }
        };

        // handles:
        // - EventMove
        // - EventResize
        // - TimeRangeSelected
        //
        // saves calendar.coords
        this._onMaindMouseMove = function(ev) {

            if (DayPilot.Global.touch.active) {
                return;
            }

            // DayPilotScheduler._activeCalendar = calendar; // required for moving
            var mousePos = DayPilot.mc(ev);

            // calendar.coords = DayPilot.mo3(calendar._maind, ev);
            calendar._updateCoords(ev);

            if (calendar._moving._movingStarted) {
                var requiredDistance = 2;
                var distance = DayPilot.distance(calendar._moving._originalMouse, mousePos);

                if (distance > requiredDistance) {
                    DayPilot.Util.copyProps(calendar._moving, DayPilotScheduler);
                    body().style.cursor = 'move';
                    calendar._moving = {};
                }
            }

            if (DayPilotScheduler._resizing && DayPilotScheduler._resizingEvent.calendar === calendar) {
                if (!DayPilotScheduler._resizing.event) {
                    DayPilotScheduler._resizing.event = DayPilotScheduler._resizingEvent;
                }
                calendar._mouseMoveUpdateResizing();
            }
            else if (DayPilotScheduler._movingEvent) {
                calendar._mouseMoveUpdateMoving();
            }
            else if (DayPilotScheduler._range && DayPilotScheduler._range.calendar === calendar) {
                DayPilotScheduler._range.moved = true;
                calendar._mouseMoveUpdateRange();
            }

        };

        this._mouseMoveUpdateRange = function() {
            var range = DayPilotScheduler._range;

            var x = calendar._getCellFromPixels(calendar.coords.x).x;
            var time = calendar.getDate(calendar.coords.x, true);
            range.end = {
                x: x,
                "time": time
            };

            calendar._drawRange(range);
        };

        this._mouseMoveUpdateResizing = function() {
            if (!DayPilotScheduler._resizingShadow) {
                DayPilotScheduler._resizingShadow = calendar._createShadow(DayPilotScheduler._resizing);
            }
            calendar._resizeShadow();
        };

        this._mouseMoveUpdateMoving = function() {
            if (!DayPilotScheduler._movingShadow) {
                DayPilot.Util.addClass(DayPilotScheduler._moving, calendar._prefixCssClass("_event_moving_source"));
                var mv = DayPilotScheduler._movingEvent;
                DayPilotScheduler._movingShadow = calendar._createShadow(mv);
            }

            calendar._moveShadow();
        };

        this._onMaindRightClick = function(ev) {
            ev.cancelBubble = true;
            return false;
        };

        this._isWithinRange = function(coords) {
            var range = calendar._rangeHold;

            if (!range || !range.start || !range.end) {
                return false;
            }

            var row = this._getRowByIndex(range.start.y);

            var leftToRight = range.start.x < range.end.x;

            var rangeLeft = (leftToRight ? range.start.x : range.end.x) * this.cellWidth;
            var rangeRight = (leftToRight ? range.end.x : range.start.x) * this.cellWidth + this.cellWidth;
            var rangeTop = row.top;
            var rangeBottom = row.bottom;

            if (coords.x >= rangeLeft && coords.x <= rangeRight && coords.y >= rangeTop && coords.y <= rangeBottom) {
                return true;
            }

            return false;
        };

        this._drawRange = function(range) {

            range = range || DayPilotScheduler._range;

            if (!range) {
                return;
            }

            var snapToGrid = calendar.snapToGrid;

            var rowlist = calendar.rowlist;

            draw(range);

            function draw(range) {
                var natural = range.end.time > range.start.time;
                var left, right;
                var startTime, endTime;

                var y = range.start.y;

                var timesAvailable = range.start.time && range.end.time;

                if (snapToGrid || !timesAvailable) {
                    var startX = natural ? range.start.x : range.end.x;
                    var endX = (natural ? range.end.x : range.start.x);

                    var start = calendar._getCell(startX);
                    var end = calendar._getCell(endX);

                    left = start.left;
                    right = end.left + end.width;
                }
                else {
                    if (natural) {
                        startTime = range.start.time;
                        endTime = range.end.time;
                    }
                    else {
                        startTime = range.end.time;
                        endTime = range.start.time;
                    }

                    left = calendar.getPixels(startTime).left;
                    right = calendar.getPixels(endTime).left;

                }

                var width = right - left;

                var cell = calendar.elements.range2;

                if (!cell) {
                    cell = createDiv();
                    cell.style.position = 'absolute';

                    var inner = createDiv();
                    inner.className = calendar._prefixCssClass("_shadow_inner");
                    cell.appendChild(inner);

                    calendar.divShadow.appendChild(cell);
                }

                // reset required
                cell.className = calendar._prefixCssClass("_shadow");
                cell.firstChild.innerHTML = "";

                cell.style.left = (left) + "px";
                cell.style.top = rowlist[y].top + "px";
                cell.style.width = width + "px";
                cell.style.height = (rowlist[y].height - 1) + "px";

                cell.calendar = calendar;

                calendar.elements.range2 = cell;

                return cell;
            }


        };

        this._copyRange = function(range) {
            return {
                "start": {
                    "x": range.start.x,
                    "y": range.start.y,
                    "time": range.start.time,
                },
                "end": {
                    "x": range.end.x,
                    "time": range.end.time
                },
                "calendar": range.calendar,
                "args": range.args,
            }
        };

        this._timeouts = {};
        this._timeouts._drawEvents = null;
        this._timeouts.drawCells = null;
        this._timeouts.drawRows = null;
        this._timeouts.click = null;
        this._timeouts.resClick = [];
        this._timeouts.updateFloats = null;

        this._onScroll = function() {

            if (calendar._disposed) {
                return;
            }

            calendar._clearCachedValues();

            var divScroll = calendar.nav.scroll;

            calendar._scrollPos = divScroll.scrollLeft;
            calendar._scrollTop = divScroll.scrollTop;
            calendar._scrollWidth = divScroll.clientWidth;

            if (calendar.divTimeScroll) {
                calendar.divTimeScroll.scrollLeft = calendar._scrollPos;
            }

            if (ios && DayPilotScheduler._touchingRes) {
                doNothing();
            }
            else {
                calendar.divResScroll.scrollTop = calendar._scrollTop;
            }


            // draw rows before cells (by default both delays are 0) - affects lines
            if (calendar.progressiveRowRendering) {
                if (calendar._timeouts.drawRows) {
                    clearTimeout(calendar._timeouts.drawRows);
                    calendar._timeouts.drawRows = null;
                }
                if (calendar.scrollDelayRows > 0) {
                    calendar._timeouts.drawRows = setTimeout(function() { calendar._drawResHeadersProgressive(); }, calendar.scrollDelayRows);
                }
                else {
                    calendar._drawResHeadersProgressive();
                }
            }

            if (calendar._timeouts.drawCells) {
                clearTimeout(calendar._timeouts.drawCells);
                calendar._timeouts.drawCells = null;
            }
            if (calendar.scrollDelayCells > 0) {
                calendar._timeouts.drawCells = setTimeout(calendar._delayedDrawCells(), calendar.scrollDelayCells);
            }
            else {
                var f = calendar._delayedDrawCells();
                f();
            }

            if (calendar._timeouts._drawEvents) {
                clearTimeout(calendar._timeouts._drawEvents);
                calendar._timeouts._drawEvents = null;
            }
            if (calendar.scrollDelayEvents > 0) {
                calendar._timeouts._drawEvents = setTimeout(calendar._delayedDrawEvents(), calendar.scrollDelayEvents);
            }
            else {
                calendar._drawEvents();
            }

            if (calendar._timeouts.updateFloats) {
                clearTimeout(calendar._timeouts.updateFloats);
                calendar._timeouts.updateFloats = null;
            }
            if (calendar.scrollDelayFloats > 0) {
                calendar._timeouts.updateFloats = setTimeout(function() { calendar._updateFloats(); }, calendar.scrollDelayFloats);
            }
            else {
                calendar._updateFloats();
            }

            calendar.onScrollCalled = true;
        };

        this._delayedDrawCells = function() {
            return function() {
                if (!calendar) {
                    return;
                }
                calendar._drawCells();
            };
        };


        this._delayedDrawEvents = function() {
            var batch = true; // turns on batch rendering

            return function() {
                if (!calendar) {
                    return;
                }

                if (calendar._hiddenEvents()) {

                    setTimeout(function() {
                        calendar._deleteOldEvents();
                        setTimeout(function() { calendar._drawEvents(batch); }, 50);
                    }, 50);
                }
                else {
                    calendar._findEventsInViewPort();
                }
            };
        };

        this._clearCachedValues = function() {
            calendar._cache.drawArea = null;
        };

        this.show = function() {
            calendar.visible = true;
            calendar._previousVisible = true;
            calendar.nav.top.style.display = '';
            calendar._show();
            calendar._resize();
            calendar._onScroll();
        };

        this.hide = function() {
            calendar.visible = false;
            calendar._previousVisible = false;
            calendar.nav.top.style.display = 'none';
        };

        this._findEventInList = function(data) {
            if (!calendar.events.list) {
                return null;
            }

            for (var j = 0; j < this.events.list.length; j++) {
                var ex = this.events.list[j];
                if (calendar._isSameEvent(ex, data)) {
                    var result = {};
                    result.ex = ex;
                    result.index = j;
                    return result;
                }
            }
            return null;
        };


        this._drawCellsFull = function() {
            var area = this._getDrawArea();

            var cellLeft = area.xStart;
            var cellWidth = area.xEnd - area.xStart;
            var cellTop = area.yStart;
            var cellHeight = area.yEnd - area.yStart;

            // initialize for client-side processing
            if (!this.cellProperties) {
                this.cellProperties = {};
            }

            for (var i = 0; i <= cellWidth; i++) {
                var x = cellLeft + i;
                for (var j = 0; j < cellHeight; j++) {
                    var y = cellTop + j;
                    this._drawCell(x, y);
                }
                this._drawLineVertical(x);
            }

            // full height
            var rarea = this._getAreaRowsWithMargin();
            for (var y = rarea.start; y < rarea.end; y++) {
                this._drawLineHorizontal(y);
            }

        };

        this._drawCells = function() {
            if (calendar._disposed) {
                return;
            }

            var rowlist = calendar.rowlist;
            if (rowlist && rowlist.length > 0) {
                var sweep = this.cellSweeping;
                if (sweep) {
                    var keepOld = this.cellSweepingCacheSize;
                    this._deleteOldCells(keepOld);
                }

                this._drawCellsFull();
            }

            this._rowsDirty = false;
        };

        this._getDrawArea = function() {

            if (calendar._cache.drawArea) {
                return calendar._cache.drawArea;
            }

            if (!this.nav.scroll) {
                return null;
            }

            var scrollTop = calendar._scrollTop;

            var area = {};

            var marginX = this.dynamicEventRenderingMarginX != null ? this.dynamicEventRenderingMarginX : this.dynamicEventRenderingMargin;
            var marginY = this.dynamicEventRenderingMarginY != null ? this.dynamicEventRenderingMarginY : this.dynamicEventRenderingMargin;
            var left = calendar._scrollPos - marginX;
            var right = left + calendar._scrollWidth + 2*marginX;

            var start = 0;
            var end = 0;

            start = calendar._getCellFromPixels(left).x;
            end = calendar._getCellFromPixels(right, true).x;
            var totalWidth = this._cellCount();
            end = Math.min(end, totalWidth - 1); // make sure it's within the boundaries
            start = DayPilot.Util.atLeast(start, 0); // check the left side

            var top = scrollTop - marginY;
            var bottom = scrollTop + this.nav.scroll.offsetHeight + 2*marginY;

            var cellTop = this._getRow(top).i;
            var cellBottom = this._getRow(bottom).i;
            if (cellBottom < this.rowlist.length) {
                cellBottom++;
            }

            area.xStart = start;
            area.xEnd = end;
            area.yStart = cellTop;
            area.yEnd = cellBottom;

            var ref = calendar.nav.scroll;

            if (ref.clientWidth === 0) {
                ref = calendar.divTimeScroll;
            }

            area.pixels = {};
            area.pixels.left = ref.scrollLeft;
            area.pixels.right = ref.scrollLeft + ref.clientWidth;
            area.pixels.top = ref.scrollTop;
            area.pixels.bottom = ref.scrollTop + ref.clientHeight;
            area.pixels.width = ref.scrollWidth;

            area.sw = DayPilot.sw(calendar.nav.scroll);

            calendar._cache.drawArea = area;

            return area;
        };

        this._getGridWidth = function() {
            return calendar._cellCount() * calendar.cellWidth;
        };

        this._drawLineHorizontal = function(y) {
            var rowlist = calendar.rowlist;
            var divLines = calendar.divLines;

            var index = "y_" + y;

            if (this._cache.linesHorizontal[index]) {
                return;
            }

            var row = rowlist[y];

            var height = row.height;
            var top = row.top + height - 1;
            var width = this._getGridWidth();

            var line = createDiv();
            line.style.left = "0px";
            line.style.top = top + "px";
            line.style.width = width + "px";
            line.style.height = "1px";
            line.style.fontSize = '1px';
            line.style.lineHeight = '1px';
            line.style.overflow = 'hidden';
            line.style.position = 'absolute';
            line.className = this._prefixCssClass("_matrix_horizontal_line");

            divLines.appendChild(line);

            this._cache.linesHorizontal[index] = line;

        };

        this._drawLineVertical = function(x) {

            var itc = calendar._getCell(x);
            if (!itc) {
                return;
            }

            var divLines = calendar.divLines;
            var height = calendar._gridHeight;

            var index = "x_" + x;
            if (this._cache.linesVertical[index]) {
                return;
            }

            var left = itc.left + itc.width - 1;

            var line = createDiv();
            line.style.left = left + "px";
            line.style.top = "0px";
            line.style.width = "1px";
            line.style.height = height + "px";
            line.style.fontSize = '1px';
            line.style.lineHeight = '1px';
            line.style.overflow = 'hidden';
            line.style.position = 'absolute';
            line.className = this._prefixCssClass("_matrix_vertical_line");

            divLines.appendChild(line);
            this.elements.linesVertical.push(line);

            this._cache.linesVertical[index] = line;
        };


        this._prepareRowTops = function() {
            calendar._gridHeight = calendar._prepareRowTopsRowlist(calendar.rowlist);
        };

        this._prepareRowTopsRowlist = function(rowlist) {
            var top = 0;
            for (var i = 0; i < rowlist.length; i++) {
                var row = rowlist[i];
                row.top = top;
                top += row.height;
            }
            return top;
        };

        this._deleteCells = function() {
            calendar.elements.cells = [];
            calendar._cache.cells = [];
            calendar.divCells.innerHTML = '';
            calendar._deleteLines();
        };

        this._deleteLines = function() {
            calendar.divLines.innerHTML = '';
            calendar._cache.linesVertical = {};
            calendar._cache.linesHorizontal = {};
            calendar.elements.linesVertical = [];
        };

        this._deleteCellsInRow = function(y) {
            var list = [];
            for (var name in calendar._cache.cells) {
                list.push(calendar._cache.cells[name]);
            }
            list.filter(function(item) {
                return item && item.coords && item.coords.y === y;
            }).forEach(function(item) {
                calendar._deleteCell(item);
            });
        };

        this._drawCell = function(x, y) {

            if (!this._initialized) {
                return;
            }

            var itc = calendar._getCell(x);
            if (!itc) {
                return;
            }

            var rowlist = calendar.rowlist;
            var divCells = calendar.divCells;

            var index = x + '_' + y;
            if (this._cache.cells[index]) {
                return;
            }

            var p = this._getCellProperties(x, y);

            var cell = createDiv();
            cell.style.left = (itc.left) + "px";
            cell.style.top = rowlist[y].top + "px";
            cell.style.width = (itc.width) + "px";
            cell.style.height = (rowlist[y].height) + "px";
            cell.style.position = 'absolute';
            if (p && p.backColor) {
                cell.style.backgroundColor = p.backColor;
            }
            cell.className = this._prefixCssClass('_cell');

            cell.coords = {};
            cell.coords.x = x;
            cell.coords.y = y;

            if (p) {
                if (p.business && calendar.cellsMarkBusiness) {
                    DayPilot.Util.addClass(cell, calendar._prefixCssClass("_cell_business"));
                }
            }

            divCells.appendChild(cell);
            this.elements.cells.push(cell);

            this._cache.cells[index] = cell;
        };

        this.clearSelection = function() {
            this._deleteRange();
        };

        this._createRangeFromSelection = function(start, end, resource) {

            start = new DayPilot.Date(start);
            end = new DayPilot.Date(end);

            var row = calendar._findRowByResourceId(resource);

            var itcStart = calendar._getCellFromTime(start);
            var cellStart = itcStart.current;
            if (!cellStart) {
                throw new DayPilot.Exception("Time range selection 'start' out of timeline");
            }

            var itcEnd = calendar._getCellFromTime(new DayPilot.Date(end).addMilliseconds(-1));
            var cellEnd = itcEnd.current;
            if (!cellEnd) {
                throw new DayPilot.Exception("Time range selection 'end' out of timeline");
            }

            var range = {};

            range.start = {
                y: row.index,
                x: itcStart.i,
                "time": start
            };

            range.end = {
                x: itcEnd.i,
                "time": end
            };

            range.calendar = this;

            return range;
        };

        this.selectTimeRange = function(start, end, resource, dontFireEvent) {

            var range = calendar._createRangeFromSelection(start, end, resource);

            calendar._drawRange(range);

            if (!dontFireEvent) {
                setTimeout(function() {
                    calendar._timeRangeSelectedDispatchFromRange(range);
                }, 0);
            }

        };

        this._clearMovingShadow = function() {
            var src = DayPilotScheduler._movingShadow && DayPilotScheduler._movingShadow.source;

            if (src) {
                DayPilot.Util.removeClass(src, calendar._prefixCssClass("_event_moving_source"));
            }

            DayPilot.de(DayPilotScheduler._movingShadow);
            DayPilotScheduler._movingShadow = null;

            if (DayPilot.Global.movingLink) {
                DayPilot.Global.movingLink.clear();
                DayPilot.Global.movingLink = null;
            }
        };

        this._deleteRange = function() {
            if (calendar.divShadow) {
                calendar.divShadow.innerHTML = "";
            }

            calendar.elements.range = [];
            calendar.elements.range2 = null;
            calendar._rangeHold = null;
            calendar._lastRange = null;
        };



        this._resolved = {};
        var resolved = this._resolved;

        resolved._clearCache = function() {
            delete calendar._cache.headerHeight;
        };

        resolved._xssProtectionEnabled = function() {
            return calendar.xssProtection !== "Disabled";
        };

        resolved._locale = function() {
            return DayPilot.Locale.find(calendar.locale);
        };

        resolved._timeFormat = function() {
            if (calendar.timeFormat !== 'Auto') {
                    return calendar.timeFormat;
            }
            return resolved._locale().timeFormat;
        };

        resolved._weekStarts = function() {
            if (calendar.weekStarts === 'Auto') {
                var locale = resolved._locale();
                if (locale) {
                    return locale.weekStarts;
                }
                else {
                    return 0; // Sunday
                }
            }
            else {
                return calendar.weekStarts || 0;
            }
        };

        resolved._mobile = function() {
            var ua = navigator.userAgent.toLowerCase();
            return ua.indexOf("mobile") !== -1 || ua.indexOf("android") != -1;
        };

        resolved._useBox = function(durationTicks) {
            if (calendar.useEventBoxes === 'Always') {
                return true;
            }
            if (calendar.useEventBoxes === 'Never') {
                return false;
            }
            return durationTicks < calendar._getCellDuration() * 60 * 1000;
        };

        this._getCellProperties = function(x, y) {
            var index = x + '_' + y;
            var rowlist = calendar.rowlist;

            if (!this.cellProperties) {
                this.cellProperties = {};
            }

            if (this.cellProperties[index]) {
                return this.cellProperties[index];
            }

            if (!this.cellProperties[index]) {
                var row = rowlist[y];
                var resource = row.id;
                var itc = calendar._getCell(x);
                var start = itc.start;
                var end = itc.end;

                var ibj = {};
                ibj.start = start;
                ibj.end = end;
                ibj.resource = resource;

                var cell = {};
                cell.business = calendar.isBusiness(ibj);

                this.cellProperties[index] = cell;
            }

            return this.cellProperties[index];
        };

        this.isBusiness = function(cell, forceBusinessDay) {
            var start = cell.start;
            var end = cell.end;

            var cellDuration = (end.getTime() - start.getTime()) / (1000 * 60);  // minutes

            if (cellDuration <= 1440) {  // for one day per cell and lower only
                if (!calendar.businessWeekends && !forceBusinessDay) {
                    if (cell.start.dayOfWeek() === 0 || cell.start.dayOfWeek() === 6) {
                        return false;
                    }
                }
            }
            if (cellDuration < 720) {
                var startHour = start.getHours();
                startHour += start.getMinutes() / 60.0;
                startHour += start.getSeconds() / 3600.0;
                startHour += start.getMilliseconds() / 3600000.0;

                var begins = this.businessBeginsHour;
                var ends = this.businessEndsHour;
                if (ends === 0) {
                    ends = 24;
                }

                if (begins === ends) {
                    return false;
                }

                if (begins < ends) {
                    if (startHour < begins) {
                        return false;
                    }

                    if (ends >= 24) {
                        return true;
                    }
                    if (startHour >= ends) {
                        return false;
                    }
                }
                else {
                    if (startHour < ends) {
                        return true;
                    }
                    if (startHour >= begins) {
                        return true;
                    }
                    return false;
                }

            }

            return true;
        };

        this._show = function() {
            if (this.nav.top.style.visibility === 'hidden') {
                this.nav.top.style.visibility = 'visible';
            }
        };

        // sets the total height
        this._setHeight = function(pixels) {
            this.heightSpec = "Fixed";
            this.height = pixels - (this._getTotalHeaderHeight() + 2);
            this._updateHeight();
        };

        this.setHeight = this._setHeight;

        this._findRowByResourceId = function(id) {
            return calendar._rowcacheFor(id)[0];
        };

        this._loadTop = function() {
            if (this.id && this.id.tagName) {
                this.nav.top = this.id;
            }
            else if (typeof this.id === "string") {
                this.nav.top = document.getElementById(this.id);
                if (!this.nav.top) {
                    throw new DayPilot.Exception("DayPilot.Scheduler: The placeholder element not found: '" + id + "'.");
                }
            }
            else {
                throw new DayPilot.Exception("DayPilot.Scheduler() constructor requires the target element or its ID as a parameter");
            }
        };


        this.init = function() {
            if (this._initialized) {
                throw new DayPilot.Exception("This instance is already initialized. Use update() to change properties.")
            }
            this._loadTop();

            if (this.nav.top.dp) {
                if (this.nav.top.dp === calendar) {
                    return calendar;
                }
                throw new DayPilot.Exception("The target placeholder was already initialized by another DayPilot component instance.");
            }
            this._initUpdateBased();
            this._watchWidthChanges();
            return this;
        };

        this._initUpdateBased = function() {

            this._initPrepareDiv();
            this._registerGlobalHandlers();
            this._registerDispose();
            this._registerOnScroll();
            this._update();

            var angular = calendar._angular2.enabled;

            if (calendar.scrollToDate) {
                calendar.scrollTo(calendar.scrollToDate);
            }
            else if (calendar.scrollX || calendar.scrollY) {
                calendar.setScroll(calendar.scrollX, calendar.scrollY);
            }
            else if (!angular) {
                calendar._onScroll();
            }

            if (calendar.scrollToResourceId) {
                calendar.scrollToResource(calendar.scrollToResourceId);
                calendar.scrollToResourceId = null;
            }

            var setScrollY = function() {
                if (calendar.scrollY) {
                    calendar.setScroll(calendar.scrollX, calendar.scrollY);
                }
            };

            setTimeout(setScrollY, 200);

            this._clearCachedValues();
            this._postInit();

            this._initialized = true;

            var p = calendar._scrollToAfterInit;
            if (p) {
                calendar.scrollTo(p);
            }
            else {
                calendar._onScroll();
            }
        };

        this._specialHandling = null;
        this._loadOptions = function(options) {
            if (!options) {
                return;
            }

            var specialHandling = {
                "resources": {
                    "preInit": function() {
                        var resources = this.data;
                        // calendar._angular2._resourcesFromConfig = !!resources;
                        if (!resources) {
                            return;
                        }
                        calendar.resources = resources;
                    }
                },
                "events": {
                    "preInit": function() {
                        var events = this.data;
                        // calendar._angular2._eventsFromConfig = !!events;
                        if (!events) {
                            return;
                        }
                        if (DayPilot.isArray(events.list)) {
                            calendar.events.list = events.list;
                        }
                        else {
                            calendar.events.list = events;
                        }
                    },
                    "postInit": function() {

                    }
                },
                "scrollTo": {
                    "preInit": function() {

                    },
                    "postInit": function() {
                        if (this.data) {
                            calendar._scrollTo(this.data);
                        }
                    }
                },
                "scrollX": {
                    "postInit": function() {
                        if (this.data) {
                            calendar._setScrollX(this.data);
                        }
                    }
                },
                "scrollY": {
                    "postInit": function() {
                        if (this.data) {
                            calendar._setScrollY(this.data);
                        }
                    }
                },
            };
            calendar._specialHandling = specialHandling;

            if (calendar._angular2.scrollToRequested) {
                specialHandling.scrollTo.data = calendar._angular2.scrollToRequested;
                calendar._angular2.scrollToRequested = null;
            }
            if (calendar._angular2.scrollXRequested) {
                specialHandling.scrollX.data = calendar._angular2.scrollXRequested;
                calendar._angular2.scrollXRequested = null;
            }
            if (calendar._angular2.scrollYRequested) {
                specialHandling.scrollY.data = calendar._angular2.scrollYRequested;
                calendar._angular2.scrollYRequested = null;
            }

            for (var name in options) {
                if (!specialHandling[name]) {
                    calendar[name] = options[name];
                }
            }

            // call preInit after initialization of plain items
            for (var name in options) {
                if (specialHandling[name]) {
                    var item = specialHandling[name];
                    item.data = options[name];
                    if (item.preInit) {
                        item.preInit();
                    }
                }
            }

        };

        this._postInit = function() {
            var specialHandling = calendar._specialHandling;
            for (var name in specialHandling) {
                var item = specialHandling[name];
                if (item.postInit) {
                    item.postInit();
                }
            }
            calendar._specialHandling = {};
        };

        this._vue = {};
        this._vue._vueImport = null;
        this._vue._renderVueComponent = function(component, target, props) {
            var vue = calendar._vue._vueImport;
            if (typeof vue.createVNode === "function" && typeof vue.render === "function") {
                var vnode = vue.createVNode(component, props);
                vue.render(vnode, target);
            }
        };

        this._vue._renderVueNode = function(vnode, target) {
            var vue = calendar._vue._vueImport;
            if (typeof vue.render === "function") {
                var toRender = vnode;
                if (DayPilot.isArray(vnode)) {
                    toRender = vue.h("div", null, vnode);
                }
                vue.render(toRender, target);
            }
        };

        this._vue._unmountVueComponent = function(target) {
            var vue = calendar._vue._vueImport;
            if (typeof vue.render === "function") {
                vue.render(null, target);
            }
        };

        // communication between components
        this.internal = {};

        // DayPilot.Event
        this.internal.adjustEndIn = calendar._adjustEndIn;
        this.internal.adjustEndNormalize = calendar._adjustEndNormalize;
        this.internal.xssTextHtml = calendar._xssTextHtml;
        this.internal.touch = calendar._touch;

        // Angular2
        this.internal.skipUpdate = calendar._angular2.skipUpdate;
        this.internal.skipped = calendar._angular2.skipped;
        this.internal.loadOptions = calendar._loadOptions;
        this.internal.postInit = calendar._postInit;
        this.internal.enableAngular2 = function() { calendar._angular2.enabled = true; };
        this.internal.eventsFromAttr = function() { calendar._angular2._eventsFromAttr = true; };
        this.internal.resourcesFromAttr = function() { calendar._angular2._resourcesFromAttr = true; };
        this.internal.evImmediateRefresh = function() { calendar.events._immediateRefresh(); };

        // React
        this.internal.enableReact = function (react, reactDOM) {
            calendar._react.react = react;
            calendar._react.reactDOM = reactDOM;
        };
        this.internal.reactRefs = function() {
            return DayPilot.Util.copyProps(calendar._react, {}, ["react", "reactDOM"]);
        };

        // Vue
        this.internal.enableVue = function(vue) {
            calendar._vue._vueImport = vue;
        };
        this.internal.vueRef = function() {
            return calendar._vue._vueImport;
        };
        this.internal.vueRendering = function() {
            return calendar._vue._renderingEvent;
        };


        this._loadOptions(options);

    };

    debug = new DayPilot.Scheduler().v === "${v\u007d";

    DayPilot.Row = function(row, calendar) {
        if (!row) {
            throw new DayPilot.Exception("Now row object supplied when creating DayPilot.Row");
        }
        if (!calendar) {
            throw new DayPilot.Exception("No parent control supplied when creating DayPilot.Row");
        }

        this._original = {};
        var original = this._original;

        original.id = row.id;
        original.name = row.name;
        original.data = row.resource;
        original.tags = row.tags;

        var r = this;
        r.isRow = true;
        r.menuType = 'resource';
        r.name = row.name;
        r.id = row.id;
        r.tags = row.tags;
        r.index = row.index;
        r.calendar = calendar;
        r.data = row.resource;
        r._row = row;
        r.$ = {};
        r.$.row = row;
        r.toJSON = function(key) {
            var json = {};
            json.start = this.start;
            json.name = this.name;
            json.id = this.id;
            json.index = this.index;

            return json;
        };

        r.events = {};
        r.events.all = function() {
            var list = [];
            for (var i = 0; i < r._row.events.length; i++) {
                list.push(r._row.events[i]);
            }
            return list;
        };

        r.events.isEmpty = function() {
            return r._row.events.length === 0;
        };

        r.events.forRange = function(start, end) {
            return r._row.events.forRange(start, end);
        };

        r.events.totalDuration = function() {
            var ticks = 0;
            r.events.all().forEach(function(item) {
                ticks += item.part.end.getTime() - item.part.start.getTime();
            });
            return new DayPilot.Duration(ticks);
        };

        r.remove = function() {
            calendar.rows.remove(r);
        };

        r.addClass = function(cssClass) {
            var table = calendar.divHeader;

            var row = table.rows[r.index];
            DayPilot.Util.addClass(row, cssClass);

            r.$.row.cssClass = DayPilot.Util.addClassToString(r.$.row.cssClass, cssClass);
            r.data.cssClass = cssClass;
        };

        r.removeClass = function(cssClass) {
            var table = calendar.divHeader;

            var row = table.rows[r.index];
            DayPilot.Util.removeClass(row, cssClass);

            r.$.row.cssClass = DayPilot.Util.removeClassFromString(r.$.row.cssClass, cssClass);
            r.data.cssClass = DayPilot.Util.removeClassFromString(r.data.cssClass, cssClass);
        };
    };

    // internal moving
    DayPilotScheduler._moving = null;
    DayPilotScheduler._movingEvent = null;

    // internal resizing
    DayPilotScheduler._originalMouse = null;
    DayPilotScheduler._resizing = null;
    DayPilotScheduler._resizingEvent = null;
    DayPilotScheduler._preventEventClick = false;

    DayPilotScheduler._globalHandlers = false;
    DayPilotScheduler._timeRangeTimeout = null;

    // selecting
    DayPilotScheduler._selectedCells = null;

    DayPilotScheduler._unregister = function(calendar) {
        DayPilot.ue(document, 'mouseup', DayPilotScheduler._gMouseUp);
        DayPilot.ue(document, 'touchmove', DayPilotScheduler._gTouchMove);
        DayPilot.ue(document, 'touchend', DayPilotScheduler._gTouchEnd);
        DayPilotScheduler._globalHandlers = false;
    };

    function touchMousePos(ev) {
        var x = ev.touches[0].pageX;
        var y = ev.touches[0].pageY;

        var mousePos = {};
        mousePos.x = x;
        mousePos.y = y;
        return mousePos;
    }

    DayPilotScheduler._gTouchMove = function(ev) {

        if (DayPilotScheduler._resizing) {
            var calendar = DayPilotScheduler._resizing.event.calendar;
            calendar.coords = calendar._touch._relativeCoords(ev);
            calendar._touch._updateResizing();
            ev.preventDefault();
        }

        if (DayPilotScheduler._moving) {
            ev.preventDefault();
            var calendar = DayPilotScheduler._movingEvent.calendar;
            calendar.coords = calendar._touch._relativeCoords(ev);
            calendar._touch._updateMoving();
        }

    };

    DayPilotScheduler._gTouchEnd = function(ev) {
        DayPilotScheduler._touchingRes = false;
        DayPilotScheduler._gMouseUp(ev);
    };

    DayPilotScheduler._gMouseUp = function(ev) {

        if (DayPilotScheduler._resizing) {

            var cleanup = function() {
                var e = DayPilotScheduler._resizingEvent;
                var calendar = e.calendar;

                body().style.cursor = '';
                DayPilotScheduler._resizing = null;
                DayPilotScheduler._resizingEvent = null;

                DayPilot.de(DayPilotScheduler._resizingShadow);
                DayPilotScheduler._resizingShadow = null;

                if (calendar) {
                    calendar._lastEventResizing = null;
                }

            };

            setTimeout(function() {  // it needs to survive onEventClick
                DayPilotScheduler._preventEventClick = false;
            });

            if (!DayPilotScheduler._resizingShadow) {
                cleanup();
                return;
            }

            var e = DayPilotScheduler._resizingEvent;
            var calendar = e.calendar;

            var newStart = DayPilotScheduler._resizingShadow.start;
            var newEnd = DayPilotScheduler._resizingShadow.end;

            var what = DayPilotScheduler._resizing.dpBorder === "left" ? "start" : "end";

            cleanup();

            // action here
            calendar._eventResizeDispatch(e, newStart, newEnd, what);
        }
        else if (DayPilotScheduler._movingEvent) {

            var cleanup = function() {

                DayPilot.Global.movingAreaData = null;

                var calendar = DayPilotScheduler._movingShadow && DayPilotScheduler._movingShadow.calendar;

                if (DayPilotScheduler._movingShadow) {
                    DayPilot.de(DayPilotScheduler._movingShadow);
                    DayPilotScheduler._movingShadow.calendar = null;
                }

                body().style.cursor = '';
                DayPilotScheduler._moving = null;
                DayPilotScheduler._movingEvent = null;

                if (calendar) {
                    calendar._lastEventMoving = null;
                }

            };

            if (!DayPilotScheduler._movingShadow) {
                cleanup();
                return;
            }

            var e = DayPilotScheduler._movingEvent;

            var calendar = DayPilotScheduler._movingShadow.calendar;

            if (!calendar) {
                cleanup();
                return;
            }

            DayPilotScheduler._movingShadow.source = DayPilotScheduler._moving;

            // remove later, when clearing the moving shadow
            // DayPilot.Util.removeClass(DayPilotScheduler._moving, calendar._prefixCssClass(calendar._css.eventMovingSource));

            if (!DayPilotScheduler._movingShadow.row) {
                cleanup();
                return;
            }

            var newStart = DayPilotScheduler._movingShadow.start;
            var newEnd = DayPilotScheduler._movingShadow.end;
            var newResource = DayPilotScheduler._movingShadow.row.id;

            DayPilotScheduler._movingShadow.calendar = null;
            body().style.cursor = '';
            DayPilotScheduler._moving = null;
            DayPilotScheduler._movingEvent = null;

            calendar._eventMoveDispatch(e, newStart, newEnd, newResource, ev);

            DayPilot.Global.movingAreaData = null;
        }
        else if (DayPilotScheduler._range) {

            var button = DayPilot.Util.mouseButton(ev);

            var range = DayPilotScheduler._range;
            var calendar = range.calendar;

            var cleanup = function() {
            };

            calendar._lastRange = null;

            var ctrl = ev.ctrlKey || ev.metaKey;

            if (DayPilotScheduler._timeRangeTimeout) {
                clearTimeout(DayPilotScheduler._timeRangeTimeout);
                DayPilotScheduler._timeRangeTimeout = null;

                cleanup();
                return;
            }

            calendar._rangeHold = range;

            // must be cleared before dispatching
            DayPilotScheduler._range = null;

            var createTimeRangeDispatcher = function(range) {
                return function() {

                    DayPilotScheduler._timeRangeTimeout = null;

                    calendar._timeRangeSelectedDispatchFromRange(range);

                    if (calendar.timeRangeSelectedHandling !== "Hold" && calendar.timeRangeSelectedHandling !== "HoldForever") {
                        doNothing();
                        //calendar.deleteRange();
                    }
                    else {
                        calendar._rangeHold = range;
                    }
                };
            };

            var rc = calendar._copyRange(range); // might not be necessary

            cleanup();

            if (!button.left) { // only left-click
                DayPilotScheduler._timeRangeTimeout = null;
                return;
            }

            createTimeRangeDispatcher(rc)();

            ev.cancelBubble = true;
            return false;  // trying to prevent onmaindclick

        }

        DayPilotScheduler._moveOffsetX = null;
        DayPilotScheduler._moveDragStart = null;

    };

})(DayPilot);
