const options = {options};

// Loads the library's script and stylesheet files.
async function initializeLibrary() {
    // Local function to create a script tag in the head of the document.
    async function createScript(source, attributes = {}) {
        return new Promise(resolve => {
            // Create the script element in the DOM.
            const script = document.createElement('script');

            // Set the source of the script.
            script.src = source;

            // Set all given attributes on the script element.
            for(const [ attributeKey, attributeValue ] of Object.entries(attributes))
                script.setAttribute(attributeKey, attributeValue);

            // Set to resolve this async promise when the script is loaded.
            script.onload = () => {
                resolve();
            };

            // Add the script to the document.
            document.head.appendChild(script);
        });
    }

    // Create the CSS DOM for Bryntum's styles and add it to the document.
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = '/css/bryntum/scheduler/scheduler.material.css';
    document.head.appendChild(link);

    // Load the locale script.
    await createScript('/customscripts/bryntum/scheduler/locales/scheduler.locale.Nl.js', {
        'type': 'module'
    });

    // Load the Bryntum library script.
    await createScript('/customscripts/bryntum/scheduler/scheduler.umd.js', {
        'data-default-locale': 'Nl'
    });

    // Set the default language.
    const localeManager = bryntum.scheduler.LocaleManager;
    localeManager.applyLocale('Nl');
}

// Loads the scheduler view.
async function initializeScheduler() {
    return new Promise(resolve => {
        const now = new Date();
        now.setHours(0);
        now.setMinutes(0);
        now.setSeconds(0);

        // Set the end date to the next day.
        const endDate = new Date();
        endDate.setHours(23);

        const mode = options.vertical ? 'vertical' : 'horizontal';

        const scheduler = new bryntum.scheduler.Scheduler({
            appendTo: 'scheduler',
            mode: mode,
            startDate: now,
            endDate: endDate,
            viewPreset: {
                tickWidth: 150,
                timeResolution: {
                    unit: 'hour',
                    increment: 1
                },
                headers: [
                    {
                        unit: 'day',
                        dateFormat: 'DD MMMM YYYY'
                    },
                    {
                        unit: 'hour',
                        dateFormat: 'HH:mm'
                    }
                ]
            },
            eventStyle: 'colored',
            features: {
                stripe: true,
                scheduleTooltip : false
            },
            resourceImagePath: dynamicItems.settings.wiserApiRoot,
            rowHeight: 80,
            columns: [
                {
                    type: 'resourceInfo',
                    field: 'name',
                    text: 'Medewerker',
                    width: 200
                }
            ]
        });

        scheduler.on('beforeEventEdit', onBeforeEventEdit);

        resolve(scheduler);
    });
}

// Loads the data in the scheduler view.
async function loadData(scheduler, date) {
    // Temporarily store the current state of the scheduler.
    const schedulerState = scheduler.state;

    // Set the end date to the next day.
    const endDate = new Date();
    endDate.setTime(date.getTime() + 24 * 60 * 60 * 1000);

    // Load the resources and events data in parallel.
    const requestsData = await Promise.allSettled([
        // Resources.
        Wiser.api({
            url: dynamicItems.settings.wiserApiRoot + "items/" + encodeURIComponent("{itemIdEncrypted}") + "/action-button/{propertyId}?queryId=" + encodeURIComponent(options.resourcesQueryId || 0) + "&itemLinkId={itemLinkId}",
            contentType: 'application/json',
            dataType: 'json',
            method: 'POST',
            data: JSON.stringify({
                start_date: date,
                end_date: endDate
            })
        }),
        // Events.
        Wiser.api({
            method: "POST",
            url: dynamicItems.settings.wiserApiRoot + "items/" + encodeURIComponent("{itemIdEncrypted}") + "/action-button/{propertyId}?queryId=" + encodeURIComponent(options.queryId || 0),
            contentType: "application/json",
            data: JSON.stringify({
                start_date: date,
                end_date: endDate
            })
        })
    ]);

    // Get the data requests' individual responses.
    const resourcesResponse = requestsData[0];
    const eventsResponse = requestsData[1];

    // Process resources.
    const employees = resourcesResponse.value.otherData;

    scheduler.resourceStore.data = employees.map(employee => {
        const employeeId = employee.value;

        return {
            id: employeeId,
            name: employee.text,
            image: !!employee.photo ? `items/${employeeId}/files/photo/0.jpg?subDomain={subDomain}` : false
        }
    });

    // Process the events.
    scheduler.eventStore.data = eventsResponse.value.otherData.map(reservation => {
        const duration = (new Date(reservation.end).getTime() - new Date(reservation.start).getTime()) / 60000;
        const name = `${reservation.title}${(reservation.arrangement_title ? ` (${reservation.arrangement_title})` : '')}${(reservation.notes ? ` ${reservation.notes}` : '')}`;
        const color = reservation.arrangement_color?.replace(/^#/, '');

        return {
            id: reservation.id,
            encryptedId: reservation.encryptedId,
            resourceId: reservation.medewerker,
            draggable: false,
            resizable: false,
            allDay: !!reservation.all_day,
            startDate: reservation.start,
            duration: duration,
            durationUnit: 'minute',
            name: name,
            eventColor: color
        }
    });

    // Re-apply the scheduler's state before (re)loading the data.
    scheduler.state = schedulerState;
}

// The event fired when creating/editing an event in the scheduler.
function onBeforeEventEdit(event) {
    // Retrieve data from the event.
    const isCreating = event.eventRecord.meta.isCreating;

    // Retrieve general data of the event and resource being edited/created.
    const eventRecordData = event.eventRecord.data;
    const resourceRecordData = event.resourceRecord.data;

    // Callback function to run when the popup window is closed.
    const onWindowClose = async itemDetails => {
        // The item was discarded.
        if(isCreating && itemDetails === null) {
            event.eventRecord.remove();
            return;
        }

        // Reload the scheduler's data.
        const scheduler = event.source;
        await loadData(scheduler, scheduler.startDate);
    };

    if(isCreating) {
        // Get the start and end date of the given block.
        const { startDate, endDate } = eventRecordData;

        const employee = resourceRecordData.index;
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

// Initializes the entire scheduler.
async function init() {
    await initializeLibrary();
    const scheduler = await initializeScheduler();

    const currentStartDate = scheduler.visibleDateRange.startDate;
    await loadData(scheduler, currentStartDate);
}

init();

{customScript}