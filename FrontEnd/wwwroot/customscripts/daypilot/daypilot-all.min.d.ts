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

type GlobalDate = Date;

export module DayPilot {

    export class SchedulerPropsAndEvents {
        backendUrl?: string;
        businessBeginsHour?: number;
        businessEndsHour?: number;
        businessWeekends?: boolean;
        cellDuration?: number;
        cellGroupBy?: GroupBy;
        cellSweeping?: boolean;
        cellSweepingCacheSize?: number;
        cellWidth?: number;
        cellsMarkBusiness?: boolean;
        contextMenu?: DayPilot.Menu;
        days?: number;
        durationBarHeight?: number;
        durationBarVisible?: boolean;
        dynamicEventRendering?: "Progressive" | "Disabled";
        dynamicEventRenderingCacheSize?: number;
        dynamicEventRenderingCacheSweeping?: boolean;
        dynamicEventRenderingMargin?: number;
        dynamicEventRenderingMarginX?: number;
        dynamicEventRenderingMarginY?: number;
        // eventBorderRadius?: string | number;eventBubbleShowForMargins?: boolean;
        eventClickHandling?: "Enabled" | "Disabled";
        eventDeleteHandling?: "Update" | "Disabled";
        eventEndSpec?: "DateTime" | "Date";
        eventHeight?: number;
        eventMinWidth?: number;
        eventMoveHandling?: "Update" | "Disabled";
        eventResizeHandling?: "Update" | "Disabled";
        eventResizeMargin?: number;
        eventRightClickHandling?: "Enabled" | "Disabled" | "ContextMenu";
        eventTapAndHoldHandling?: "Move" | "ContextMenu";
        eventTextWrappingEnabled?: boolean;
        eventsLoadMethod?: "GET" | "POST";
        floatingEvents?: boolean;
        floatingTimeHeaders?: boolean;
        headerHeight?: number;
        height?: number;
        heightSpec?: "Auto" | "Max" | "Fixed";
        locale?: string | DayPilot.Locale;
        progressiveRowRendering?: boolean;
        progressiveRowRenderingPreload?: number;
        resources?: ResourceData[];
        // rowClickHandling?: "Enabled" | "Disabled" | "CallBack" | "Edit" | "Select";
        rowHeaderWidth?: number;
        rowsLoadMethod?: "GET" | "POST";
        scale?: "CellDuration" | "Minute" | "Hour" | "Day" | "Week";
        scrollDelayCells?: number;
        scrollDelayEvents?: number;
        scrollDelayFloats?: number;
        scrollDelayRows?: number;
        showToolTip?: boolean;
        snapToGrid?: boolean;
        startDate?: DayPilot.Date | string;
        tapAndHoldTimeout?: number;
        theme?: string;
        timeFormat?: "Auto" | "Clock12Hours" | "Clock24Hours";
        timeHeaderClickHandling?: "Enabled" | "Disabled";
        timeHeaderTextWrappingEnabled?: boolean;
        timeHeaders?: TimeHeaderData[];
        timeRangeClickHandling?: "Enabled" | "Disabled";
        timeRangeSelectedHandling?: "Enabled" | "Disabled";
        useEventBoxes?: "Always" | "Never";
        visible?: boolean;
        weekStarts?: "Auto" | number;
        width?: string;
        xssProtection?: "Enabled" | "Disabled";

        onAfterUpdate?: EventHandler<SchedulerAfterUpdateArgs>;
        onBeforeEventRender?: EventHandler<SchedulerBeforeEventRenderArgs>;
        onBeforeRowHeaderRender?: EventHandler<SchedulerBeforeRowHeaderRenderArgs>;
        onBeforeTimeHeaderRender?: EventHandler<SchedulerBeforeTimeHeaderRenderArgs>;

        onEventClick?: EventHandler<SchedulerEventClickArgs>;
        onEventClicked?: EventHandler<SchedulerEventClickedArgs>;
        onEventDelete?: EventHandler<SchedulerEventDeleteArgs>;
        onEventDeleted?: EventHandler<SchedulerEventDeletedArgs>;
        onEventMove?: EventHandler<SchedulerEventMoveArgs>;
        onEventMoved?: EventHandler<SchedulerEventMovedArgs>;
        onEventResize?: EventHandler<SchedulerEventResizeArgs>;
        onEventResized?: EventHandler<SchedulerEventResizedArgs>;
        onEventRightClick?: EventHandler<SchedulerEventRightClickArgs>;
        onEventRightClicked?: EventHandler<SchedulerEventRightClickedArgs>;
        onRowClick?: EventHandler<SchedulerRowClickArgs>;
        onRowClicked?: EventHandler<SchedulerRowClickedArgs>;
        onTimeHeaderClick?: EventHandler<SchedulerTimeHeaderClickArgs>;
        onTimeHeaderClicked?: EventHandler<SchedulerTimeHeaderClickedArgs>;
        onTimeHeaderRightClick?: EventHandler<SchedulerTimeHeaderRightClickArgs>;
        onTimeHeaderRightClicked?: EventHandler<SchedulerTimeHeaderRightClickedArgs>;
        onTimeRangeClick?: EventHandler<SchedulerTimeRangeClickArgs>;
        onTimeRangeClicked?: EventHandler<SchedulerTimeRangeClickedArgs>;
        onTimeRangeSelect?: EventHandler<SchedulerTimeRangeSelectArgs>;
        onTimeRangeSelected?: EventHandler<SchedulerTimeRangeSelectedArgs>;
    }

    export class SchedulerConfig extends SchedulerPropsAndEvents {
        events?: EventData[];
    }

