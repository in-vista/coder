(() => {
    // Retrieve the options from the entity property.
    const options = {options};
    
    // Set the amount of hours used as an offset to indicate the start of the day.
    const startHours = options.startTime ?? 7;
    const endHours = options.endTime ?? 24;
    const startDate = DayPilot.Date.today().addHours(startHours);
    
    // Set up the scheduler instance and its initial configuration.
    const scheduler = new DayPilot.Scheduler("scheduler_{propertyIdWithSuffix}", {
        locale: 'nl-nl',
        theme: 'coder',
        startDate: startDate,
        endDate: startDate.addHours(endHours - startHours),
        scale: 'CellDuration',
        timeHeaders: [
            {
                groupBy: 'Day',
                format: 'dd MMMM yyyy'
            },
            {
                groupBy: 'Cell',
                format: 'HH:mm'
            }
        ],
        days: 1,
        cellDuration: 60,
        cellWidthSpec: 'Auto',
        timeRangeSelectedHandling: 'Enabled',
        onBeforeCellRender: args => {
            args.cell.business = true;
        },
        onTimeRangeSelected: async (args) => {
            const scheduler = args.control;
            const modal = await DayPilot.Modal.prompt("Create a new event:", "Event 1");
            scheduler.clearSelection();
            if (modal.canceled) { return; }
            scheduler.events.add({
                start: args.start,
                end: args.end,
                id: DayPilot.guid(),
                resource: args.resource,
                text: modal.result
            });
        },
        eventMoveHandling: 'Update',
        onEventMoved: (args) => {
            console.log("Event moved: " + args.e.text());
        },
        eventResizeHandling: 'Update',
        onEventResized: (args) => {
            console.log("Event resized: " + args.e.text());
        },
        eventDeleteHandling: 'Update',
        onEventDeleted: (args) => {
            console.log("Event deleted: " + args.e.text());
        },
        // Overwrite any configurations through the entity property's options.
        ...options
    });
    
    // Initialize the scheduler component.
    scheduler.init();
    
    scheduler.show();
})();