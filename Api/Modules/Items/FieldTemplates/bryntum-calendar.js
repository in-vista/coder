const options = {options};

const loader = $("#mainLoader");

// Loads the calendar view.
async function initializeCalendar() {
    return new Promise(resolve => {
        // Add loading indication.
        loader.addClass("loading");
        
        // Set the default language to be Dutch.
        const { LocaleManager } = window.bryntum.calendar;
        LocaleManager.applyLocale('Nl');
        
        // Retrieve the current date as the initial date of the calendar.
        const now = new Date();
        
        // Initializes the calendar.
        const calendar = new bryntum.calendar.Calendar({
            appendTo: 'calendar_{propertyIdWithSuffix}',
            date: now,
            weekStartDay: 1,
            sidebar: {
                items: {
                    resourceFilter: {
                        title: 'Medewerkers',
                        selected: []
                    }
                }
            },
            resourceImagePath: window.dynamicItems.settings.wiserApiRoot,
            modeDefaults : {
                showCurrentTime : {
                    showTime  : true,
                    fullWidth : true
                }
            },
            modes: {
                day: null,
                year: null,
                agenda: null,
                dayResources: {
                    type: 'resource',
                    title: 'Dag',
                    resourceWidth: '20em',
                    viewGap: 0,
                    hideNonWorkingDays: false,
                    view: {
                        type: 'dayview'
                    },
                    meta: resource => resource.title
                },
                week: true,
                month: true
            },
            features: {
                eventTooltip: true,
                timeRanges: true
            },
            async onDateRangeChange(event) {
                await onDateChange(this);
            },
            async onBeforeActiveItemChange(event) {
                await onDateChange(this);
            },
            onBeforeDragResizeEnd(event) {
                const { eventRecord, resourceRecord, newStartDate, newEndDate } = event;
                onEditEvent(eventRecord, resourceRecord, newStartDate, newEndDate);
                return true;
            },
            onBeforeDragMoveEnd(event) {
                const { eventRecord, resourceRecord, newStartDate, newEndDate } = event;
                onEditEvent(eventRecord, resourceRecord, newStartDate, newEndDate);
                return true;
            },
            ...options
        });
        
        // Register events for the calendar instance.
        calendar.on('beforeActiveItemChange', onBeforeActiveItemChange);
        calendar.on('beforeEventEdit', onBeforeEventEdit);

        // Remove loading indication.
        loader.removeClass("loading");
        
        // Resolve the promise and return the calendar instance.
        resolve(calendar);
    });
}