    export class Scheduler extends SchedulerPropsAndEvents {
        v: string;
        events: {
            list: EventData[];

            add(e: DayPilot.Event): void;
            add(data: EventData): void;
            all(): DayPilot.Event[];
            find(id: EventId): DayPilot.Event;
            find(filter: (e: DayPilot.Event) => boolean): DayPilot.Event;
            findAll(filter: (e: DayPilot.Event) => boolean): DayPilot.Event[];
            findAll(example: any): DayPilot.Event[];
            forRange(start?: DayPilot.Date | string, end?: DayPilot.Date | string): DayPilot.Event[];
            load(url: string,
                 success: (args: { data: any; preventDefault(): void; }) => void,
                 error: (args: { request: XMLHttpRequest, exception: any; }) => void
            ): void;
            remove(e: DayPilot.Event): void;
            remove(data: EventData): void;
            remove(id: EventId): void;
            scrollIntoView(e: DayPilot.Event): void;
            update(e: DayPilot.Event): void;
            update(data: EventData): void;
        };
        rows: {
            add(data: ResourceData): void;
            all(): DayPilot.Row[];
            each(f: () => DayPilot.Row): void;
            find(filter: (row: DayPilot.Row) => boolean, startIndex?: number): DayPilot.Row;
            find(id: ResourceId, start?: DayPilot.Date | string): DayPilot.Row;
            load(url: string,
                 success: (args: { data: any; preventDefault(): void; }) => void,
                 error: (args: { request: XMLHttpRequest, exception: any; }) => void
            ): void;
            remove(row: DayPilot.Row): void;
            remove(id: ResourceId): void;
            sort(spec?: string | { field: string, order?: "asc" | "desc" }): void;
            update(row: DayPilot.Row | ResourceData): void;
        };

        constructor(id: string | HTMLElement, options?: SchedulerConfig);

        clearSelection(): void;

        dispose(): void;

        disposed(): boolean;

        dragInProgress(): boolean;

        getDate(pixels: number, precise?: boolean, isEnd?: boolean): DayPilot.Date;

        getScrollX(): number;

        getScrollY(): number;

        getViewport(): SchedulerViewport;

        hide(): void;

        init(): void;

        scrollTo(date: string | DayPilot.Date): void;

        scrollToResource(id: ResourceId | DayPilot.Row): void;

        selectTimeRange(start: DayPilot.Date | string, end: DayPilot.Date | string, resource: ResourceId, dontFireEvent?: boolean): void;

        setHeight(pixels: number): void;

        setScroll(scrollX: number, scrollY: number): void;

        setScrollX(scrollX: number): void;

        setScrollY(scrollY: number): void;

        show(): void;

        update(options?: SchedulerConfig): void;

        visibleStart(): DayPilot.Date;

        visibleEnd(): DayPilot.Date;

    }

    export interface SchedulerAfterUpdateArgs {
    }

    export interface SchedulerBeforeEventRenderArgs {
        readonly control: DayPilot.Scheduler;
        readonly data: EventData;
    }

    export interface SchedulerBeforeRowHeaderRenderArgs {
        readonly row: RenderRow;
    }

    export interface SchedulerBeforeTimeHeaderRenderArgs {
        readonly control: Scheduler;
        readonly header: {
            readonly start: DayPilot.Date;
            readonly end: DayPilot.Date;
            readonly level: number;
            areas: AreaData[];
            text: string;
            html: string;
            toolTip: string;
            backColor: string;
            fontColor: string;
            cssClass: string;
        };
    }

    export interface SchedulerEventClickArgs {
        readonly e: DayPilot.Event;
        readonly div: HTMLElement;
        readonly ctrl: boolean;
        readonly meta: boolean;
        readonly shift: boolean;
        readonly control: DayPilot.Scheduler;
        readonly originalEvent: MouseEvent;
        preventDefault(): void;
    }

    export interface SchedulerEventClickedArgs {
        readonly e: DayPilot.Event;
        readonly div: HTMLElement;
        readonly ctrl: boolean;
        readonly meta: boolean;
        readonly shift: boolean;
        readonly control: DayPilot.Scheduler;
        readonly originalEvent: MouseEvent;
    }

    export interface SchedulerEventDeleteArgs {
        readonly e: DayPilot.Event;
        readonly control: DayPilot.Scheduler;
        preventDefault(): void;
    }

    export interface SchedulerEventDeletedArgs {
        readonly e: DayPilot.Event;
        readonly control: DayPilot.Scheduler;
    }

    export interface SchedulerEventMoveArgs {
        async: boolean;
        readonly areaData: any;
        readonly control: DayPilot.Scheduler;
        readonly e: DayPilot.Event;
        newStart: DayPilot.Date;
        newEnd: DayPilot.Date;
        newResource: ResourceId;
        readonly ctrl: boolean;
        readonly shift: boolean;
        readonly meta: boolean;

        loaded(): void;
        preventDefault(): void;
    }

    export interface SchedulerEventMovedArgs {
        readonly async: boolean;
        readonly areaData: any;
        readonly control: DayPilot.Scheduler;
        readonly e: DayPilot.Event;
        readonly newStart: DayPilot.Date;
        readonly newEnd: DayPilot.Date;
        readonly newResource: ResourceId;
        readonly ctrl: boolean;
        readonly shift: boolean;
        readonly meta: boolean;
    }

    export interface SchedulerEventResizeArgs {
        readonly areaData: any;
        async: boolean;
        readonly control: DayPilot.Scheduler;
        readonly e: DayPilot.Event;
        newStart: DayPilot.Date;
        newEnd: DayPilot.Date;
        readonly what: "start" | "end";  // TODO check

        loaded(): void;
        preventDefault(): void;
    }

    export interface SchedulerEventResizedArgs {
        readonly areaData: any;
        readonly async: boolean;
        readonly control: DayPilot.Scheduler;
        readonly e: DayPilot.Event;
        readonly newStart: DayPilot.Date;
        readonly newEnd: DayPilot.Date;
        readonly what: "start" | "end";
    }

    export interface SchedulerEventRightClickArgs {
        readonly e: DayPilot.Event;
        readonly div: HTMLElement;
        readonly originalEvent: MouseEvent;

        preventDefault(): void;
    }

    export interface SchedulerEventRightClickedArgs {
        readonly e: DayPilot.Event;
        readonly div: HTMLElement;
        readonly originalEvent: MouseEvent;
    }

    export interface SchedulerRowClickArgs {
        readonly row: DayPilot.Row;
        readonly ctrl: boolean;
        readonly shift: boolean;
        readonly meta: boolean;
        readonly originalEvent: MouseEvent;
        preventDefault(): void;
    }

    export interface SchedulerRowClickedArgs {
        readonly row: DayPilot.Row;
        readonly ctrl: boolean;
        readonly shift: boolean;
        readonly meta: boolean;
        readonly originalEvent: MouseEvent;
    }

    export interface SchedulerTimeHeaderClickArgs {
        readonly control: Scheduler;
        readonly header: {
            readonly start: DayPilot.Date;
            readonly end: DayPilot.Date;
            readonly level: number;
        };
        readonly originalEvent: MouseEvent;
        readonly ctrl: boolean;
        readonly shift: boolean;
        readonly meta: boolean;

