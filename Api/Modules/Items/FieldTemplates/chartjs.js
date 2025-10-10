(async () => {
    // Set up variables for elements in the document.
    const container = $("#container_{propertyIdWithSuffix}");
    const chartContainer = container.find('.chart-container');
    const loader = container.find(".loader");
    
    // Show the loader.
    loader.addClass('loading');
    
    // Retrieve the settings of the entity property.
    const options = {options};
    
    // Set the height of the chart container.
    const height = Number('{height}' || 0);
    if(height)
        chartContainer.css({
            height: '{height}px'
        });
    
    // Get the chart element.
    const chartElement = document.getElementById('chart_{propertyIdWithSuffix}');
    
    // Load the autocolors plugin.
    const autocolors = window['chartjs-plugin-autocolors'];
    
    // Retrieve data from query.
    let data = [];
    // Option 1: queryId parameter
    if(options.queryId) {
        const dataResults = await Wiser.api({
            method: 'POST',
            contentType: 'application/json',
            dataType: 'json',
            url: `${dynamicItems.settings.wiserApiRoot}items/${encodeURIComponent("{itemIdEncrypted}")}/action-button/{propertyId}?queryId=${encodeURIComponent(options.queryId || dynamicItems.settings.zeroEncrypted)}&itemLinkId={itemLinkId}&userType=${encodeURIComponent(dynamicItems.settings.userType)}`,
            data: JSON.stringify({})
        });

        data = dataResults.otherData;
    }
    // Option 2 (Wwork-in-progress): url parameter.
    /*else if(options.url) {
        let url = options.url;
        let method = 'GET';
        let body = {};
        
        if(typeof options.url === 'object') {
            url = options.url.url;
            method = options.url.method ?? method;
            body = options.body ?? body;
        }
        
        const requestSettings = {
            method: method,
            contentType: 'application/json',
            dataType: 'json',
            url: url
        }
        
        if(method !== 'GET')
            requestSettings['data'] = JSON.stringify(body);
        
        const dataResults = await Wiser.api(requestSettings);
        
        data = dataResults.otherData;
    }*/

    /**
     * Function to find-or-create a group in the given array of group.
     * @param groupName - The name of group to find or create.
     * @param groups - The collection of groups to look for the group in.
     * @param groupLabel - The display name of the group. If null is given, the groupName parameter will be used.
     * @returns {Number} The index of the (newly created) group in the array of groups.
     */
    function findOrCreateGroup(groupName, groups, groupLabel = null) {
        groupLabel ??= groupName;
        
        let groupIndex = groups.findIndex(set => set.label === groupLabel);
        if(groupIndex === -1) {
            const newGroup = {
                label: groupLabel,
                data: []
            };
            groups.push(newGroup);
            groupIndex = groups.length - 1;
        }

        return groupIndex;
    }

    // Parse the data into grouped data sets.
    let datasets = [];
    if(options.group || options.dynamicGroups) {
        if(options.group) {
            // Determine the type of group from the settings.
            const groupType = typeof options.group;

            switch (groupType) {
                case 'string':
                    datasets = data.reduce((current, dataEntry) => {
                        const groupName = dataEntry[options.group];
                        const groupIndex = findOrCreateGroup(groupName, current);

                        current[groupIndex].data.push({
                            x: dataEntry[options.labelsColumn],
                            y: dataEntry
                        });

                        return current;
                    }, datasets);

                    break;
                case 'object':
                    datasets = data.reduce((current, dataEntry) => {
                        for (const groupName in options.group) {
                            const groupIndex = findOrCreateGroup(groupName, current);
                            const groupSettings = options.group[groupName];
                            const groupOptions = options.group[groupName].options;

                            current[groupIndex].data.push({
                                x: dataEntry[options.labelsColumn],
                                y: dataEntry[groupSettings.dataColumn ?? options.dataColumn]
                            });
                            
                            current[groupIndex] = {
                                ...current[groupIndex],
                                ...groupOptions
                            }
                        }

                        return current;
                    }, datasets);

                    break;
            }
        }
        
        if(options.dynamicGroups) {
            const dynamicGroups = options.dynamicGroups;

            datasets = data.reduce((current, dataEntry) => {
                for(const [ dynamicGroupIndex, dynamicGroup ] of dynamicGroups.entries()) {
                    const { group, value } = dynamicGroup;

                    const groupLabel = dataEntry[group];
                    const groupName = `${groupLabel}_${dynamicGroupIndex}`;
                    const groupIndex = findOrCreateGroup(groupName, current, groupLabel);
                    
                    current[groupIndex].data.push({
                        x: dataEntry[options.labelsColumn],
                        y: dataEntry[value]
                    });
                    
                    current[groupIndex] = {
                        ...current[groupIndex],
                        ...dynamicGroup.options
                    }
                }
                
                return current;
            }, datasets);
        }
    } else {
        datasets = [
            {
                data: data.map(entry => entry[options.dataColumn])
            }
        ]
    }
    
    // Apply custom options to all datasets.
    datasets = datasets.map(set => {
        return {
            ...set,
            ...options.datasetOptions
        }
    });
    
    // Build the labels for the chart.
    let labels = [];
    const labelsColumn = options.labelsColumn;
    if(labelsColumn) {
        // Retrieve the type of the labels column option.
        const labelsColumnType = typeof labelsColumn;
        
        // Check whether the labels column option was set to be a string or object.
        switch(labelsColumnType) {
            // Map the given column name of the results to be used as labels.
            case 'string':
                // Make a distinct array of labels.
                labels = data
                    .map(row => row[labelsColumn])
                    .filter((label, index, array) => array.indexOf(label) === index);
                break;
            // Build a set of labels by a predefined type.
            case 'object':
                // Retrieve the options for the labels column.
                let labelsOptions = { ...labelsColumn };
                
                // If set, retrieve options from a query.
                if(labelsOptions.optionsQueryId) {
                    // Request the options from query results.
                    const labelsOptionsQueryResults = await Wiser.api({
                        method: 'POST',
                        contentType: 'application/json',
                        dataType: 'json',
                        url: `${dynamicItems.settings.wiserApiRoot}items/${encodeURIComponent("{itemIdEncrypted}")}/action-button/{propertyId}?queryId=${encodeURIComponent(labelsOptions.optionsQueryId || dynamicItems.settings.zeroEncrypted)}&itemLinkId={itemLinkId}&userType=${encodeURIComponent(dynamicItems.settings.userType)}`,
                        data: JSON.stringify({})
                    });
                    
                    // Append the labels options with the received options from the query.
                    labelsOptions = {
                        ...labelsOptions,
                        ...labelsOptionsQueryResults.otherData?.[0]
                    }
                }
                
                // Retrieve the type of the labels.
                const labelsType = labelsOptions.type;
                
                // Check the predefined labels type.
                switch(labelsType) {
                    // Build a set of dates of a given period and interval.
                    case 'date':
                        // Retrieve the current date.
                        const now = new Date();
                        let startDate, endDate;
                        
                        // Retrieve the period, interval and custom start and end date.
                        const period = labelsOptions.period;
                        const interval = labelsOptions.interval;
                        const customStart = labelsOptions.custom_start_date;
                        const customEnd = labelsOptions.custom_end_date;
                        
                        // Validate the existence of period and interval.
                        if([ period, interval ].includes(undefined))
                            break;

                        const firstDayOfMonth = date => new Date(date.getFullYear(), date.getMonth(), 1);
                        const lastDayOfMonth = date => new Date(date.getFullYear(), date.getMonth() + 1, 0);

                        switch (period) {
                            case "this_month":
                                startDate = firstDayOfMonth(now);
                                endDate = lastDayOfMonth(now);
                                break;
                            case "last_month":
                                startDate = firstDayOfMonth(new Date(now.getFullYear(), now.getMonth() - 1));
                                endDate = lastDayOfMonth(startDate);
                                break;
                            case "this_year":
                                startDate = new Date(now.getFullYear(), 0, 1);
                                endDate = new Date(now.getFullYear(), 11, 31);
                                break;
                            case "last_year":
                                startDate = new Date(now.getFullYear() - 1, 0, 1);
                                endDate = new Date(now.getFullYear() - 1, 11, 31);
                                break;
                            case "custom":
                                startDate = new Date(customStart);
                                endDate = new Date(customEnd);
                                break;
                        }
                        
                        startDate.setHours(0, 0, 0, 0);
                        endDate.setHours(0, 0, 0, 0);

                        const formatLocalDate = d => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
                        
                        const current = new Date(startDate);

                        while (current <= endDate) {
                            if (interval === "d")
                                labels.push(formatLocalDate(current));
                            else if (interval === "w") {
                                const monday = new Date(current);
                                monday.setDate(monday.getDate() - ((monday.getDay() + 6) % 7));
                                const yearStart = new Date(monday.getFullYear(), 0, 1);
                                const weekNumber = Math.ceil((((monday - yearStart) / 86400000) + 1) / 7);
                                labels.push(`${monday.getFullYear()}-W${String(weekNumber).padStart(2, "0")}`);
                            }
                            else if (interval === "m")
                                labels.push(`${current.getFullYear()}-${String(current.getMonth() + 1).padStart(2, "0")}`);
                            else if (interval === "y")
                                labels.push(String(current.getFullYear()));

                            if (interval === "d")
                                current.setDate(current.getDate() + 1);
                            else if (interval === "w")
                                current.setDate(current.getDate() + 7);
                            else if (interval === "m")
                                current.setMonth(current.getMonth() + 1);
                            else if (interval === "y")
                                current.setFullYear(current.getFullYear() + 1);
                        }

                        labels = [...new Set(labels)]
                        break;
                }
                
                break;
        }
    }
    
    // Initialize ChartJS plugins.
    const plugins = [
        autocolors
    ];
    
    // Create a local ChartJS plugin to draw a horizontal dotted line.
    const thresholdOptions = options.threshold;
    if(thresholdOptions) {
        let thresholdValue = thresholdOptions.value;
        let thresholdColor = thresholdOptions.color;
        
        if(!thresholdValue && thresholdOptions.queryId) {
            const thresholdValueResults = await Wiser.api({
                method: 'POST',
                contentType: 'application/json',
                dataType: 'json',
                url: `${dynamicItems.settings.wiserApiRoot}items/${encodeURIComponent("{itemIdEncrypted}")}/action-button/{propertyId}?queryId=${encodeURIComponent(thresholdOptions.queryId || dynamicItems.settings.zeroEncrypted)}&itemLinkId={itemLinkId}&userType=${encodeURIComponent(dynamicItems.settings.userType)}`,
                data: JSON.stringify({})
            });
            
            const thresholdValueRow = thresholdValueResults.otherData?.[0];
            thresholdValue = thresholdValueRow?.value ?? thresholdValue;
            thresholdColor = thresholdValueRow?.color ?? thresholdColor;
        }
        
        // Create a new plugin that draws a horizontal line on the graph.
        plugins.push({
            id: 'horizontalDottedLine',
            beforeDatasetsDraw(chart, args, options) {
                const {
                    ctx,
                    chartArea: {
                        top, right, bottom, left, width, height
                    },
                    scales: {
                        x, y
                    }
                } = chart;

                ctx.save();

                ctx.setLineDash([5, 3]);
                ctx.strokeStyle = thresholdColor ?? 'grey';
                ctx.strokeRect(left, y.getPixelForValue(thresholdValue), width, 0);

                ctx.restore();
            }
        });
    }
    
    // Initialize the chart.
    const chart = new Chart(chartElement, {
        type: options.type,
        data: {
            labels: labels,
            datasets: datasets
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    display: !!options.group || !!options.dynamicGroups
                }
            },
            ...options,
            onClick: (event) => {
                // Retrieve the grid options of this chart and check if it is set. If not, skip this behaviour.
                const gridOptions = options.grid;
                if(!gridOptions)
                    return;
                
                // Retrieve all clicked elements in the chart.
                const elements = chart.getElementsAtEventForMode(event, 'nearest', {
                    intersect: true
                }, true);

                // Retrieve the Kendo grid.
                const gridPropertyId = gridOptions.propertyId;
                const gridElement = $(`#overviewGrid${gridPropertyId}`);
                const grid = gridElement.data("kendoGrid");
                
                // Validate whether there were any elements clicked.
                // If no elements were clicked, deselect the grid and reload the results.
                if(!elements || elements.length === 0) {
                    grid.dataSource.read();
                    return;
                }
                
                // Retrieve the firstly clicked element and its properties.
                const element = elements[0];
                const { datasetIndex, index } = element;
                
                // Retrieve the value of the clicked element as stored in the chart's dataset.
                const value = chart.data.datasets[datasetIndex].data[index];
                const label = chart.data.labels[index];
                
                // Retrieve the "real value" of the clicked element.
                // In most cases you can retrieve the real value as is. In other cases the retrieved value comes
                // as an object of different values. You can use the options to select a specific property from this
                // object to be used as the "real value".
                let realValue = value;
                if(typeof(value) === 'object' && gridOptions.valueProperty)
                    realValue = value[gridOptions.valueProperty];
                
                // Retrieve optional overwrites for the provided chart data values.
                const chartLabelDataField = gridOptions.data?.label ?? 'chart_label';
                const chartValueDataField = gridOptions.data?.label ?? 'chart_value';
                
                // Refresh the grid with the provided chart data.
                grid.dataSource.read({
                    extraValuesForQuery: {
                        [chartLabelDataField]: String(label),
                        [chartValueDataField]: String(realValue)
                    }
                });
            }
        },
        plugins: plugins
    });
    
    loader.removeClass('loading');

    // Inject custom Javascript code from the entity property's settings.
    {customScript}
})();