// Loads the data in the calendar view.
async function loadData(calendar, startDate, endDate) {
    // Add loading indication.
    loader.addClass("loading");
    
    // Temporarily store the current state of the calendar.
    const calendarState = calendar.state;
    
    // Temporarily clear the previously loaded data.
    calendar.eventStore.data = [];

    // Temporarily clear the previously loaded time ranges for the resource view.
    const isResourceView = calendar.activeView.isResourceView;
    if(isResourceView)
        calendar.resourceTimeRangeStore.data = [];

    // Determine the start and end range for this day.
    startDate = new Date(startDate.getTime());
    endDate = new Date(endDate.getTime());
    startDate.setHours(0, 0, 0, 0);
    endDate.setHours(23, 59, 59, 999);
    
    // A list of promises to run in parallel.
    const requestTasks = [
        // Request events.
        Wiser.api({
            method: "POST",
            url: dynamicItems.settings.wiserApiRoot + "items/" + encodeURIComponent("{itemIdEncrypted}") + "/action-button/{propertyId}?queryId=" + encodeURIComponent(options.queryId || 0),
            contentType: "application/json",
            data: JSON.stringify({
                start_date: startDate,
                end_date: endDate
            })
        })
    ];
    
    // If the current view is that of a resource, request the availability.
    if(isResourceView) {
        // Request availability.
        requestTasks.push(new Promise(async resolve => {
            const availabilityUrlResponse = await Wiser.api({
                method: 'POST',
                url: dynamicItems.settings.wiserApiRoot + "items/" + encodeURIComponent("{itemIdEncrypted}") + "/action-button/{propertyId}?queryId=" + encodeURIComponent(options.availabilityUrlQuery || 0),
                contentType: "application/json"
            });

            // Format the availability request URL.
            const formattedStartDate = `${startDate.getFullYear()}-${startDate.getMonth()}-${startDate.getDate()}`;
            const formattedEndDate = `${endDate.getFullYear()}-${endDate.getMonth()}-${endDate.getDate()}`;
            const availabilityUrl = availabilityUrlResponse.otherData[0]?.url;
            const fullAvailabilityUrl = `${availabilityUrl}&startDate=${formattedStartDate}&endDate=${formattedEndDate}`;

            // Prepare the availability request and callback.
            const request = new XMLHttpRequest();
            request.onreadystatechange = () => {
                if(request.readyState !== 4 || request.status !== 200)
                    return;

                const availability = JSON.parse(request.responseText);
                resolve(availability);
            }

            // Prepare the availability request URL and header(s).
            request.open('GET', fullAvailabilityUrl);
            request.setRequestHeader('Content-Type', 'application/json');

            // Send the availability request.
            request.send();
        }));
    }
    
    // Run the tasks in parallel.
    const requestTasksResponses = await Promise.allSettled(requestTasks);
    
    // Retrieve the responses for each of the request tasks.
    const eventsResponse = requestTasksResponses[0].value;
    
    // Only if the active view is that of a resource, process the availability time ranges.
    if(isResourceView) {
        // Retrieve the availability response.
        const availability = requestTasksResponses[1].value;
        
        // Process the availability as time ranges in the calendar view.
        for (const [resourceIdString, availabilityEntries] of Object.entries(availability)) {
            const resourceId = Number(resourceIdString);
            for (const { startDate, endDate } of availabilityEntries) {
                // Validate start and end date
                if (startDate > endDate)
                    continue;

                // Add a new record to the time range store.
                calendar.resourceTimeRangeStore.add({
                    resourceId: resourceId,
                    startDate: startDate,
                    endDate: endDate
                });
            }
        }
    }

    // Process the events.
    const events = eventsResponse.otherData;
    calendar.eventStore.data = events.map(event => {
        const duration = (new Date(event.end).getTime() - new Date(event.start).getTime()) / 60000;
        const name = `${event.title}${(event.arrangement_title ? ` (${event.arrangement_title})` : '')}${(event.notes ? ` ${event.notes}` : '')}`;
        const color = event.arrangement_color?.replace(/^#/, '');

        return {
            id: event.id,
            encryptedId: event.encryptedId,
            resourceId: event.medewerker,
            draggable: true,
            resizable: true,
            allDay: !!event.all_day,
            startDate: event.start,
            duration: duration,
            durationUnit: 'minute',
            name: name,
            eventColor: color
        }
    });

    // Re-apply the calendar's state before (re)loading the data.
    calendar.state = calendarState;
    
    // Remove loading indication.
    loader.removeClass("loading");
}

// Load the resources for the calendar.
async function loadResources(calendar, startDate, endDate) {
    // Temporarily clear the previously loaded data.
    calendar.resourceStore.data = [];

    // Determine the start and end range for this day.
    startDate = new Date(startDate.getTime());
    endDate = new Date(endDate.getTime());
    startDate.setHours(0);
    endDate.setHours(24);
    endDate.setTime(endDate.getTime() - 1);
    
    // Request the resource data.
    const resourcesResponse = await Wiser.api({
        url: dynamicItems.settings.wiserApiRoot + "items/" + encodeURIComponent("{itemIdEncrypted}") + "/action-button/{propertyId}?queryId=" + encodeURIComponent(options.resourcesQueryId || 0) + "&itemLinkId={itemLinkId}",
        contentType: 'application/json',
        dataType: 'json',
        method: 'POST',
        data: JSON.stringify({
            start_date: startDate,
            end_date: endDate
        })
    });

    // Process resources.
    calendar.resourceStore.data = resourcesResponse.otherData.map(employee => {
        const employeeId = Math.round(employee.value);
        
        // Generate a unique hex color based on the employee's ID.
        const employeeColor = Misc.idToHexColor(employeeId);
        
        return {
            id: employeeId,
            name: employee.text,
            image: !!employee.photo ? `items/${employeeId}/files/photo/0.jpg?subDomain={subDomain}` : false,
            eventColor: employeeColor
        }
    });
}

// Determine what resources are relevant and should be checked for the visible data.
function determineCheckedResources(calendar) {
    // Retrieve the resource filter widget.
    const resourceFilter = calendar.widgetMap.resourceFilter;
    
    // Retrieve all resources and events currently loaded.
    const resources = calendar.resourceStore.records.map(resource => resource.data);
    const events = calendar.eventStore.records.map(event => event.data);
    
    if(events.length) {
        // Go over all resources where any of the events in the view matches their respective resource id.
        // Then, only retrieve the IDs of the resources and set them to be selected by the resource filter.
        resourceFilter.selected = resources
            .filter(resource => events.some(event => event.resourceId === resource.id))
            .map(resource => resource.id);
    } else {
        // If there are no events to show, we want to enable all the resource filters.
        // This has to be done, because if we were to not select a single resource filter programatically, switching
        // dates would not be detected anymore and no data is loaded, unless we manually enable one of the resource
        // filters again.
        resourceFilter.selected = resources.map(resource => resource.id);
    }
}

// The event fired before the view is changed. This event is used to clear the current event store.
async function onBeforeActiveItemChange(event) {
    const calendar = event.activeItem.calendar;
    calendar.eventStore.data = [];
}

// The event fired when the date is changed in the calendar.
async function onDateChange(calendar) {
    // Wait for a tick.
    await waitTick();
    
    // Retrieve the visible start and end date of the current view.
    const widget = calendar.activeView;
    const { startDate, endDate } = getVisibleDateRange(widget);
    
    // Reload the data with the given start and end date range.
    await loadData(calendar, startDate, endDate);
    
    // Check the necessary resources.
    determineCheckedResources(calendar);
}

// The event fired when an event record is either moved or its start/end date is being adjusted.
async function onEditEvent(eventRecord, resourceRecord, startDate, endDate) {
    const eventId = eventRecord.data.realEventId;
    const resourceId = resourceRecord?.value ?? eventRecord.data.resourceId;
    
    const editQueryId = options.editQuery;
    
    if(!editQueryId)
        return;

    await Wiser.api({
        url: dynamicItems.settings.wiserApiRoot + "items/" + encodeURIComponent("{itemIdEncrypted}") + "/action-button/{propertyId}?queryId=" + encodeURIComponent(editQueryId) + "&itemLinkId={itemLinkId}",
        contentType: 'application/json',
        dataType: 'json',
        method: 'POST',
        data: JSON.stringify({
            id: eventId,
            medewerker: resourceId,
            start: startDate,
            end: endDate
        })
    });
}

// The event fired when creating/editing an event in the calendar.
function onBeforeEventEdit(event) {
    // Retrieve data from the event.
    const isCreating = event.eventRecord.meta.isCreating;

    // Retrieve general data of the event and resource being edited/created.
    const eventRecordData = event.eventRecord.data;
    const resourceRecordData = event.resourceRecord?.data;

    // Callback function to run when the popup window is closed.
    const onWindowClose = async itemDetails => {
        // The item was discarded.
        if(isCreating && itemDetails === null) {
            event.eventRecord.remove();
            return;
        }
        
        // Ignore reloading the overview since the item was cancelled anyways.
        if(itemDetails === null)
            return;

        // Reload the calendar's data.
        const calendar = event.source;
        const { startDate, endDate } = getVisibleDateRange(calendar.activeView);
        await loadData(calendar, startDate, endDate);
    };

    if(isCreating) {
        // Get the start and end date of the given block.
        const { startDate, endDate } = eventRecordData;

        const employee = resourceRecordData?.index;
        const duration = (endDate.getTime() - startDate.getTime()) / 60000;

        const itemData = [
            {
                key: 'employee',
                value: employee
            },
            {
                key: 'start_date',
                value: startDate
            },
            {
                key: 'end_date',
                value: endDate
            },
            {
                key: 'duration',
                value: duration
            }
        ];

        window.dynamicItems.createItem('Reservation', 0, '', 0, itemData, false, 0).then(createItemResult => {
            dynamicItems.windows.loadItemInWindow(true, createItemResult.itemIdPlain, createItemResult.itemId, 'reservation', 'Nieuw agenda item', false, dynamicItems.grids.mainGrid, { hideTitleColumn: true }, createItemResult.linkId, null, null, 0, onWindowClose);
        });
    } else {
        const eventId = eventRecordData.id;
        const eventIdEncrypted = eventRecordData.encryptedId;
        dynamicItems.windows.loadItemInWindow(false, eventId, eventIdEncrypted, 'reservation', 'Reservering / notitie', false, dynamicItems.grids.mainGrid, { hideTitleColumn: true }, 0, null, null, 0, onWindowClose);
    }

    // Cancels opening the default Bryntum dialog.
    return false;
}

// Gives a start and end date defining the range of the currently visible dates in the view.
function getVisibleDateRange(widget) {
    // Due to there being a difference in the week/month/day views, the widget is returned with different properties.
    // For that reason we first check properties expected from one type of widget, before trying another from a different type of widget.
    // NOTE: This has to be done with quite an ugly try-catch workaround, because when accessing `widget.firstVisibleDate`,
    // 'undefined' is not returned. Instead, a silent error is thrown and the code simply stops from there. A try-catch
    // block can catch this silent error, and thus we can further process it in the catch block.
    let startDate, endDate;
    try {
        startDate = widget.firstVisibleDate;
        endDate = widget.lastVisibleDate;
    } catch (exception) {
        startDate = widget.calendar.date;
        endDate = startDate;
    }

    // Return the start and end date in an object.
    return {
        startDate,
        endDate
    }
}

async function waitTick() {
    return new Promise(resolve => {
        setTimeout(() => {
            resolve();
        });
    });
}

// Initializes the entire scheduler.
async function init() {
    // Initialize the calendar component.
    const calendar = await initializeCalendar();
    
    // Retrieve the visible start and end dates.
    const { startDate, endDate } = getVisibleDateRange(calendar.activeView);
    
    // Request resources and events in the calendar view.
    await Promise.allSettled([
        loadResources(calendar, startDate, endDate),
        loadData(calendar, startDate, endDate)
    ]);

    // Check the necessary resources.
    determineCheckedResources(calendar);
}

init();

{customScript}