        preventDefault(): void;
    }

    export interface SchedulerTimeHeaderClickedArgs {
        readonly control: Scheduler;
        readonly header: {
            readonly start: DayPilot.Date;
            readonly end: DayPilot.Date;
            readonly level: number;
        };
        readonly originalEvent: MouseEvent;
        readonly ctrl: boolean;
        readonly shift: boolean;
        readonly meta: boolean;
    }

    export interface SchedulerTimeHeaderRightClickArgs {
        readonly header: {
            readonly start: DayPilot.Date;
            readonly end: DayPilot.Date;
            readonly level: number;
        };

        preventDefault(): void;
    }

    export interface SchedulerTimeHeaderRightClickedArgs {
        readonly header: {
            readonly start: DayPilot.Date;
            readonly end: DayPilot.Date;
            readonly level: number;
        };
    }

    export interface SchedulerTimeRangeClickArgs {
        readonly start: DayPilot.Date;
        readonly end: DayPilot.Date;
        readonly resource: ResourceId;

        preventDefault(): void;
    }

    export interface SchedulerTimeRangeClickedArgs {
        readonly start: DayPilot.Date;
        readonly end: DayPilot.Date;
        readonly resource: ResourceId;
    }

    export interface SchedulerTimeRangeSelectArgs {
        readonly start: DayPilot.Date;
        readonly end: DayPilot.Date;
        readonly resource: ResourceId;
        readonly control: DayPilot.Scheduler;

        preventDefault(): void;
    }

    export interface SchedulerTimeRangeSelectedArgs {
        readonly start: DayPilot.Date;
        readonly end: DayPilot.Date;
        readonly resource: ResourceId;
        readonly control: DayPilot.Scheduler;
    }

    // TODO check if all values are supported
    export type GroupBy = "Minute" | "Hour" | "Day" | "Week" | "Month" | "Quarter" | "Year" | "Cell" | "None";

    export interface SchedulerViewport {
        start: DayPilot.Date,
        end: DayPilot.Date,
        resources: ResourceId[]
    }

    export interface ResourceData {
        id?: ResourceId;
        name?: string;
        start?: DayPilot.Date | string;
        end?: DayPilot.Date | string;

        areas?: AreaData[];
        ariaLabel?: string;
        backColor?: string;
        fontColor?: string;
        cssClass?: string;
        html?: string;
        tags?: any;
        toolTip?: string;

        [prop: string]: any;
    }

    export interface TimeHeaderData {
        groupBy: GroupBy;
        format?: string;
        height?: number;
    }

    export class Row {
        events: {
            all(): DayPilot.Event[];
            isEmpty(): boolean;
            forRange(start: string | DayPilot.Date, end: string | DayPilot.Date): DayPilot.Event[];
            totalDuration(): DayPilot.Duration;
        };
        readonly calendar: DayPilot.Scheduler;
        readonly data: any;
        readonly id: ResourceId;
        readonly index: number;
        readonly level: number;
        readonly name: string;

        addClass(className: string): void;

        remove(): void;

        removeClass(className: string): void;
    }

    export class RenderRow extends Row {
        areas: AreaData[];
        backColor: string;
        cssClass: string;
        fontColor: string;
        horizontalAlignment: HorizontalAlignment;
        html: string;
        text: string;
        toolTip: string;
    }


    export class CalendarPropsAndEvents {
        backendUrl?: string;
        businessBeginsHour?: number;
        businessEndsHour?: number;
        cellHeight?: number;
        columnMarginLeft?: number;
        columnMarginRight?: number;
        columnsLoadMethod?: "POST" | "GET";
        contextMenu?: DayPilot.Menu;
        days?: number;
        doubleClickTimeout?: number;
        durationBarVisible?: boolean;
        eventBorderRadius?: string | number;
        eventClickHandling?: "Enabled" | "Disabled" | "CallBack" | "ContextMenu";
        eventDeleteHandling?: "Update" | "Disabled" | "CallBack";
        eventMoveHandling?: "Update" | "CallBack" | "Disabled";
        eventResizeHandling?: "Update" | "CallBack" | "Disabled";
        eventRightClickHandling?: "ContextMenu" | "Enabled" | "Disabled";
        headerClickHandling?: "Enabled" | "Disabled";
        headerDateFormat?: string;
        headerHeight?: number;
        headerTextWrappingEnabled?: boolean;
        height?: number;
        heightSpec?: "BusinessHours" | "BusinessHoursNoScroll" | "Full";
        hideUntilInit?: boolean;
        hourWidth?: number;
        initScrollPos?: number;
        loadingLabelText?: string;
        loadingLabelHtml?: string;
        loadingLabelVisible?: boolean;
        locale?: string;
        showToolTip?: boolean;
        snapToGrid?: boolean;
        startDate?: DayPilot.Date | string;
        theme?: string;
        timeFormat?: "Auto" | "Clock12Hours" | "Clock24Hours";
        timeRangeSelectedHandling?: "Enabled" | "Disabled" | "CallBack";
        useEventBoxes?: "Always" | "Never";
        viewType?: "Day" | "Days" | "Week" | "WorkWeek" | "Resources";
        visible?: boolean;
        weekStarts?: "Auto" | number;
        xssProtection?: "Enabled" | "Disabled";

        onAfterEventRender?: EventHandler<CalendarAfterEventRenderArgs>;

        onBeforeCellRender?: EventHandler<CalendarBeforeCellRenderArgs>;
        onBeforeEventRender?: EventHandler<CalendarBeforeEventRenderArgs>;
        onBeforeHeaderRender?: EventHandler<CalendarBeforeHeaderRenderArgs>;

        onEventClick?: EventHandler<CalendarEventClickArgs>;
        onEventClicked?: EventHandler<CalendarEventClickedArgs>;
        onEventDelete?: EventHandler<CalendarEventDeleteArgs>;
        onEventDeleted?: EventHandler<CalendarEventDeletedArgs>;
        onEventMove?: EventHandler<CalendarEventMoveArgs>;
        onEventMoved?: EventHandler<CalendarEventMovedArgs>;
        onEventResize?: EventHandler<CalendarEventResizeArgs>;
        onEventResized?: EventHandler<CalendarEventResizedArgs>;
        onEventRightClick?: EventHandler<CalendarEventRightClickArgs>;
        onEventRightClicked?: EventHandler<CalendarEventRightClickedArgs>;
        onHeaderClick?: EventHandler<CalendarHeaderClickArgs>;
        onHeaderClicked?: EventHandler<CalendarHeaderClickedArgs>;
        onTimeRangeSelect?: EventHandler<CalendarTimeRangeSelectArgs>;
        onTimeRangeSelected?: EventHandler<CalendarTimeRangeSelectedArgs>;

    }

