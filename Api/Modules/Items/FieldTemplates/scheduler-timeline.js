(async () => {
    function loadScript(src) {
        return new Promise((resolve, reject) => {
            const s = document.createElement('script');
            s.src = src;
            s.onload = () => resolve(src);
            s.onerror = () => reject(new Error(`Script load error for ${src}`));
            document.head.appendChild(s);
        });
    }
    
    const scripts = [
        "https://cdn.jsdelivr.net/npm/uikit@3.21.12/dist/js/uikit.min.js",
        "https://cdn.jsdelivr.net/npm/uikit@3.21.12/dist/js/uikit-icons.min.js",
        "https://cdn.jsdelivr.net/npm/axios@1.4.0/dist/axios.min.js",
        "https://cdn.jsdelivr.net/npm/flatpickr",
        "https://cdn.jsdelivr.net/npm/flatpickr/dist/l10n/nl.js"
    ];
    
    // Laad alles parallel, en wacht tot alle scripts klaar zijn
    Promise.all(scripts.map(loadScript)).then(() => {
        window.timelineScheduler = new TimelineScheduler();
    }).catch(err => {
        console.error("Fout bij laden van script:", err);
    });
    
    class TimelineScheduler {
    
        // ---------- INSTELLINGEN ----------
        startTime = 7;   // Starttijd (07:00)
        endTime = 3;     // Eindtijd (03:00 volgende dag)
        workStart = 11;  // Werktijd start
        workEnd = 23;    // Werktijd eind
    
        cellWidth = 30;      // breedte kwartier
        quartersPerHour = 4; // 4 kwartieren per uur  
    
        reservations = []; // internal for keeping reservations
        tableGroups = {}; // internal for keeping tables and table groups
    
        container = null;
        activeDrag = null;
        suppressHover = false;
        totalQuarters = (this.endTime > this.startTime ? (this.endTime - this.startTime) : (24 - this.startTime + this.endTime)) * this.quartersPerHour;
        currentDate = new Date();
        hoverTimers = {};
        domain = "https://koks.reservery.dev";
    
        constructor() {
            this.init();
        }
    
        async init(){
            this.container = document.getElementById("rows");
    
            // Zet de lijn meteen en update elke minuut
            setInterval(() => this.updateCurrentTimeLine(), 60*1000);
    
            // ============= CALENDAR ABOVE TIMELINE =============
            const currentDateSpan = document.getElementById("current-date");
    
            // Init Flatpickr op de span (inline, zonder input)
            const fp = flatpickr(currentDateSpan, {
                allowInput: true,
                dateFormat: "dd-mm-YYYY",
                locale: "nl", // Nederlands
                clickOpens: false, // we openen handmatig
                onChange: function(selectedDates) {
                    timelineScheduler.currentDate = selectedDates[0];
                    timelineScheduler.updateDateDisplay();
                }
            });
    
            // Open Flatpickr bij click
            currentDateSpan.addEventListener("click", () => {
                fp.open();
            });
    
            document.getElementById("prev-day").addEventListener("click", () => {
                this.currentDate.setDate(this.currentDate.getDate() - 1);
                this.updateDateDisplay();
            });
    
            document.getElementById("next-day").addEventListener("click", () => {
                this.currentDate.setDate(this.currentDate.getDate() + 1);
                this.updateDateDisplay();
            });
    
            document.getElementById("refresh-button").addEventListener("click", () => {
                this.updateDateDisplay();
            });
    
            currentDateSpan.innerText = this.formatDate(this.currentDate);
            this.createHeader();

            // Load arrangements and cache for 1 hour
            const arrangementsResponse = await axios.get(`${this.domain}/template.gcl?templateName=getArrangementsForTimeline`);
            this.arrangements = arrangementsResponse.data;
    
            // Get tables and reservations
            await this.getTables();    
            //await this.getReservations();

            this.getReservations(this.toDateString(this.currentDate)).then(() => {
                this.renderReservations();
            }).catch(err => {
                console.error("Fout bij ophalen reserveringen:", err);
            });
            
            // Render reservations
            //this.renderReservations();
    
            // Start horizontal scrollbar in the middle
            const scheduler = document.querySelector(".scheduler");
            if (scheduler) {
                scheduler.scrollLeft = (scheduler.scrollWidth - scheduler.clientWidth) / 2;
            }
    
            // Add observer, so timeline will be refreshed when iframe gets focus back      
            /*const observer = new IntersectionObserver((entries) => {
                entries.forEach(entry => {
                    if (entry.isIntersecting) {
                        console.log("Timeline scheduler is weer zichtbaar, refresh.");
    
                        // async functie aanroepen zonder await
                        this.getReservations(this.toDateString(this.currentDate)).then(() => {
                            this.renderReservations();
                        }).catch(err => {
                            console.error("Fout bij ophalen reserveringen:", err);
                        });
                    }
                });
            });
            observer.observe(scheduler);  */      
        }
    
        formatTime(hour, minute=0){
            return `${hour.toString().padStart(2,'0')}:${minute.toString().padStart(2,'0')}`;
        }
    
        isInsideWorkTime(hour){
            if(this.workStart <= this.workEnd) return hour >= this.workStart && hour < this.workEnd;
            return hour >= this.workStart || hour < this.workEnd;
        }
    
        addDragResize(block, res, handle) {
            // BEGIN DRAG
            block.addEventListener("mousedown", (e) => {
                if (e.target === handle) return;
                e.stopPropagation();
    
                document.querySelectorAll(".hover").forEach(el => el.style.display = "none");
                this.suppressHover = true;
    
                // Horizontale scroller container
                const container = document.querySelector('.scheduler-timeline-container');
                const scrollerRect = container.getBoundingClientRect();
                const scroller = container;
    
                // Alle zichtbare rijen ophalen
                let rows = Array.from(container.querySelectorAll('.table-row')).filter(r => r.offsetParent !== null);
    
                // Startpositie muis en ghost
                const mouseY = e.clientY + window.scrollY;
                let startRow = rows.find(r => {
                    const rect = r.getBoundingClientRect();
                    const top = rect.top + window.scrollY;
                    const bottom = top + rect.height;
                    return mouseY >= top && mouseY < bottom;
                });
                if (!startRow) startRow = rows[0];
    
                const rect = block.getBoundingClientRect();
                const ghostLeftStart = rect.left - scrollerRect.left + scroller.scrollLeft;
    
                this.activeDrag = {
                    element: block,
                    res,
                    startX: e.clientX,
                    offsetX: e.clientX - rect.left,
                    startQuarter: res.start * this.quartersPerHour,
                    duration: (res.end - res.start) * this.quartersPerHour,
                    ghost: block.cloneNode(true),
                    originalStart: res.start,
                    originalEnd: res.end,
                    startRow,
                    ghostLeftStart
                };
    
                const ghost = this.activeDrag.ghost;
                ghost.style.opacity = 0.5;
                ghost.style.pointerEvents = "none";
                ghost.style.position = "absolute";
                ghost.style.left = `${ghostLeftStart}px`;
                ghost.style.top = `${startRow.offsetTop}px`;
                ghost.style.height = `${startRow.offsetHeight}px`;
                ghost.style.width = `${rect.width}px`;
                ghost.style.zIndex = 9999;
                container.appendChild(ghost);
    
                e.preventDefault();
    
                // MOUSEMOVE
                const onMouseMove = (ev) => {
                    if (!this.activeDrag) return;
    
                    const deltaX = ev.clientX - this.activeDrag.startX;
                    ghost.style.left = `${this.activeDrag.ghostLeftStart + deltaX}px`;
    
                    const mouseY = ev.clientY + window.scrollY;
    
                    // Herbereken zichtbare rijen (bij open/dicht klappen accordion)
                    rows = Array.from(container.querySelectorAll('.table-row')).filter(r => r.offsetParent !== null);
    
                    // Vind rij onder muis
                    let targetRow = rows.find(r => {
                        const rRect = r.getBoundingClientRect();
                        const top = rRect.top + window.scrollY;
                        const bottom = top + rRect.height;
                        return mouseY >= top && mouseY < bottom;
                    });
                    if (!targetRow) {
                        if (mouseY < rows[0].getBoundingClientRect().top + window.scrollY) targetRow = rows[0];
                        else targetRow = rows[rows.length - 1];
                    }
    
                    ghost.style.top = `${targetRow.offsetTop}px`;
                    ghost.style.height = `${targetRow.offsetHeight}px`;
    
                    // Horizontaal: kwartier-snapping
                    const movedQuarters = Math.round(deltaX / this.cellWidth);
                    let newStartQuarter = this.activeDrag.startQuarter + movedQuarters;
                    newStartQuarter = ((newStartQuarter % (24 * this.quartersPerHour)) + (24 * this.quartersPerHour)) % (24 * this.quartersPerHour);
    
                    const currentStartQuarter = Math.round(this.activeDrag.res.start * this.quartersPerHour);
                    if (newStartQuarter !== currentStartQuarter) {
                        this.activeDrag.res.start = newStartQuarter / this.quartersPerHour;
                        this.activeDrag.res.end = (newStartQuarter + this.activeDrag.duration) / this.quartersPerHour % 24;
                    }
    
                    this.activeDrag.currentRow = targetRow;
                };
    
                // MOUSEUP
                const onMouseUp = () => {
                    if (!this.activeDrag) return;
    
                    let changed = this.activeDrag.originalStart !== this.activeDrag.res.start ||
                        this.activeDrag.originalEnd !== this.activeDrag.res.end;
    
                    const targetRow = this.activeDrag.currentRow ?? this.activeDrag.startRow;
                    this.activeDrag.res.fromTable = this.activeDrag.res.table; // For deleting asset
                    if (this.activeDrag.res.table !== parseInt(targetRow.dataset.table)) {
                        this.activeDrag.res.table = parseInt(targetRow.dataset.table);
                        changed = true;
                    }
    
                    if (this.activeDrag.ghost.parentElement) this.activeDrag.ghost.remove();
    
                    if (changed) {
                        this.updateReservation(this.activeDrag.res);
                        this.renderReservations();
                    } else {
                        this.openReservationInCoder(this.activeDrag.res);
                    }
    
                    this.activeDrag = null;
                    this.suppressHover = false;
    
                    window.removeEventListener("mousemove", onMouseMove);
                    window.removeEventListener("mouseup", onMouseUp);
                };
    
                window.addEventListener("mousemove", onMouseMove);
                window.addEventListener("mouseup", onMouseUp);
            });
    
            // RESIZE
            handle.addEventListener("mousedown", (e) => {
                e.stopPropagation();
                document.querySelectorAll(".hover").forEach(el => el.style.display = "none");
                this.suppressHover = true;
    
                const startX = e.clientX;
                const startWidth = block.offsetWidth;
                const originalEnd = res.end;
                const minWidthPx = this.cellWidth;
    
                const onResizeMove = (ev) => {
                    const deltaX = ev.clientX - startX;
                    const newWidthPx = Math.max(minWidthPx, startWidth + deltaX);
    
                    const quarterSteps = Math.round(newWidthPx / this.cellWidth);
                    res.end = res.start + quarterSteps / this.quartersPerHour;
                    if (res.end >= 24) res.end -= 24;
    
                    block.style.width = `${quarterSteps * this.cellWidth}px`;
                };
    
                const onResizeUp = () => {
                    window.removeEventListener("mousemove", onResizeMove);
                    window.removeEventListener("mouseup", onResizeUp);
                    this.suppressHover = false;
    
                    if (res.end !== originalEnd) {
                        this.updateReservation(res);
                        this.renderReservations();
                    }
                };
    
                window.addEventListener("mousemove", onResizeMove);
                window.addEventListener("mouseup", onResizeUp);
            });
        }
    
    
        updateCurrentTimeLine() {
            const line = document.getElementById('current-time-line');
            const now = new Date();
    
            // Only show line on the current date
            if (this.currentDate.toDateString() !== now.toDateString()) {
                line.style.display = 'none';
                return;
            }
    
            let nowHour = now.getHours();
            let nowMinute = now.getMinutes();
    
            // totale tijd in uren
            let nowInHours = nowHour + nowMinute / 60;
    
            let start = this.startTime;
            let end = this.endTime > this.startTime ? this.endTime : this.endTime + 24;
    
            // corrigeer voor tijd na middernacht
            let nowAdjusted = nowInHours;
            if (nowInHours < start) nowAdjusted += 24;
    
            if (nowAdjusted >= start && nowAdjusted <= end) {
                // totaal aantal kwartieren vanaf starttijd
                const totalQuartersFromStart = (nowAdjusted - start) * this.quartersPerHour;
                const pixelsFromStart = 120 + (totalQuartersFromStart * this.cellWidth);
                line.style.left = pixelsFromStart + 'px';
                line.style.display = 'block';
            } else {
                line.style.display = 'none';
            }
        }
    
        formatDate(date){
            return date.toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
        }
    
        async updateDateDisplay() {
            const currentDateSpan = document.getElementById("current-date");
            currentDateSpan.innerText = this.formatDate(this.currentDate);
    
            // Get reservations for new date from database
            console.log('updateDateDisplay');
            await this.getReservations(this.toDateString(this.currentDate));
            this.renderReservations();
        }
    
        // Get reservations from database and fill or refresh internal
        // Only reservations for the given date
        // Example of variable:
        //this.reservations = [
        //  { id: 1, name: "Jan", table: 123, start: 12.0, end: 14.0, paid: true, color: "#FF0000", numberOfPersons: 5, etc. },
        //  { id: 4, name: "Jan", table: 123, start: 15.25, end: 16.5, paid: true, color: "#FF0000", numberOfPersons: 2, etc. }, etc.    
        //];
        async getReservations(date){
            try {
                document.getElementById('spinner').style.display = 'flex';
    
                if (!date) {
                    date = this.toDateString(new Date());
                }
    
                let startDateTime = `${date} ${this.decimalToTime(this.startTime)}`;
                let endDateTime;
    
                // If endtime is before starttime, then the endtime is the next day        
                if (this.endTime < this.startTime) {
                    endDateTime = `${this.addOneDay(date)} ${this.decimalToTime(this.endTime)}`;
                }
                else {
                    endDateTime = `${date} ${this.decimalToTime(this.endTime)}`;
                }
    
                // Get reservations            
                const reservationsResponse = await axios.get(`${this.domain}/template.gcl?templateName=getReservationsForTimeline&startDateTime=${startDateTime}&endDateTime=${endDateTime}`);
                this.reservations = reservationsResponse.data.map(r => ({
                    reservationId: r.id,
                    reservationIdEncrypted: r.encryptedId,
                    name: r.customer_full_name || r.notes || "Walk-in",
                    table: r.table,
                    start: this.timeToDecimal(r.start),
                    end: this.timeToDecimal(r.end),
                    startDate: r.start.substring(0,10),
                    endDate: r.end.substring(0,10),
                    paid: r.paid,
                    color:  r.event_color || this.arrangements.find(item => item.id === r.arrangement)?.color || "#4B99D2", // fallback kleur
                    textColor: r.text_color || this.arrangements.find(item => item.id === r.arrangement)?.text_color || "#FFFFFF",
                    numberOfPersons: parseInt(r.number_of_persons, 10) || 0,
                    arrangement: parseInt(r.arrangement, 10) || 0,
                    notes: r.notes,
                    numberOfVisits: parseInt(r.number_of_visits, 10) || 0,
                    warning: r.warning,
                    customerFullName: r.customer_full_name || "Walk-in",
                    customerPhoneNumber: r.customer_phone_number,
                    customerMobileNumber: r.customer_mobile_number,
                    checkIn: r.check_in,
                    checkOut: r.check_out
                }));
            } catch(exception) {
                UIkit.notification({
                    message: `<span uk-icon='icon: warning'></span> Kon reserveringen niet laden`,
                    status: 'danger'
                });
                console.error(exception);
            }
            finally {
                document.getElementById('spinner').style.display = 'none';
            }
        }
    
        // helper: maakt van "2025-09-15 09:30:00" → 9.5
        timeToDecimal(dateString) {
            const d = new Date(dateString.replace(" ", "T")); // browser snapt "2025-09-15T09:30:00"
            return d.getHours() + d.getMinutes() / 60;
        }
    
        // helper: maakt van 9.5 → "09:30"
        decimalToTime(decimalHour) {
            const hours = Math.floor(decimalHour);
            const minutes = Math.round((decimalHour - hours) * 60);
    
            // padStart zorgt voor altijd 2 cijfers
            const HH = String(hours).padStart(2, "0");
            const MM = String(minutes).padStart(2, "0");
    
            return `${HH}:${MM}`;
        }
    
        // Update a single reservation to the database. On moving, dragging, etc.
        async updateReservation(reservation){
            console.log('Update reservation', reservation);
    
            // Change all reservations with same id in local variable 
            this.reservations.forEach((res) => {
                if (res === reservation) return;
    
                if (res.reservationId === reservation.reservationId) {
                    res.end = reservation.end;
                    res.start = reservation.start;
                }
            })
    
            // Als de start- en eindtijd van de reservering voor de starttijd van de timeline ligt, dan start de reservering de volgende dag (na middennacht)
            if (reservation.start < this.startTime && reservation.end < this.startTime) {
                reservation.startDate = this.addOneDay(this.currentDate);
            }
            else {
                reservation.startDate = this.toDateString(this.currentDate);
            }
    
            // Als de eindtijd van de reservering voor de starttijd van de timeline ligt, dan eindigt de reservering de volgende dag (na middennacht) 
            if (reservation.end < this.startTime) {
                reservation.endDate = this.addOneDay(this.currentDate);
            }
            else {
                reservation.endDate = this.toDateString(this.currentDate);
            }
    
            await axios.post(`${this.domain}/template.gcl?templateName=updateReservationFromTimeline`, reservation, {headers: {'Content-Type': 'multipart/form-data'}});
        }
    
        // Functie om 1 dag op te tellen bij een gegeven datum in string vorm '2025-09-01'
        addOneDay = dateStr => this.toDateString(new Date(new Date(dateStr).setDate(new Date(dateStr).getDate() + 1)));
    
        // Functie om datum-string uit datum te halen, rekeninghoudend met lokale tijdzone
        toDateString = date => {
            const year = date.getFullYear();                              // jaar viercijferig
            const month = String(date.getMonth() + 1).padStart(2, '0');   // maand 01-12
            const day = String(date.getDate()).padStart(2, '0');          // dag 01-31
            return `${year}-${month}-${day}`;
        }
    
        // Get tables and table groups from database and fill or refresh internal 
        // Example of variable:
        //this.tableGroups = {
        //  "Kleine Tafels": [{id: 123, text:"Tafel 1", capacity:"1 - 6"},{id:456, text:"Tafel 2", capacity:"1 - 4"}],
        //  "Grote Tafels": [{id: 789, text:"Tafel 3", capacity:"2 - 4"},{id:1011, text:"Tafel 4", capacity:"7 - 10"}]
        //};
        async getTables() {
            try {
                const tablesResponse = await axios.get(`${this.domain}/template.gcl?templateName=getTablesForTimeline&userId=${dynamicItems.base.settings.userId}`);
                this.tableGroups = tablesResponse.data.reduce((groups, item) => {
                    if (!groups[item.room]) {
                        groups[item.room] = [];
                    }
                    groups[item.room].push({
                        id: item.id,
                        text: item.table,
                        capacity: item.capacity,
                        roomActive: item.roomActive,
                        onlineState: item.onlineState
                    });
                    return groups;
                }, {});
            } catch(exception) {
                UIkit.notification({
                    message: `<span uk-icon='icon: warning'></span> Kon tafels niet laden`,
                    status: 'danger'
                });
                console.error(exception);
            }
        }
    
        createHeader(){
            const headerTimeline = document.getElementById("header-timeline");
            headerTimeline.innerHTML = "";
            for(let i=0;i<this.totalQuarters;i+=this.quartersPerHour){
                let hour = (this.startTime + i/this.quartersPerHour) % 24;
                const hourDiv = document.createElement("div");
                hourDiv.classList.add("hour");
                hourDiv.style.minWidth = `${this.quartersPerHour*this.cellWidth}px`;
                hourDiv.style.maxWidth = `${this.quartersPerHour*this.cellWidth}px`;
                hourDiv.innerText = `${hour}:00`;
                headerTimeline.appendChild(hourDiv);
            }
        }
    
        renderReservations(){
            this.container.innerHTML = "";
    
            for(const [groupName, tables] of Object.entries(this.tableGroups)){
                const groupHeader = document.createElement("div");
                groupHeader.classList.add("group-header");
    
                // Add active class if room/group is active from database (user setting)
                if (tables[0].roomActive) {
                    groupHeader.classList.add("active");
                }
    
                const groupLabel = document.createElement("div");
                groupLabel.classList.add("group-label");
                groupLabel.innerText = groupName;
                groupHeader.appendChild(groupLabel);
    
                groupHeader.addEventListener("click", ()=>{
                    groupHeader.classList.toggle("active"); // Set or remove "active" class
    
                    const rows = document.querySelectorAll(`[data-group='${groupName}']`);
                    rows.forEach(r=>r.style.display = r.style.display==='none'?'':'none');
    
                    // Pas de lokale tableGroups aan, zodat de instelling onthouden blijft als je van dag wisselt
                    this.tableGroups[groupName].forEach(e => {e.roomActive = e.roomActive === 1 ? 0 : 1});
    
                    // Sla nieuwe instelling op bij gebruiker
                    let activeGroups = Array.from(document.querySelectorAll(".group-header.active")).map(el => el.innerText.trim()).join(",");
                    axios.post(`${this.domain}/template.gcl?templateName=saveGroupSettingsFromTimeline&userId=${dynamicItems.base.settings.userId}`, {"activeGroups": activeGroups}, {headers: {'Content-Type': 'multipart/form-data'}});
                });
    
                this.container.appendChild(groupHeader);
    
                tables.forEach(table=>{
                    const row = document.createElement("div");
                    row.classList.add("table-row");
                    if (!table.roomActive) {
                        row.style.display = "none";
                    }
                    row.dataset.table = table.id;
                    row.dataset.group = groupName;
    
                    const label = document.createElement("div");
                    label.classList.add("table-label");
                    label.innerText = table.text;
                    row.appendChild(label);
    
                    if (table.onlineState === '1') {
                        const onlineState = document.createElement("div");
                        onlineState.classList.add("table-online-state");
                        label.appendChild(onlineState);
                    }
    
                    if (table.capacity) {
                        const capacity = document.createElement("div");
                        capacity.classList.add("table-capacity");
                        capacity.innerText = table.capacity;
                        label.appendChild(capacity);
                    }
    
                    const timeline = document.createElement("div");
                    timeline.classList.add("timeline");
    
                    for(let i=0;i<this.totalQuarters;i++){
                        const cell = document.createElement("div");
                        cell.classList.add("quarter-cell");
                        const hour = (this.startTime + Math.floor(i/this.quartersPerHour)) % 24;
                        const minute = (i % this.quartersPerHour)*15;
                        cell.classList.add(`minute${minute}`);
                        cell.title = this.formatTime(hour,minute);
                        if(!this.isInsideWorkTime(hour)) cell.classList.add("outside-work");
                        timeline.appendChild(cell);
                    }
    
                    // ---------- RESERVERINGEN ----------
                    this.reservations.filter(r=>r.table===table.id).forEach(res=>{
                        const getOffset = (hour, nextDay) => {
                            if (nextDay) {
                                return ((hour-this.startTime+24)%24)*this.quartersPerHour*this.cellWidth;
                            }
                            else {
                                return ((hour-this.startTime)%24)*this.quartersPerHour*this.cellWidth;
                            }
                        }
    
                        const getWidth = (start, end) => {
                            let diff = end - start;
                            if (diff < 0) diff += 24; // als eindtijd < starttijd → volgende dag
                            return diff * this.quartersPerHour * this.cellWidth;
                        }
    
                        const block = document.createElement("div");
                        block.classList.add("reservation");
                        block.style.left = getOffset(res.start, new Date(res.startDate).getDate() !== this.currentDate.getDate())+'px';
                        block.style.width = getWidth(res.start,res.end)+'px';
                        block.style.backgroundColor = res.color;
                        block.style.color = res.textColor;
                        block.dataset.id = res.reservationId;
                        if (res.numberOfPersons>0){
                            const numberOfPersons = document.createElement("span");
                            numberOfPersons.classList.add("numberOfPersons");
                            numberOfPersons.innerText = res.numberOfPersons;
                            block.appendChild(numberOfPersons);
                        }
                        const content = document.createElement("span");
                        content.classList.add("single-line");
                        content.innerText = res.name;
                        block.appendChild(content);
                        if (res.numberOfVisits>0){
                            const nov = document.createElement("span");
                            nov.classList.add("star-icon");
                            block.appendChild(nov);
                        }
                        const icons = document.createElement("span");
                        icons.classList.add("icons");
                        icons.classList.add("single-line");
                        if (res.notes !== ""){
                            const notes = document.createElement("span");
                            notes.classList.add("notes-icon");
                            icons.appendChild(notes);
                        }
                        if (res.paid > 0) {
                            const paid = document.createElement("span");
                            paid.classList.add("paid-icon");
                            icons.appendChild(paid);
                        }
                        if (res.arrangement > 0){
                            if (this.arrangements.find(item => item.id === res.arrangement)?.abbreviation) {
                                const arrangement = document.createElement("span");
                                arrangement.classList.add("arrangement");
                                arrangement.innerText = this.arrangements.find(item => item.id === res.arrangement).abbreviation;
                                icons.appendChild(arrangement);
                            }
                        }
                        if (res.warning !== ''){
                            const warning = document.createElement("span");
                            warning.classList.add("warning-icon");
                            icons.appendChild(warning);
                        }
                        block.appendChild(icons);
                        const handle = document.createElement("div");
                        handle.classList.add("resize-handle");
                        block.appendChild(handle);
                        this.addDragResize(block,res,handle);
    
                        // Reservation hover
                        const hover = document.createElement("div");
                        hover.id = `hover${res.reservationId}${res.table}`;
                        hover.classList.add("hover");
                        const left = getOffset(res.start, new Date(res.startDate).getDate() !== this.currentDate.getDate());
                        const width = (res.end - res.start) * this.cellWidth * (60 / (60 / this.quartersPerHour));
                        hover.style.left = (left + width / 2) + "px";
                        hover.style.transform = "translateX(-50%)"; // mooi centreren
                        hover.addEventListener("mousedown", (e) => {
                            e.stopPropagation();   // voorkomt dat de scheduler drag start
                        });
                        hover.addEventListener("dblclick", (e) => {
                            e.stopPropagation();   // voorkomt dat de dblclick van de scheduler start
                        });
                        hover.innerHTML = `<span class="hover-customer-name">${res.customerFullName}</span><span class="hover-number-of-visits">{numberOfVisits}</span><br />
                    {phoneNumbers}<hr class="hover-horizontal-line" />
                    <span class="hover-arrangement">${this.arrangements.find(item => item.id === res.arrangement)?.title || ""}</span><span class="hover-paid-amount">&euro; ${res.paid}</span><br />
                    <div class="hover-notes">
                      <span class="hover-reservation-notes">${res.notes || "<span style='color:#CCCCCC;'>Klik hier om notities toe te voegen</span>"}</span>
                      <div class="hover-edit-area" style="display:none;">
                        <textarea class="hover-notes-textarea">${res.notes || ""}</textarea>
                        <div class="hover-edit-actions">
                          <button class="hover-save">✔</button>
                          <button class="hover-cancel">✖</button>
                        </div>
                      </div>
                    </div>
                    <span class="hover-icons">
                        <a href="#" title="Inchecken" class="check-in" style="${res.checkIn!==null ? `display:none;` : ""}">📥</a>
                        <a href="#" title="Uitchecken" class="check-out" style="${res.checkIn===null || res.checkOut!==null ? `display:none;` : ""}">📤</a>                    
                        ${res.warning ? `<a href="#" title="${res.warning}">⚠️</a>` : ""}
                        <a href="#" title="Reservering bewerken" class="edit-button">✏️️</a>
                    </span>`;
                        if (res.numberOfVisits>0){
                            hover.innerHTML = hover.innerHTML.replace("{numberOfVisits}", `⭐ ${res.numberOfVisits} bezoeken`);
                        }
                        else {
                            hover.innerHTML = hover.innerHTML.replace("{numberOfVisits}", 'nieuwe gast');
                        }
                        let phoneNumberHtml = '';
                        if (res.customerPhoneNumber !== "" || res.customerMobileNumber !== ""){
                            phoneNumberHtml = '<span class="hover-customer-phonenumber">';
                            if (res.customerPhoneNumber !== "")
                                phoneNumberHtml += `📞 <a href="tel:${res.customerPhoneNumber}">${res.customerPhoneNumber}</a>`;
                            if (res.customerPhoneNumber !== "" && res.customerMobileNumber !== "")
                                phoneNumberHtml += '&nbsp;&nbsp;&nbsp;/&nbsp;&nbsp;&nbsp;';
                            if (res.customerMobileNumber !== "")
                                phoneNumberHtml += `📞 <a href="tel:${res.customerMobileNumber}">${res.customerMobileNumber}</a>`;
                            phoneNumberHtml += '</span><br />';
                        }
                        hover.innerHTML = hover.innerHTML.replace("{phoneNumbers}",phoneNumberHtml);
    
                        // Selecteer de edit-button binnen hover
                        const editBtn = hover.querySelector(".edit-button");
                        if (editBtn) {
                            editBtn.addEventListener("click", function(event) {
                                event.preventDefault();
                                timelineScheduler.openReservationInCoder(res);
                            });
                        }
    
                        // Inchecken
                        const checkInButton = hover.querySelector(".check-in");
                        if (checkInButton) {
                            checkInButton.addEventListener("click", function(event) {
                                event.preventDefault();
                                axios.post(`${this.domain}/template.gcl?templateName=checkInFromTimeline`, {"reservationId": res.reservationId}, {headers: {'Content-Type': 'multipart/form-data'}});
                                checkInButton.style.display = "none";
                                const checkOutButton = hover.querySelector(".check-out");
                                if (checkOutButton) {
                                    checkOutButton.style.display = "inline";
                                }
                            });
                        }
    
                        // Uitchecken
                        const checkOutButton = hover.querySelector(".check-out");
                        if (checkOutButton) {
                            checkOutButton.addEventListener("click", function(event) {
                                event.preventDefault();
                                axios.post(`${this.domain}/template.gcl?templateName=checkOutFromTimeline`, {"reservationId": res.reservationId}, {headers: {'Content-Type': 'multipart/form-data'}});
                                checkOutButton.style.display = "none";
                            });
                        }
    
                        // logica voor inline editing notes
                        const notesSpan = hover.querySelector(".hover-reservation-notes");
                        const editArea = hover.querySelector(".hover-edit-area");
                        const textarea = hover.querySelector(".hover-notes-textarea");
    
                        // klik op notitie zelf -> editmodus
                        notesSpan.addEventListener("click", () => {
                            notesSpan.style.display = "none";
                            editArea.style.display = "block";
                            textarea.focus();
                        });
    
                        hover.querySelector(".hover-save").addEventListener("click", () => {
                            const newNotes = textarea.value.trim();
                            notesSpan.textContent = newNotes || "—";
                            notesSpan.style.display = "inline";
                            editArea.style.display = "none";
    
                            // update in je model
                            res.notes = newNotes;
    
                            // direct naar backend sturen
                            axios.post(`${this.domain}/template.gcl?templateName=saveNotesFromTimline`, res, {headers: {'Content-Type': 'multipart/form-data'}});
                        });
    
                        hover.querySelector(".hover-cancel").addEventListener("click", () => {
                            textarea.value = res.notes || "";
                            notesSpan.style.display = "inline";
                            editArea.style.display = "none";
                        });
    
                        this.attachHoverHandlers(block, hover, res);
    
                        timeline.appendChild(block);
                        timeline.appendChild(hover);
                    });
    
                    // draw-to-create: correct berekenen t.o.v. timeline (ipv e.offsetX van cell)
                    let isDrawing = false;
                    let drawStartX = 0;
                    let ghostBlock = null;
                    const self = this;
                    const tl = timeline; // closure reference
    
                    function startDrawing(e) {
                        // alleen linkermuisknop, en niet op bestaande reservering / resize-handle
                        if (e.button !== 0) return;
                        if (e.target.closest('.reservation') || e.target.classList?.contains('resize-handle')) return;
                        if (self.activeDrag) return; // geen create tijdens drag van reservering
    
                        const rect = tl.getBoundingClientRect();
                        drawStartX = e.clientX - rect.left + tl.scrollLeft; // correcte startposition tov timeline content
                        isDrawing = true;
                        document.querySelectorAll(".hover").forEach(e => {e.style.display="none"}); // Verberg alle actieve hovers
                        timelineScheduler.suppressHover = true;
    
                        ghostBlock = document.createElement('div');
                        ghostBlock.className = 'reservation ghost';
                        ghostBlock.style.backgroundColor = '#95a5a6';
                        ghostBlock.style.left = drawStartX + 'px';
                        ghostBlock.style.width = '0px';
                        ghostBlock.style.opacity = '0.6';
                        ghostBlock.style.pointerEvents = 'none';
                        tl.appendChild(ghostBlock);
    
                        // gebruik document listeners zodat we ook buiten de timeline kunnen tekenen
                        document.addEventListener('mousemove', onDrawingMove);
                        document.addEventListener('mouseup', onDrawingEnd);
    
                        // voorkom select / text highlight tijdens drag
                        e.preventDefault();
                    }
    
                    function onDrawingMove(ev) {
                        if (!isDrawing || !ghostBlock) return;
                        const rect = tl.getBoundingClientRect();
                        const currentX = ev.clientX - rect.left + tl.scrollLeft;
                        const left = Math.min(drawStartX, currentX);
                        const width = Math.max(2, Math.abs(currentX - drawStartX)); // min width
    
                        ghostBlock.style.left = left + 'px';
                        ghostBlock.style.width = width + 'px';
                    }
    
                    async function onDrawingEnd(ev) {
                        if (!isDrawing || !ghostBlock) return;
                        // compute final positions            
                        const startPixels = parseFloat(ghostBlock.style.left);
                        const widthPixels = parseFloat(ghostBlock.style.width);
                        const minWidthForCreation = self.cellWidth; // 1 kwartier
    
                        if (widthPixels < minWidthForCreation) {
                            // Te klein → geen nieuwe reservering
                            ghostBlock.remove();
                            ghostBlock = null;
                            isDrawing = false;
                            timelineScheduler.suppressHover = false;
                            document.removeEventListener('mousemove', onDrawingMove);
                            document.removeEventListener('mouseup', onDrawingEnd);
                            return;
                        }
    
                        // Snap naar kwartieren: start = floor, end = ceil
                        let startQuarters = Math.floor(startPixels / self.cellWidth);
                        let endQuarters = Math.ceil((startPixels + widthPixels) / self.cellWidth);
                        /*if (Math.floor(startPixels / self.cellWidth) === Math.floor((startPixels + widthPixels) / self.cellWidth)) {
                          // Single click, without drag, standard duration 3 hours
                          endQuarters = startQuarters + 12;              
                        }
                        else {
                          // Drag action, calculate end
                          endQuarters = Math.ceil((startPixels + widthPixels) / self.cellWidth);  
                        }*/
    
                        // clamp binnen timeline (0 .. totalQuarters)
                        startQuarters = Math.max(0, Math.min(self.totalQuarters - 1, startQuarters));
                        endQuarters = Math.max(startQuarters + 1, Math.min(self.totalQuarters, endQuarters));
    
                        const startHour = (self.startTime + startQuarters / self.quartersPerHour) % 24;
                        const endHour = (self.startTime + endQuarters / self.quartersPerHour) % 24;
    
                        // maak nieuw object (pas velden aan volgens jouw model)
                        const newReservation = {
                            reservationId: Date.now(), // tijdelijk id
                            reservationIdEncrypted: "",
                            name: 'Nieuwe reservering',
                            table: parseInt(row.dataset.table, 10),
                            start: startHour,
                            end: endHour,
                            startDate: self.toDateString(self.currentDate),
                            endDate: self.toDateString(self.currentDate),
                            paid: 0,
                            color: '#27ae60',
                            textColor: '#ffffff',
                            numberOfPersons: 0,
                            arrangement: 0,
                            notes: "",
                            numberOfVisits: 0,
                            warning: ""
                        };
    
                        // cleanup
                        ghostBlock.remove();
                        ghostBlock = null;
                        isDrawing = false;
    
                        document.removeEventListener('mousemove', onDrawingMove);
                        document.removeEventListener('mouseup', onDrawingEnd);
    
                        // voeg toe en render
                        self.reservations.push(newReservation);
                        //self.renderReservations();
    
                        // create reservation in database and open new reservation
                        const response  = await axios.post(`${timelineScheduler.domain}/template.gcl?templateName=insertReservationFromTimeline&userName=${dynamicItems.base.settings.username}`, newReservation, {headers: {'Content-Type': 'multipart/form-data'}});
    
                        if (response.data.id) {
                            // open the created reservation
                            newReservation.reservationId = response.data.id;
                            newReservation.reservationIdEncrypted = response.data.encryptedId;
                            timelineScheduler.openReservationInCoder(newReservation);
                        }
                    }
    
                    timeline.addEventListener('mousedown', startDrawing);
    
                    // Dubbelklik: altijd nieuwe reservering op klikpositie
                    timeline.addEventListener('dblclick', async e => {
                        if (e.target.closest('.reservation') || e.target.classList?.contains('resize-handle')) return;
                        const rect = tl.getBoundingClientRect();
                        const clickX = e.clientX - rect.left + tl.scrollLeft;
                        const quarter = Math.floor(clickX / self.cellWidth);
                        const startHour = (self.startTime + quarter / self.quartersPerHour) % 24;
                        const endHour = (startHour + 3) % 24; // standaard 3 uur
    
                        const newReservation = {
                            reservationId: Date.now(),
                            reservationIdEncrypted: "",
                            name: 'Nieuwe reservering',
                            table: parseInt(row.dataset.table, 10),
                            start: startHour,
                            end: endHour,
                            startDate: self.toDateString(self.currentDate),
                            endDate: self.toDateString(self.currentDate),
                            paid: 0,
                            color: '#27ae60',
                            textColor: '#ffffff',
                            numberOfPersons: 0,
                            arrangement: 0,
                            notes: "",
                            numberOfVisits: 0,
                            warning: ""
                        };
    
                        self.reservations.push(newReservation);
                        //self.renderReservations();
    
                        // create reservation in database and open new reservation
                        const response  = await axios.post(`${this.domain}/template.gcl?templateName=insertReservationFromTimeline&userName=${dynamicItems.base.settings.username}`, newReservation, {headers: {'Content-Type': 'multipart/form-data'}});
    
                        if (response.data.id) {
                            // open the created reservation
                            newReservation.reservationId = response.data.id;
                            newReservation.reservationIdEncrypted = response.data.encryptedId;
                            timelineScheduler.openReservationInCoder(newReservation);
                        }
                    });
    
                    row.appendChild(timeline);
                    this.container.appendChild(row);
                });
            }
    
            // Fill header with sum of persons for all reservations 
            const headerSumPersons = document.getElementById("header-sum-persons");
            headerSumPersons.innerHTML = "";
            for (let i = 0; i < this.totalQuarters; i += this.quartersPerHour / 2) {
                let time = this.startTime + i / this.quartersPerHour; // bv 14.5            
                const personsDiv = document.createElement("div");
                personsDiv.classList.add("hour");
                personsDiv.style.minWidth = `${(this.quartersPerHour / 2) * this.cellWidth}px`;
                personsDiv.style.maxWidth = `${(this.quartersPerHour / 2) * this.cellWidth}px`;
                personsDiv.innerText = this.getPersonsAtTime(time);
                headerSumPersons.appendChild(personsDiv);
            }
    
            // Give reservations with multiple tables other styling
            const seenIds = new Set();
            const connectedIds = new Set();
            const elements = document.querySelectorAll('.reservation[data-id]');
    
            elements.forEach(el => {
                const id = el.getAttribute('data-id');
                if (seenIds.has(id)) {
                    // Duplicate gevonden: maak de tekstkleur iets lichter gebaseerd op achtergrond
                    if (!connectedIds.has(id))
                        connectedIds.add(id);
    
                    const bg = getComputedStyle(el).backgroundColor;
                    el.style.color = this.lightenColor(bg, 0.4);
                } else {
                    seenIds.add(id);
                }
            });
    
            elements.forEach(el => {
                const id = el.getAttribute('data-id');
                if (connectedIds.has(id)) {
                    el.classList.add('connected');
                }
    
                el.addEventListener('mouseenter', () => {
                    document.querySelectorAll(`.reservation[data-id="${id}"]`).forEach(el => {
                        el.classList.add('hovered');
                    });
                });
    
                el.addEventListener('mouseleave', () => {
                    document.querySelectorAll(`.reservation[data-id="${id}"]`).forEach(el => {
                        el.classList.remove('hovered');
                    });
                });
            });
    
            this.updateCurrentTimeLine();
        }
    
        // Functie om RGB kleur lichter te maken
        lightenColor(bgColor, amount = 0.3) {
            // bgColor in rgb(a) string, bijv. "rgb(52, 152, 219)"
            const match = bgColor.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/);
            if (!match) return bgColor;
    
            let [r, g, b] = match.slice(1, 4).map(Number);
    
            // lineair lichtere kleur
            r = Math.min(255, r + (255 - r) * amount);
            g = Math.min(255, g + (255 - g) * amount);
            b = Math.min(255, b + (255 - b) * amount);
    
            return `rgb(${Math.round(r)}, ${Math.round(g)}, ${Math.round(b)})`;
        }
    
        // Open reservation from Coder in iframe
        openReservationInCoder(reservation) {
            if (window.top === self) {
                alert(`Open reservation in Coder: ${reservation.name} (${reservation.reservationIdEncrypted})`);
            }
            else {
                dynamicItems.windows.loadItemInWindow(false, reservation.reservationId, reservation.reservationIdEncrypted, 'reservation', '', false, dynamicItems.grids.mainGrid, { hideTitleColumn: true }, 0, null, null);

                /*let target = window.location.href.includes('reservery.dev') || window.location.href.includes('localhost') ? 'https://maindev.coder.nl' : 'https://' + new URL(window.location.href).hostname.split('.')[0] + '.coder.nl';
                window.top.postMessage({
                    action: "OpenItem",
                    actionData: {
                        moduleId: 602,
                        name: `Reservering: ${reservation.name}`,
                        type: "dynamicItems",
                        itemId: `${decodeURIComponent(reservation.reservationIdEncrypted)}`,
                        entityType: "Reservation",
                        queryString: `?itemId=${decodeURIComponent(reservation.reservationIdEncrypted)}&moduleId=602&iframe=true&entityType=Reservation`
                    }
                }, target);*/
                
            }
        }
    
        // Tonen en verbergen van hovers
        attachHoverHandlers(reservationElement, hoverElement, res) {
            const showHover = () => {
                if (!timelineScheduler.suppressHover) {
                    clearTimeout(this.hoverTimers[`${res.reservationId}_hide`]);
                    this.hoverTimers[res.reservationId] = setTimeout(() => {
                        const hover = document.getElementById(`hover${res.reservationId}${res.table}`);
                        if (hover) {
                            // Verberg alle andere hovers
                            document.querySelectorAll(".hover").forEach(e => { e.style.display = "none"; });
    
                            // Toon deze hover
                            hover.style.display = "block";
    
                            const rect = hover.getBoundingClientRect();
                            const reservationRect = reservationElement.getBoundingClientRect();
                            const viewportHeight = window.innerHeight;
                            const margin = 8; // optionele marge
    
                            // Check beschikbare ruimte onder de reservering
                            const spaceBelow = viewportHeight - reservationRect.bottom - margin;
    
                            if (spaceBelow < rect.height) {
                                // Niet genoeg ruimte onder, hover omhoog plaatsen
                                hover.style.top = '-256px';
                            } else {
                                // Genoeg ruimte onder, hover normaal onder reservering plaatsen
                                hover.style.top = '35px';
                            }
                        }
                    }, 200);
                }
            };
    
            const hideHover = () => {
                clearTimeout(this.hoverTimers[res.reservationId]);
                this.hoverTimers[`${res.reservationId}_hide`] = setTimeout(() => {
                    const hover = document.getElementById(`hover${res.reservationId}${res.table}`);
                    if (hover) hover.style.display = "none";
                }, 300); // Dit is de timeout op het sluiten, zodat je de tijd hebt om met je muis naar de hover te gaan
            };
    
            // Bind op reservation
            reservationElement.addEventListener("mouseenter", showHover);
            reservationElement.addEventListener("mouseleave", hideHover);
    
            // Bind ook op hover zelf
            hoverElement.addEventListener("mouseenter", showHover);
            hoverElement.addEventListener("mouseleave", hideHover);
        }
    
        // Functie geeft het aantal personen op een bepaald tijdstip terug
        getPersonsAtTime(time) {
            return this.reservations
                .filter(r => r.start <= time && r.end >= time) // check of reservering actief is
                .reduce((sum, r) => sum + (r.numberOfPersons || 0), 0); // tel alles op
        }
    }
    
    // Inject custom Javascript code from the entity property's settings.
    {customScript}
})();