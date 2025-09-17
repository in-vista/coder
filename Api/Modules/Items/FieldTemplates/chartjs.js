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
    
    // Make a distinct array of labels.
    const labels = data
        .map(row => row[options.labelsColumn])
        .filter((label, index, array) => array.indexOf(label) === index);
    
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
            ...options
        },
        plugins: [
            autocolors
        ]
    });
    
    loader.removeClass('loading');

    // Inject custom Javascript code from the entity property's settings.
    {customScript}
})();