    export class CalendarConfig extends CalendarPropsAndEvents {
        columns?: CalendarColumnData[];
        events?: EventData[];
    }

    export class Calendar extends CalendarPropsAndEvents {
        v: string;
        columns: {
            list: CalendarColumnData[];
            load(url: string,
                 success: (args: { data: any; preventDefault(): void; }) => void,
                 error: (args: { request: XMLHttpRequest, exception: any; }) => void
            ): void;
        };
        events: {
            list: EventData[];
            add(e: DayPilot.Event | EventData): void;
            find(id: string): DayPilot.Event;
            find(filter: (e: DayPilot.Event) => boolean): DayPilot.Event;
            forRange(start?: DayPilot.Date | string, end?: DayPilot.Date | string): DayPilot.Event[];
            load(url: string,
                 success: (args: { data: any; preventDefault(): void; }) => void,
                 error: (args: { request: XMLHttpRequest, exception: any; }) => void
            ): void;
            remove(e: DayPilot.Event): void;
            remove(id: EventId): void;
            update(e: DayPilot.Event | EventData): void;
        };

        constructor(id: string | HTMLElement, options?: CalendarConfig);

        clearSelection(): void;

        dispose(): void;

        disposed(): boolean;

        getScrollY(): number;

        getSelection(): DayPilot.Selection;

        hide(): void;

        init(): void;

        setScrollY(scrollY: number): void;

        show(): void;

        update(options?: CalendarConfig): void;

        visibleStart(): DayPilot.Date;

        visibleEnd(): DayPilot.Date;

    }

    export interface CalendarColumnData {
        name: string;
        id?: ResourceId;
        start?: DayPilot.Date | string;
        html?: string;
        toolTip?: string;
        tags?: any;
    }

    export interface CalendarAfterEventRenderArgs {
        readonly e: DayPilot.Event;
        readonly div: HTMLElement;
    }

    export interface CalendarBeforeCellRenderArgs {
        readonly cell: {
            readonly start: DayPilot.Date;
            readonly end: DayPilot.Date;
            readonly resource: ResourceId;
            readonly x: number;
            readonly y: number;
            readonly properties: {
                html: string;
                business: boolean;
                backColor: string;
                backImage: string;
                backRepeat: string;
                fontColor: string;
                cssClass: string;
                text: string;
            };
        };
    }

    export interface CalendarBeforeEventRenderArgs {
        readonly control: DayPilot.Calendar;
        readonly data: EventData;
    }

    export interface CalendarBeforeHeaderRenderArgs {
        readonly header: {
            readonly id: ResourceId;
            readonly start: DayPilot.Date;
            readonly name: string;
            readonly children: CalendarColumnData[];
            html: string;
            backColor: string;
            cssClass?: string;
            horizontalAlignment?: "left" | "center" | "right";
            verticalAlignment?: "top" | "center" | "bottom";
            toolTip: string;
            areas: AreaData[];
        };
        readonly column: Column;
    }

    export interface CalendarEventClickArgs {
        readonly e: DayPilot.Event;
        readonly control: DayPilot.Calendar;
        readonly ctrl: boolean;
        readonly meta: boolean;
        readonly originalEvent: MouseEvent;
        preventDefault(): void;
    }


    export interface CalendarEventClickedArgs {
        readonly e: DayPilot.Event;
        readonly control: DayPilot.Calendar;
        readonly ctrl: boolean;
        readonly meta: boolean;
        readonly originalEvent: MouseEvent;
    }

    export interface CalendarEventRightClickArgs {
        readonly e: DayPilot.Event;
        preventDefault(): void;
    }

    export interface CalendarEventRightClickedArgs {
        readonly e: DayPilot.Event;
    }

    export interface CalendarEventDeleteArgs {
        readonly e: DayPilot.Event;
        readonly control: DayPilot.Calendar;
        preventDefault(): void;
    }


    export interface CalendarEventDeletedArgs {
        readonly e: DayPilot.Event;
        readonly control: DayPilot.Calendar;
    }


    export interface CalendarEventMoveArgs {
        readonly e: DayPilot.Event;
        readonly control: DayPilot.Calendar;
        readonly newStart: DayPilot.Date;
        readonly newEnd: DayPilot.Date;
        readonly newResource: ResourceId;
        readonly ctrl: boolean;
        readonly shift: boolean;

        preventDefault(): void;
    }


    export interface CalendarEventMovedArgs {
        readonly e: DayPilot.Event;
        readonly control: DayPilot.Calendar;
        readonly newStart: DayPilot.Date;
        readonly newEnd: DayPilot.Date;
        readonly newResource: ResourceId;
        readonly ctrl: boolean;
        readonly shift: boolean;
    }


    export interface CalendarEventResizeArgs {
        readonly e: DayPilot.Event;
        readonly control: DayPilot.Calendar;
        readonly newStart: DayPilot.Date;
        readonly newEnd: DayPilot.Date;

        preventDefault(): void;
    }


    export interface CalendarEventResizedArgs {
        readonly e: DayPilot.Event;
        readonly control: DayPilot.Calendar;
        readonly newStart: DayPilot.Date;
        readonly newEnd: DayPilot.Date;
    }

    export interface CalendarHeaderClickArgs {
        readonly column: Column;
        readonly originalEvent: MouseEvent;
        readonly shift: boolean;
        readonly meta: boolean;
        readonly ctrl: boolean;
        preventDefault(): void;
    }

    export interface CalendarHeaderClickedArgs {
        readonly column: Column;
        readonly originalEvent: MouseEvent;
        readonly shift: boolean;
        readonly meta: boolean;
        readonly ctrl: boolean;
    }

    export interface CalendarTimeRangeSelectArgs {
        readonly start: DayPilot.Date;
        readonly end: DayPilot.Date;
        readonly resource: ResourceId;
        readonly control: DayPilot.Calendar;
        preventDefault(): void;
    }


    export interface CalendarTimeRangeSelectedArgs {
        readonly start: DayPilot.Date;
        readonly end: DayPilot.Date;
        readonly resource: ResourceId;
        readonly control: DayPilot.Calendar;
    }

    export class Column {
        readonly id: ResourceId;
        readonly start: DayPilot.Date;
        readonly name: string;
        readonly data: CalendarColumnData;
    }

    export class MonthPropsAndEvents {
        backendUrl?: string;
        cellHeaderClickHandling?: "Enabled" | "Disabled";
        cellHeaderHeight?: number;
        cellHeight?: number;
        cellMarginBottom?: number;
        contextMenu?: DayPilot.Menu;
        eventBarVisible?: boolean;
        eventBorderRadius?: string | number;
        eventClickHandling?: "Enabled" | "Disabled" | "CallBack" | "ContextMenu";
        eventRightClickHandling?: "ContextMenu" | "Enabled" | "Disabled";
        eventHeight?: number;
        eventDeleteHandling?: "Update" | "Disabled";
        eventMoveHandling?: "Update" | "CallBack" | "Notify" | "Disabled";
        eventResizeHandling?: "Update" | "CallBack" | "Notify" | "Disabled";
        headerClickHandling?: "Enabled" | "Disabled" | "CallBack";
        headerHeight?: number;
        hideUntilInit?: boolean;
        lineSpace?: number;
        locale?: string;
        showToolTip?: boolean;
        startDate?: DayPilot.Date | string;
        theme?: string;
        timeRangeSelectedHandling?: "Enabled" | "Disabled" | "CallBack";
        visible?: boolean;
        weekStarts?: "Auto" | number;
        width?: string;
        xssProtection?: "Enabled" | "Disabled";

        onAfterEventRender?: EventHandler<MonthAfterEventRenderArgs>;

        onBeforeEventRender?: EventHandler<MonthBeforeEventRenderArgs>;
        onBeforeCellRender?: EventHandler<MonthBeforeCellRenderArgs>;

        onCellHeaderClick?: EventHandler<MonthCellHeaderClickArgs>;
        onCellHeaderClicked?: EventHandler<MonthCellHeaderClickedArgs>;
        onEventClick?: EventHandler<MonthEventClickArgs>;
        onEventClicked?: EventHandler<MonthEventClickedArgs>;
        onEventDelete?: EventHandler<MonthEventDeleteArgs>;
        onEventDeleted?: EventHandler<MonthEventDeletedArgs>;
        onEventMove?: EventHandler<MonthEventMoveArgs>;
        onEventMoved?: EventHandler<MonthEventMovedArgs>;
        onEventResize?: EventHandler<MonthEventResizeArgs>;
        onEventResized?: EventHandler<MonthEventResizedArgs>;
        onEventRightClick?: EventHandler<MonthEventRightClickArgs>;
        onEventRightClicked?: EventHandler<MonthEventRightClickedArgs>;
        onTimeRangeSelect?: EventHandler<MonthTimeRangeSelectArgs>;
        onTimeRangeSelected?: EventHandler<MonthTimeRangeSelectedArgs>;
    }

    export class MonthConfig extends MonthPropsAndEvents {
        events?: EventData[];
    }

    export class Month extends MonthPropsAndEvents {
        v: string;
        events: {
            list: EventData[];
            add(e: DayPilot.Event | EventData): void;
            find(id: string): DayPilot.Event;
            find(filter: (e: DayPilot.Event) => boolean): DayPilot.Event;
            forRange(start?: DayPilot.Date | string, end?: DayPilot.Date | string): DayPilot.Event[];
            load(url: string,
                 success: (args: { data: any; preventDefault(): void; }) => void,
                 error: (args: { request: XMLHttpRequest, exception: any; }) => void
            ): void;
            remove(e: DayPilot.Event): void;
            remove(id: EventId): void;
            update(e: DayPilot.Event): void;
        };

        constructor(id: string | HTMLElement, options?: MonthConfig);

        clearSelection(): void;

        dispose(): void;

        disposed(): boolean;

        init(): void;

        show(): void;

        hide(): void;

        update(options?: MonthConfig): void;

        visibleStart(): DayPilot.Date;

        visibleEnd(): DayPilot.Date;

    }

    export interface MonthAfterEventRenderArgs {
        readonly e: DayPilot.Event;
        readonly div: HTMLElement;
    }

    export interface MonthBeforeEventRenderArgs {
        readonly control: DayPilot.Month;
        readonly data: EventData;
    }

    export interface MonthBeforeCellRenderArgs {
        readonly control: DayPilot.Month;
        readonly cell: {
            readonly start: DayPilot.Date;
            readonly end: DayPilot.Date;
            readonly properties: {
                business: boolean;
                headerHtml: string;
                html: string;
                backColor: string;
            }
        }
    }

    export interface MonthCellHeaderClickArgs {
        readonly control: DayPilot.Month;
        readonly start: DayPilot.Date;
        readonly end: DayPilot.Date;
        preventDefault(): void;
    }

    export interface MonthCellHeaderClickedArgs {
        readonly control: DayPilot.Month;
        readonly start: DayPilot.Date;
        readonly end: DayPilot.Date;
    }

    export interface MonthEventClickArgs {
        readonly e: DayPilot.Event;
        readonly control: DayPilot.Month;
        readonly div: HTMLElement;
        readonly originalEvent: MouseEvent;
        readonly meta: boolean;
        readonly ctrl: boolean;
        preventDefault(): void;
    }

    export interface MonthEventClickedArgs {
        readonly e: DayPilot.Event;
        readonly control: DayPilot.Month;
        readonly div: HTMLElement;
        readonly originalEvent: MouseEvent;
        readonly meta: boolean;
        readonly ctrl: boolean;
    }

    export interface MonthEventRightClickArgs {
        readonly e: DayPilot.Event;
        preventDefault(): void;
    }

    export interface MonthEventRightClickedArgs {
        readonly e: DayPilot.Event;
    }

    export interface MonthEventDeleteArgs {
        readonly e: DayPilot.Event;
        readonly control: DayPilot.Month;
        preventDefault(): void;
    }

    export interface MonthEventDeletedArgs {
        readonly e: DayPilot.Event;
        readonly control: DayPilot.Month;
    }

    export interface MonthEventMoveArgs {
        readonly e: DayPilot.Event;
        readonly control: DayPilot.Month;
        readonly newStart: DayPilot.Date;
        readonly newEnd: DayPilot.Date;
        readonly ctrl: boolean;
        readonly shift: boolean;
        preventDefault(): void;
    }


    export interface MonthEventMovedArgs {
        readonly e: DayPilot.Event;
        readonly control: DayPilot.Month;
        readonly newStart: DayPilot.Date;
        readonly newEnd: DayPilot.Date;
        readonly ctrl: boolean;
        readonly shift: boolean;
    }


    export interface MonthEventResizeArgs {
        readonly e: DayPilot.Event;
        readonly control: DayPilot.Month;
        readonly newStart: DayPilot.Date;
        readonly newEnd: DayPilot.Date;
        preventDefault(): void;
    }


    export interface MonthEventResizedArgs {
        readonly e: DayPilot.Event;
        readonly control: DayPilot.Month;
        readonly newStart: DayPilot.Date;
        readonly newEnd: DayPilot.Date;
    }


    export interface MonthTimeRangeSelectArgs {
        readonly control: DayPilot.Month;
        readonly start: DayPilot.Date;
        readonly end: DayPilot.Date;
        preventDefault(): void;
    }


    export interface MonthTimeRangeSelectedArgs {
        readonly control: DayPilot.Month;
        readonly start: DayPilot.Date;
        readonly end: DayPilot.Date;
    }

    export class NavigatorPropsAndEvents {
        cellHeight?: number;
        cellWidth?: number;
        command?: string;
        dayHeaderHeight?: number;
        freeHandSelectionEnabled?: boolean;
        locale?: string;
        orientation?: "Vertical" | "Horizontal";
        rowsPerMonth?: "Auto" | "Six";
        selectionDay?: DayPilot.Date;
        selectionEnd?: DayPilot.Date;
        selectionStart?: DayPilot.Date;
        selectMode?: "Day" | "Week" | "Month" | "None";
        showMonths?: number;
        showToday?: boolean;
        showWeekNumbers?: boolean;
        skipMonths?: number;
        startDate?: DayPilot.Date | string;
        theme?: string;
        titleHeight?: number;
        todayHeight?: number;
        todayHtml?: string;
        todayPosition?: "Top" | "Bottom";
        todayText?: string;
        weekStarts?: "Auto" | number;
        weekNumberAlgorithm?: "Auto" | "US" | "ISO8601";
        timeRangeSelectedHandling?: "Bind" | "None";
        visibleRangeChangedHandling?: "Enabled" | "Disabled" | "CallBack";

        onBeforeCellRender?: EventHandler<NavigatorBeforeCellRenderArgs>;
        onTimeRangeSelect?: EventHandler<NavigatorTimeRangeSelectArgs>;
        onTimeRangeSelected?: EventHandler<NavigatorTimeRangeSelectedArgs>;
        onTodayClick?: EventHandler<NavigatorTodayClickArgs>;
        onVisibleRangeChange?: EventHandler<NavigatorVisibleRangeChangeArgs>;
        onVisibleRangeChanged?: EventHandler<NavigatorVisibleRangeChangedArgs>;
    }

    export class NavigatorConfig extends NavigatorPropsAndEvents {
        events?: EventData[];
    }

    interface NavigatorSelectOptions {
        dontFocus?: boolean;
        dontNotify?: boolean;
    }

    export class Navigator extends NavigatorPropsAndEvents {
        v: string;
        events: {
            list: EventDataShort[];
        };

        constructor(id: string | HTMLElement, options?: NavigatorConfig);

        init(): void;

        dispose(): void;

        update(options?: NavigatorConfig): void;

        select(date: DayPilot.Date | string, options?: NavigatorSelectOptions): void;
        select(start: DayPilot.Date | string, end: DayPilot.Date | string, options?: NavigatorSelectOptions): void;

        hide(): void;

        show(): void;

        visibleEnd(): DayPilot.Date;

        visibleStart(): DayPilot.Date;
    }

    interface NavigatorBeforeCellRenderArgs {
        readonly cell: {
            readonly day: DayPilot.Date;
            readonly isCurrentMonth: boolean;
            readonly isToday: boolean;
            readonly isWeekend: boolean;
            html: string;
            cssClass: string;
        };
    }

    interface NavigatorTimeRangeSelectArgs {
        readonly start: DayPilot.Date;
        readonly end: DayPilot.Date;
        readonly day: DayPilot.Date;
        readonly days: number;
        readonly mode: "Day" | "Week" | "Month" | "None" | "FreeHand";
        preventDefault(): void;
    }

    interface NavigatorTimeRangeSelectedArgs {
        readonly start: DayPilot.Date;
        readonly end: DayPilot.Date;
        readonly day: DayPilot.Date;
        readonly days: number;
        readonly mode: "Day" | "Week" | "Month" | "None" | "FreeHand";
    }

    export interface NavigatorTodayClickArgs {
        preventDefault(): void;
    }

    interface NavigatorVisibleRangeChangeArgs {
        readonly start: DayPilot.Date;
        readonly end: DayPilot.Date;
        preventDefault(): void;
    }

    interface NavigatorVisibleRangeChangedArgs {
        readonly start: DayPilot.Date;
        readonly end: DayPilot.Date;
    }

    export class Locale {
        datePattern: string;
        dateTimePattern: string;
        dayNames: string[];
        dayNamesShort: string[];
        monthNames: string[];
        monthNamesShort: string[];
        timeFormat: "Clock12Hours" | "Clock24Hours";
        timePattern: string;
        weekStarts: number;

        constructor(id: string, properties: {
            dayNames: string[];
            dayNamesShort: string[];
            monthNames: string[];
            monthNamesShort: string[];
            timePattern: string;
            datePattern: string;
            dateTimePattern: string;
            timeFormat: "Clock12Hours" | "Clock24Hours";
            weekStarts: number;
        });

        static register(locale: DayPilot.Locale): void;
        static find(id: string): DayPilot.Locale;
    }


    export class MenuPropsAndEvents {
        hideOnMouseOut?: boolean;
        items?: MenuItemData[];
        menuTitle?: string;
        onShow?: EventHandler<MenuShowArgs>;
        onHide?: EventHandler<MenuHideArgs>;
        showMenuTitle?: boolean;
        zIndex?: number;
        theme?: string;
    }

    export class MenuConfig extends MenuPropsAndEvents {
    }


    export class Menu extends MenuPropsAndEvents {
        v: string;
        constructor(options?: MenuConfig);

        show(target?: any): void;
        hide(): void;

        static hide(): void;
    }

    export interface MenuShowArgs {
        readonly source: any;
        readonly menu: DayPilot.Menu;
        preventDefault(): void;
    }

    export interface MenuHideArgs {
    }

    export class MenuBar {
        items: any[];

        constructor(id: string, options?: any);

        init(): void;

        dispose(): void;
    }

    export interface MenuItemData {
        action?: "CallBack" | "PostBack";
        command?: string;
        cssClass?: string;
        disabled?: boolean;
        hidden?: boolean;
        href?: string;
        icon?: string;
        image?: string;
        items?: MenuItemData[];
        onClick?: EventHandler<MenuItemClickArgs>;
        symbol?: string;
        tags?: any;
        target?: string;
        text?: string;
        html?: string;
    }

    export interface MenuItemClickArgs {
        readonly item: MenuItemData;
        readonly source: any;
        readonly originalEvent: MouseEvent;
        preventDefault(): void;
    }


    export class SwitcherPropsAndEvents {
        selectedClass?: string;
        syncScrollbar?: boolean;

        onChange?: EventHandler<SwitcherChangeArgs>;
        onChanged?: EventHandler<SwitcherChangedArgs>;
        onSelect?: EventHandler<SwitcherSelectArgs>;
    }

    export class SwitcherConfig extends SwitcherPropsAndEvents {
        triggers?: SwitcherTrigger[];
        navigator?: DayPilot.Navigator;
    }

    export class Switcher extends SwitcherPropsAndEvents {
        constructor(options?: SwitcherConfig);
        readonly active: SwitcherView;

        addTrigger(id: string | HTMLElement, view: SwitcherViewControl): void;
        addNavigator(navigator: DayPilot.Navigator): void;
        select(triggerId: string): void;

        events: {
            load(url: string,
                 success: (args: { data: any; preventDefault(): void; }) => void,
                 error: (args: { request: XMLHttpRequest, exception: any; }) => void
            ): void;
        }

    }

    export interface SwitcherView {
        control: SwitcherViewControl;
    }

    export interface SwitcherTrigger {
        id: string | HTMLElement;
        view: SwitcherViewControl;
    }

    export interface SwitcherChangeArgs {
        readonly start: DayPilot.Date;
        readonly end: DayPilot.Date;
        readonly day: DayPilot.Date;
        readonly target: SwitcherView;
        preventDefault(): void;
    }

    export interface SwitcherChangedArgs {
        readonly start: DayPilot.Date;
        readonly end: DayPilot.Date;
        readonly day: DayPilot.Date;
        readonly target: SwitcherView;
    }

    export interface SwitcherSelectArgs {
        readonly source: HTMLElement;
        readonly target: SwitcherViewControl;
    }

    export type SwitcherViewControl = DayPilot.Calendar | DayPilot.Month;


    export class Date {
        constructor(str?: string | DayPilot.Date);
        constructor(date: GlobalDate, isLocal?: boolean);

        addDays(days: number): DayPilot.Date;

        addHours(hours: number): DayPilot.Date;

        addMilliseconds(millis: number): DayPilot.Date;

        addMinutes(minutes: number): DayPilot.Date;

        addMonths(months: number): DayPilot.Date;

        addSeconds(seconds: number): DayPilot.Date;

        addTime(ticks: number): DayPilot.Date;
        addTime(duration: DayPilot.Duration): DayPilot.Date;

        addYears(years: number): DayPilot.Date;

        dayOfWeek(): number;

        dayOfWeekISO(): number;

        dayOfYear(): number;

        daysInMonth(): number;

        daysInYear(): number;

        equals(another: DayPilot.Date): boolean;

        firstDayOfMonth(): DayPilot.Date;

        firstDayOfWeek(locale?: string | DayPilot.Locale): DayPilot.Date;
        firstDayOfWeek(firstDayOfWeek?: number): DayPilot.Date;

        firstDayOfYear(): DayPilot.Date;

        getDatePart(): DayPilot.Date;

        getDay(): number;

        getDayOfWeek(): number;

        getYear(): number;

        getHours(): number;

        getMilliseconds(): number;

        getMinutes(): number;

        getMonth(): number;

        getSeconds(): number;

        getTime(): number;

        getTimePart(): number;

        getTotalTicks(): number;

        getYear(): number;

        lastDayOfMonth(): DayPilot.Date;

        toDate(): GlobalDate;

        toDateLocal(): GlobalDate;

        toString(pattern?: string, locale?: string | DayPilot.Locale): string;

        toStringSortable(): string;

        weekNumber(): number;

        weekNumberISO(): number;

        static fromYearMonthDay(year: number, month: number, day: number): DayPilot.Date;
        static parse(input: string, pattern: string, locale?: string | DayPilot.Locale): DayPilot.Date;
        static today(): DayPilot.Date;
        static now(): DayPilot.Date;
        static Cache: DayPilotDateCache;
    }

    export class DayPilotDateCache {
        static clear(): void;
    }

    export class Util {
        static overlaps(start1: DayPilot.Date, end1: DayPilot.Date, start2: DayPilot.Date, end2: DayPilot.Date): boolean;
        static overlaps(start1: number, end1: number, start2: number, end2: number): boolean;
        static escapeHtml(text: string): string;
    }

    export class ColorUtil {
        static darker(color: string, steps?: number): string;
        static lighter(color: string, steps?: number): string;
        static contrasting(color: string, light?: string, dark?: string): string;
    }

    class Http {
        static get<T = any>(url: string, params?: Http.RequestParams): Promise<Http.Result<T>>;
        static post<T = any, B = any>(url: string, data: B, params?: Http.RequestParams): Promise<Http.Result<T>>;
        static put<T = any, B = any>(url: string, data: B, params?: Http.RequestParams): Promise<Http.Result<T>>;
        static patch<T = any, B = any>(url: string, data: B, params?: Http.RequestParams): Promise<Http.Result<T>>;
        static delete<T = any>(url: string, params?: Http.RequestParams): Promise<Http.Result<T>>;
    }

    namespace Http {
        interface RequestParams {
            contentType?: string;
            headers?: Record<string, string>;
        }
        interface Result<T = any> {
            request: XMLHttpRequest;
            data?: T;
        }
    }

    export class Duration {

        ticks: number;

        constructor(ticks: number);

        constructor(start: DayPilot.Date | string, end: DayPilot.Date | string);

        toString(pattern?: string): string;

        totalMilliseconds(): number;

        totalSeconds(): number;

        totalMinutes(): number;

        totalHours(): number;

        totalDays(): number;

        milliseconds(): number;

        seconds(): number;

        minutes(): number;

        hours(): number;

        days(): number;

        add(d: DayPilot.Duration): DayPilot.Duration;

        static ofWeeks(i: number): DayPilot.Duration;

        static ofDays(i: number): DayPilot.Duration;

        static ofHours(i: number): DayPilot.Duration;

        static ofMinutes(i: number): DayPilot.Duration;

        static ofSeconds(i: number): DayPilot.Duration;

    }

    export class Event {
        data: any;

        constructor(data: EventData);

        start(): DayPilot.Date;
        start(newStart: DayPilot.Date): void;

        end(): DayPilot.Date;
        end(newEnd: DayPilot.Date): void;

        id(): EventId;

        text(): string;
        text(newText: string): void;

        resource(): ResourceId;
        resource(newResource: ResourceId): void;

        duration(): DayPilot.Duration;
    }

    export class Selection {
        start: DayPilot.Date;
        end: DayPilot.Date;
        resource: string;
    }

    export interface EventDataShort {
        start: string | DayPilot.Date;
        end: string | DayPilot.Date;
    }

    export interface EventData {
        start: string | DayPilot.Date;
        end: string | DayPilot.Date;
        id: EventId;
        text: string;
        resource?: ResourceId;

        areas?: AreaData[];
        backColor?: string;
        barBackColor?: string;
        barColor?: string;
        barHidden?: boolean;
        borderColor?: string;
        cssClass?: string;
        fontColor?: string;
        html?: string;
        tags?: any;
        toolTip?: string;
    }

    export interface AreaData {
        action?: "Default" | "None" | "ContextMenu" | "ResizeEnd" | "ResizeStart" | "Move";
        backColor?: string;
        background?: string;
        borderRadius?: number | string;
        bottom?: number | string;
        cssClass?: string;
        fontColor?: string;
        height?: number | string;
        horizontalAlignment?: HorizontalAlignment;
        html?: string;
        icon?: string;
        id?: AreaId;
        image?: string;
        left?: number | string;
        menu?: Menu | string;
        onClick?: (args: any) => void;
        onClicked?: (args: any) => void;
        onMouseEnter?: (args: any) => void;
        onMouseLeave?: (args: any) => void;
        padding?: number;
        right?: number | string;
        style?: string;
        symbol?: string;
        text?: string;
        toolTip?: string;
        top?: number | string;
        verticalAlignment?: VerticalAlignment;
        visibility?: "Hover" | "Visible" | "TouchVisible";
        width?: number | string;
    }


    export function guid(): string;

    export interface EventHandler<T> {
        (args: T): void;
    }

    export type ResourceId = string | number;
    export type EventId = string | number;
    export type AreaId = string | number;

    export type HorizontalAlignment = "right" | "center" | "left";
    export type VerticalAlignment = "top" | "center" | "bottom";

    // modal

    export class ModalPropsAndEvents {
        autoFocus?: boolean;
        autoStretch?: boolean;
        autoStretchFirstLoadOnly?: boolean;
        container?: HTMLElement;
        disposeOnClose?: boolean;
        dragDrop?: boolean;
        focus?: string | { id: string, value: string | number };
        height?: number;
        left?: number;
        loadingHtml?: string;
        maxHeight?: number;
        scrollWithPage?: boolean;
        theme?: string;
        top?: number;
        useIframe?: boolean;
        width?: number;
        zIndex?: number;

        onClose?: EventHandler<ModalCloseArgs>;
        onClosed?: EventHandler<ModalClosedArgs>;
        onShow?: EventHandler<ModalShowArgs>;
    }

    export class ModalConfig extends ModalPropsAndEvents {
    }

    export class Modal extends ModalPropsAndEvents {
        constructor(options?: ModalConfig)

        close(result?: any): void;

        closeSerialized(): void;

        showHtml(html: string | HTMLElement): void;

        showUrl(url: string): void;

        stretch(): void;

        static close(): void;

        static opener(): void;

        static prompt(message: string, defaultValue?: string, options?: ModalPromptConfig): Promise<ModalClosedArgs>;

        static alert(message: string, options?: ModalAlertConfig): Promise<ModalClosedArgs>;

        static confirm(message: string, options?: ModalConfirmConfig): Promise<ModalClosedArgs>;

        static form(form?: ModalFormItem[], data?: any, options?: ModalFormConfig): Promise<ModalClosedArgs>;
    }

    export class ModalAlertConfig extends ModalConfig {
        okText?: string;
    }

    export class ModalConfirmConfig extends ModalConfig {
        okText?: string;
        cancelText?: string;
    }

    export class ModalPromptConfig extends ModalConfig {
        okText?: string;
        cancelText?: string;
    }

    export class ModalFormConfig extends ModalConfig {
        okText?: string;
        cancelText?: string;
        locale?: string;
        plugins?: any;
    }

    export interface ModalCloseArgs {
        canceled: boolean;
        result: any;
        backgroundClick: boolean;

        preventDefault(): void;
    }

    export interface ModalClosedArgs {
        canceled: boolean;
        result: any;
        backgroundClick: boolean;
    }

    export interface ModalShowArgs {
        root: Node
    }


    export interface ModalFormItem {
        id?: string;
        name?: string;
        type?: "text" | "date" | "searchable" | "select" | "radio" | "checkbox" | "table" | "title" | "image" | "html" | "textarea" | "scrollable" | string;
        image?: string;
        dateFormat?: string;
        disabled?: boolean;
        cssClass?: string;
        options?: ModalFormOption[];
        children?: ModalFormItem[];
        columns?: ModalFormTableColumns[];
        onValidate?: EventHandler<ModalFormItemValidationArgs>;
        onNewRow?: EventHandler<ModalFormTableItemNewRowArgs>;
        height?: number;
        text?: string;
        html?: string;
    }

    export interface ModalFormOption {
        id: string | number;
        name?: string;
        children?: ModalFormItem[];
    }

    export interface ModalFormTableColumns {
        id: string;
        name: string;
        type?: "text" | "number" | "select";
        options?: ModalFormOption[];
    }

    export interface ModalFormItemValidationArgs {
        value: any;
        result: any;
        valid: boolean;
        message: string;
    }

    export interface ModalFormTableItemNewRowArgs {
        value: any;
        result: any;
    }

}
