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
    
        constructor() {
            this.options = {options};
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
                onChange: (selectedDates) => {
                    this.currentDate = selectedDates[0];
                    this.updateDateDisplay();
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

            document.getElementById("today-button").addEventListener("click", () => {
                this.currentDate = new Date();
                this.updateDateDisplay();
            });
    
            document.getElementById("refresh-button").addEventListener("click", () => {
                this.updateDateDisplay();
            });
    
            currentDateSpan.innerText = this.formatDate(this.currentDate);
            this.createHeader();

            // Load arrangements and cache for 1 hour            
            this.arrangements = (await this.callApi(this.options.timelineSchedulerQueryGetArrangements));
    
            // Get tables and reservations
            await this.getTables();    
            
            // Get and render reservations
            this.getReservations(this.toDateString(this.currentDate))
            
            // Horizontal scroll bar position
            const scheduler = document.querySelector(".scheduler");
            if (scheduler) {
                if (this.currentDate.toDateString() === new Date().toDateString()) {
                    const now = new Date();
                    const nowHour = now.getHours() + now.getMinutes() / 60;
                    if (nowHour < this.startTime && nowHour > this.endTime) { // Is outside view    
                        // Start horizontal scrollbar in the middle
                        scheduler.scrollLeft = (scheduler.scrollWidth - scheduler.clientWidth) / 2; 
                    }
                    else {
                        // Start horizontal scrollbar with the current time in the middle
                        const hoursFromStart = (nowHour - this.startTime + 24) % 24;
                        const pixelsFromStart = hoursFromStart * this.quartersPerHour * this.cellWidth;
                        const targetScrollLeft = pixelsFromStart - scheduler.clientWidth / 2;

                        scheduler.scrollLeft = Math.max(
                            0,
                            Math.min(
                                scheduler.scrollWidth - scheduler.clientWidth,
                                targetScrollLeft
                            )
                        );
                    }
                }
                else {
                    // Start horizontal scrollbar in the middle
                    scheduler.scrollLeft = (scheduler.scrollWidth - scheduler.clientWidth) / 2;
                }    
            }
    
            // Add observer, so timeline will be refreshed when iframe gets focus back (change tab in Coder and back to scheduler)     
            /*const observer = new IntersectionObserver((entries) => {
                entries.forEach(entry => {
                    if (entry.isIntersecting) {
                        console.log("Timeline scheduler is weer zichtbaar, refresh.");
    
                        // async functie aanroepen zonder await
                        this.getReservations(this.toDateString(this.currentDate))
                    }
                });
            });
            observer.observe(scheduler);*/
            
            const searchContainer = document.querySelector(".search-container");
            
            // Zoek in lokale reserveringen (dag die open staat)
            var searchResultLocal = '';
            document.getElementById("timeline-search").addEventListener("keyup", async () => {
                searchResultLocal = await timelineScheduler.search(document.getElementById("timeline-search").value);
                document.getElementById("search-container").innerHTML = searchResultLocal;                
                searchContainer.style.display = 'block';
            });

            // Zoek in alle reserveringen (database)
            var searchResultDatabase = '';
            let debounceTimeout;
            document.getElementById("timeline-search").addEventListener("input", () => {
                const searchInput = document.getElementById("timeline-search").value;

                // Vorige timeout annuleren
                clearTimeout(debounceTimeout);

                // Nieuwe timeout instellen
                debounceTimeout = setTimeout(async () => {
                    if (searchInput.length >= 3) { // Zoeken in database vanaf drie karakters
                        document.getElementById("search-container").innerHTML += '<div class="loader">Bezig met zoeken...</div>';
                        searchResultDatabase = await timelineScheduler.searchDatabase(searchInput);
                        document.getElementById("search-container").innerHTML = document.getElementById("search-container").innerHTML.replace('<div class="loader">Bezig met zoeken...</div>',searchResultDatabase);
                        
                        if (!searchResultLocal && !searchResultDatabase)
                            document.getElementById("search-container").innerHTML = '<div class="loader"><i>Geen resultaten</i></div>';
                    }
                }, 300); // vertraging op starten zoekfunctie
            });

            // Event delegation voor hover/highlight
            document.addEventListener('mouseenter', (e) => {
                // check dat het een element is
                if (!(e.target instanceof Element)) return;

                // zoek het dichtstbijzijnde .search-item-today-item
                const item = e.target.closest('.search-item-today-item');
                if (!item) return;

                const reservationId = item.getAttribute('data-reservation-id');
                timelineScheduler.highlightAndScrollToReservation(reservationId);
            }, true); // useCapture true, zodat mouseenter werkt op delegation

            // Event delegation voor mouseleave
            document.addEventListener('mouseleave', (e) => {
                if (!(e.target instanceof Element)) return;

                const item = e.target.closest('.search-item-today-item');
                if (!item) return;

                const reservationId = item.getAttribute('data-reservation-id');
                const reservation = document.querySelector(`.reservation[data-id="${reservationId}"]`);
                if (reservation) {
                    reservation.classList.remove('highlight');
                }
            }, true);

            // sluit de search container als er buiten wordt geklikt
            document.addEventListener('click', async (event) => {
                // check of er buiten de box én niet op de knop is geklikt
                if (!searchContainer.contains(event.target)) {
                    searchContainer.style.display = 'none';
                }
                
                // open de reservering als erop geklikt wordt
                if (!(event.target instanceof Element)) return;

                const item = event.target.closest('.search-item-today-item');
                if (!item) return;

                const reservationId = Number(item.getAttribute('data-reservation-id'));
                const encryptedReservationId = item.getAttribute('data-reservation-id-encrypted');

                timelineScheduler.openReservationInCoder(reservationId, encryptedReservationId);
                
                // Open datum van reservering in timeline view en scroll naar hoogte van reservering en highlight reservering
                timelineScheduler.currentDate = new Date(item.getAttribute('data-date'));                
                await timelineScheduler.updateDateDisplay();
                timelineScheduler.highlightAndScrollToReservation(item.getAttribute('data-reservation-id'));
            });
            
            // Change view when clicking list or timeline view
            const timelineBtn = document.getElementById("timeline-view-btn");
            const listBtn = document.getElementById("list-view-btn");
            const timelineSchedulerEl = document.querySelector(".scheduler");
            const listView = document.getElementById("list-view");
            timelineBtn.addEventListener("click", () => {
                timelineBtn.classList.add("active");
                listBtn.classList.remove("active");

                timelineSchedulerEl.classList.remove("hidden");
                listView.classList.add("hidden");

                this.renderReservations();
            });

            listBtn.addEventListener("click", () => {
                listBtn.classList.add("active");
                timelineBtn.classList.remove("active");

                timelineSchedulerEl.classList.add("hidden");
                listView.classList.remove("hidden");

                this.renderReservations(); 
            });

            // Automatic refresh every x minutes
            setInterval(() => this.updateDateDisplay(), 300*1000);            
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
                        const reservation = this.activeDrag.res;
                        this.openReservationInCoder(reservation.reservationId, reservation.reservationIdEncrypted);
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
            const now = new Date();
            const currentDateIsNow = (this.currentDate.toDateString() === now.toDateString());

            if (document.getElementById("list-view-btn").classList.contains("active")) {
                // For list view
                
                // Only set active time on the current date
                if (!currentDateIsNow) {
                    document.querySelectorAll(".activeTime").forEach(el => {
                        el.classList.remove("activeTime");
                    });
                    return;
                }
                                 
                const minutes = now.getMinutes();
                const quarter = Math.floor(minutes / 15); // Bereken het kwartier (0 = 00-14, 1 = 15-29, 2 = 30-44, 3 = 45-59)
                const quarterLabel = `${now.getHours().toString().padStart(2,'0')}:${(quarter*15).toString().padStart(2,'0')}`; // bv. "13:00", "13:15"
                const element = Array.from(document.querySelectorAll(".timeLabel")).find(el => el.innerText === quarterLabel);
                if (element) element.classList.add("activeTime");
            }
            else {
                // For timeline view
                const line = document.getElementById('current-time-line');

                // Only show line on the current date
                if (!currentDateIsNow) {
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
        }
    
        formatDate(date){
            return date.toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
        }

        updateDateDisplay = async () => {
            const currentDateSpan = document.getElementById("current-date");
            currentDateSpan.innerText = this.formatDate(this.currentDate);
    
            // Get reservations for new date from database
            console.log('updateDateDisplay');
            await this.getReservations(this.toDateString(this.currentDate));
        }
    
        // Get reservations from database and fill or refresh internal
        // Only reservations for the given date
        // Example of variable:
        //this.reservations = [
        //  { id: 1, name: "Jan", table: 123, start: 12.0, end: 14.0, paid: true, color: "#FF0000", numberOfPersons: 5, etc. },
        //  { id: 4, name: "Jan", table: 123, start: 15.25, end: 16.5, paid: true, color: "#FF0000", numberOfPersons: 2, etc. }, etc.    
        //];
        async getReservations(date){            
            // Object check is because double callback after opening item and return to scheduler
            if (date && (typeof date === 'object')) {
                return;
            } 
            
            try {
                document.getElementById('spinner').style.display = 'flex';
                
                if (!date) { 
                    //date = timelineScheduler.toDateString(new Date());
                    date = timelineScheduler.toDateString(timelineScheduler.currentDate);
                }
    
                let startDateTime = `${date} ${timelineScheduler.decimalToTime(timelineScheduler.startTime)}`;
                let endDateTime;
    
                // If endtime is before starttime, then the endtime is the next day        
                if (timelineScheduler.endTime < timelineScheduler.startTime) {
                    endDateTime = `${timelineScheduler.addOneDay(date)} ${timelineScheduler.decimalToTime(timelineScheduler.endTime)}`;
                }
                else {
                    endDateTime = `${date} ${timelineScheduler.decimalToTime(timelineScheduler.endTime)}`;
                }
    
                // Get reservations                                
                let reservationsResponse = await timelineScheduler.callApi(timelineScheduler.options.timelineSchedulerQueryGetReservations, '{"startDateTime": "' +  startDateTime + '","endDateTime": "' +  endDateTime + '"}');
                timelineScheduler.reservations = reservationsResponse.map(r => ({
                    reservationId: r.id,
                    reservationIdEncrypted: r.encryptedId,
                    name: r.customer_id===0 ? 'Walk-in' : r.customer_full_name==='' ? 'Geen naam bekend' : r.customer_full_name,
                    table: r.table,
                    start: timelineScheduler.timeToDecimal(r.start),
                    end: timelineScheduler.timeToDecimal(r.end),
                    startDate: r.start.substring(0,10),
                    endDate: r.end.substring(0,10),
                    paid: r.paid,
                    color:  r.event_color || timelineScheduler.arrangements.find(item => item.id === r.arrangement)?.color || "#4B99D2", // fallback kleur
                    textColor: r.text_color || timelineScheduler.arrangements.find(item => item.id === r.arrangement)?.text_color || "#FFFFFF",
                    numberOfPersons: parseInt(r.number_of_persons, 10) || 0,
                    arrangement: parseInt(r.arrangement, 10) || 0,
                    notes: r.notes,
                    numberOfVisits: parseInt(r.number_of_visits, 10) || 0,
                    warning: r.warning,
                    customerFullName: r.customer_id===0 ? 'Walk-in' : r.customer_full_name==='' ? 'Geen naam bekend' : r.customer_full_name,
                    customerPhoneNumber: r.customer_phone_number,
                    customerMobileNumber: r.customer_mobile_number,
                    customerEmailAddress: r.customer_email_address,
                    checkIn: r.check_in,
                    checkOut: r.check_out
                }));
                
                // Zet warning bij reservation als er meer mensen zijn dan capaciteit                
                
                // Groepeer reserveringen per reservationId
                const reservationsById = {};
                timelineScheduler.reservations.forEach(reservation => {
                    if (!reservationsById[reservation.reservationId]) {
                        reservationsById[reservation.reservationId] = [];
                    }
                    reservationsById[reservation.reservationId].push(reservation);
                });
                // Loop over elke groep van dezelfde reservationId
                Object.values(reservationsById).forEach(group => {
                    // Pak het aantal personen uit de eerste reservering
                    const numberOfPersons = group[0].numberOfPersons;

                    // Bereken totale max capacity van alle tafels
                    let totalCapacity = 0;

                    group.forEach(reservation => {
                        let tableFound = null;

                        Object.values(timelineScheduler.tableGroups).some(areaTables => {
                            tableFound = areaTables.find(t => t.id === reservation.table);
                            return !!tableFound;
                        });

                        if (!tableFound) return; // tafel niet gevonden = skip

                        totalCapacity += tableFound.capacity_max;
                    });

                    // Als aantal personen > totale capaciteit → warning toevoegen
                    if (numberOfPersons > totalCapacity) {
                        group.forEach(reservation => {
                            if (reservation.warning !== '') reservation.warning += ' - ';
                            reservation.warning = `Tafels bieden niet genoeg plaats voor het aantal personen (${numberOfPersons}/${totalCapacity})`;
                        });
                    }
                });

                timelineScheduler.renderReservations();
            } catch(exception) {
                timelineScheduler.showToast("Reserveringen laden mislukt", { type: "error" });
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
    
            await this.callApi(this.options.timelineSchedulerQueryUpdateReservation, JSON.stringify(reservation));            
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
                const tablesResponse = await timelineScheduler.callApi(timelineScheduler.options.timelineSchedulerQueryGetTables);                
                this.tableGroups = tablesResponse.reduce((groups, item) => {
                    if (!groups[item.room]) {
                        groups[item.room] = [];
                    }
                    groups[item.room].push({
                        id: item.id,
                        text: item.table,
                        capacity: item.capacity,
                        capacity_max: item.capacity_max,
                        roomActive: item.roomActive,
                        onlineState: item.onlineState
                    });
                    return groups;
                }, {});
            } catch(exception) {
                timelineScheduler.showToast("Tafels laden mislukt", { type: "error" });
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
            if (document.getElementById("list-view-btn").classList.contains("active")){
                this.renderListView();
            }
            else {
                this.renderTimelineView();   
            }
            this.updateCurrentTimeLine();
        }
        
        renderTimelineView() {
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
                    this.callApi(this.options.timelineSchedulerQuerySaveGroupSettings,'{"activeGroups": "' +  activeGroups + '"}');
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
                        hover.dataset.id = res.reservationId;
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
                      <div class="hover-reservation-notes">${res.notes || "<span style='color:#CCCCCC;'>Klik hier om notities toe te voegen</span>"}</div>
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
                        <!--<a href="#" title="Reservering bewerken" class="edit-button">✏️️</a>-->
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
                                timelineScheduler.openReservationInCoder(res.reservationId, res.reservationIdEncrypted);
                            });
                        }

                        // Inchecken
                        const checkInButton = hover.querySelector(".check-in");
                        if (checkInButton) {
                            checkInButton.addEventListener("click", function(event) {
                                event.preventDefault();
                                timelineScheduler.checkIn(res);
                            });
                        }

                        // Uitchecken
                        const checkOutButton = hover.querySelector(".check-out");
                        if (checkOutButton) {
                            checkOutButton.addEventListener("click", function(event) {
                                event.preventDefault();
                                timelineScheduler.checkOut(res);
                            });
                        }

                        // logica voor inline editing notes
                        const notesDiv = hover.querySelector(".hover-reservation-notes");
                        const editArea = hover.querySelector(".hover-edit-area");
                        const textarea = hover.querySelector(".hover-notes-textarea");

                        // klik op notitie zelf -> editmodus
                        notesDiv.addEventListener("click", () => {
                            notesDiv.style.display = "none";
                            editArea.style.display = "block";
                            textarea.focus();
                        });

                        hover.querySelector(".hover-save").addEventListener("click", () => {
                            const newNotes = textarea.value.trim();
                            notesDiv.textContent = newNotes || "—";
                            notesDiv.style.display = "block";
                            editArea.style.display = "none";

                            // update in je model
                            res.notes = newNotes;

                            // direct naar backend sturen
                            this.callApi(this.options.timelineSchedulerQuerySaveNotes, JSON.stringify(res));
                        });

                        hover.querySelector(".hover-cancel").addEventListener("click", () => {
                            textarea.value = res.notes || "";
                            notesDiv.style.display = "block";
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
                        const response  = await timelineScheduler.callApi(timelineScheduler.options.timelineSchedulerQueryInsertReservation,JSON.stringify(newReservation));

                        if (response[0].id) {
                            // open the created reservation
                            newReservation.reservationId = response[0].id;
                            newReservation.reservationIdEncrypted = response[0].encryptedId;
                            timelineScheduler.openReservationInCoder(newReservation.reservationId, newReservation.reservationIdEncrypted);
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
                        const response  = await timelineScheduler.callApi(timelineScheduler.options.timelineSchedulerQueryInsertReservation, JSON.stringify(newReservation));

                        if (response[0].id) {
                            // open the created reservation
                            newReservation.reservationId = response[0].id;
                            newReservation.reservationIdEncrypted = response[0].encryptedId;
                            timelineScheduler.openReservationInCoder(newReservation.reservationId, newReservation.reservationIdEncrypted);
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
        openReservationInCoder(reservationId, reservationIdEncrypted) {
            if (window.top === self) {
                alert(`Open reservation in Coder: ${reservationIdEncrypted}`);
            }
            else {
                dynamicItems.windows.loadItemInWindow(false, reservationId, reservationIdEncrypted, 'reservation', '', false, dynamicItems.grids.mainGrid, { hideTitleColumn: true }, 0, null, null, 0, this.getReservations);

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

        // Functie voor het uitvoeren van een zoekopdracht
        async search(searchTerm){
            if (!searchTerm) return '';            
                        
            // Eerst zoeken in lokale reserveringen (view die nu open staat)
            var searchTemplate = document.getElementById("search-item-template");            
            var searchTerms = searchTerm.toLowerCase().split(' ');
            var results = '';

            const uniqueReservations = [...new Map(this.reservations.map(r => [r.reservationId, r])).values()];
            uniqueReservations.forEach(r => {
                var searchOn = `${r.customerFullName} ${r.customerPhoneNumber} ${r.customerMobileNumber} ${r.customerEmailAddress} ${r.notes} ${r.start}`.toLowerCase();                
                if (searchTerms.every(term => searchOn.includes(term))) {
                    const arrangementAbbr = timelineScheduler.arrangements.find(item => item.id === r.arrangement)?.abbreviation ?? '';
                    const tables = timelineScheduler.getTableNamesByIds(timelineScheduler.reservations.filter(rr => rr.reservationId === r.reservationId).map(rrr => rrr.table).join(','));
                    let html = searchTemplate.innerHTML;
                    html = html.replace("{reservationId}", r.reservationId)
                        .replace("{date}", "")
                        .replace("{dateformatted}", "Actieve dag")
                        .replace("{timeformatted}", timelineScheduler.decimalToTime(r.start))
                        .replace("{name}", r.customerFullName)
                        .replace("{numberofpersons}", `${r.numberOfPersons}p`)
                        .replace("{table}", tables)
                        .replace("{arrangement}", arrangementAbbr)
                        .replace("{status}", "")
                        .replace("{encryptedId}", r.reservationIdEncrypted);
                    results = `${results}${html}`;
                }
            })
            
            return results;
        }

        // Functie voor het uitvoeren van een zoekopdracht op de database (alle reserveringen)
        currentSearchController = null;
        async searchDatabase(searchTerm) {
            if (!searchTerm) return '';

            // Annuleer vorige request
            if (timelineScheduler.currentSearchController) {
                timelineScheduler.currentSearchController.abort();
            }

            timelineScheduler.currentSearchController = new AbortController();

            try {
                var searchTemplate = document.getElementById("search-item-template");                
                                
                const response = await this.callApi(
                    this.options.timelineSchedulerQuerySearch,
                    JSON.stringify({
                        search: searchTerm,
                        currentDate: this.toDateString(this.currentDate)
                    }),
                    timelineScheduler.currentSearchController.signal
                );

                // Resultaten samenstellen
                const results = response.map(reservation => {
                    const arrangementAbbr = timelineScheduler.arrangements.find(item => item.id === reservation.arrangement)?.abbreviation ?? '';
                    let html = searchTemplate.innerHTML;
                    html = html.replace("{reservationId}", reservation.reservationId)
                        .replace("{date}", reservation.date)
                        .replace("{dateformatted}", reservation.reservationDate)
                        .replace("{timeformatted}", reservation.reservationTime)
                        .replace("{name}", reservation.name)
                        .replace("{numberofpersons}", `${reservation.numberOfPersons}p`)
                        .replace("{table}", timelineScheduler.getTableNamesByIds(reservation.tables))
                        .replace("{arrangement}", arrangementAbbr)
                        .replace("{status}", reservation.reservationStatus)
                        .replace("{encryptedId}", reservation.encryptedId);
                    return html;
                }).join("");
                
                return results;
            }
            catch (error) {
                if (error.name === "CanceledError") {
                    console.log("Vorige request geannuleerd");
                } else {
                    console.error(error);
                }
            }
            
            return '';
        }

        // Functie geeft tafelnamen terug op basis van ingegeven komma-gescheiden string met tafel id's
        getTableNamesByIds(idsString) {
            if (!idsString) return '';
            
            // Split de inkomende string in een array met getallen
            const ids = idsString.split(',').map(id => parseInt(id.trim()));

            // Maak een array met alle tafels uit alle groepen
            const allTables = Object.values(this.tableGroups).flat();

            // Filter de tafels die overeenkomen met de opgegeven IDs
            const matched = allTables.filter(table => ids.includes(table.id));

            // Geef hun 'text'-waarden terug, gescheiden door komma's
            return matched.map(t => t.text).join(', ');
        }

        // Functie highlight de reservering en scrollt er naartoe
        highlightAndScrollToReservation(reservationId) {
            const reservation = document.querySelector(`.reservation[data-id="${reservationId}"]`);
            if (reservation) {
                reservation.classList.add('highlight');

                // check of element zichtbaar is in viewport
                const rect = reservation.getBoundingClientRect();
                const isVisible =
                    rect.top >= 0 &&
                    rect.bottom <= (window.innerHeight || document.documentElement.clientHeight);

                if (!isVisible) {
                    reservation.scrollIntoView({ behavior: 'smooth', block: 'center' });
                }
            }
        }

        showToast(message, options = {}) {
            const { type = 'success', duration = 3500 } = options;
            const container = document.getElementById('toast-container');
            const el = document.createElement('div');
            el.className = 'toast ' + type;
            el.setAttribute('role', 'status'); // toegankelijkheid
            el.innerHTML = `<div class="icon" aria-hidden="true">${ type === 'success' ? '✔️' : '⚠️' }</div>
                <div class="msg">${message}</div>
                <button class="close" aria-label="Sluit">&times;</button>`;

            // close knop
            el.querySelector('.close').addEventListener('click', () => timelineScheduler.removeToast(el));

            // auto remove
            const timer = setTimeout(() => timelineScheduler.removeToast(el), duration);

            // stop auto-dismiss bij hover
            el.addEventListener('mouseenter', () => clearTimeout(timer));
            el.addEventListener('mouseleave', () => {
                setTimeout(() => timelineScheduler.removeToast(el), 1200);
            });

            container.appendChild(el);
            return el;
        }

        removeToast(el) {
            if (!el) return;
            el.style.animation = 'fadeOut .25s ease forwards';
            setTimeout(() => {
                if (el.parentNode) el.parentNode.removeChild(el);
            }, 250);
        }      
        
        // For list view, accordion for each quarter wich contains reservations
        groupReservationsByQuarter() {
            const groups = {};
            const uniqueReservations = [...new Map(this.reservations.map(r => [r.reservationId, r])).values()];
            uniqueReservations.forEach(r => {                
                const slot = Math.floor(r.start * this.quartersPerHour);
                if (!groups[slot]) groups[slot] = [];
                groups[slot].push(r);
            });

            return groups;
        }

        renderListView() {
            const listView = document.getElementById("list-view");
            listView.innerHTML = ""; // leeg
            const groups = this.groupReservationsByQuarter();
            
            if (Object.keys(groups).length === 0){
                listView.innerHTML = `<div style="margin: 25px;font-size:larger;">Geen reserveringen deze dag</div>`; 
            }

            Object.keys(groups).sort((a,b)=>a-b).forEach(q => {
                const startHour = q / this.quartersPerHour;
                const label = `${String(Math.floor(startHour)).padStart(2,'0')}:${String(Math.round((startHour%1)*60)).padStart(2,'0')}`;
                const totalPersons = groups[q].reduce((sum, r) => sum + (r.numberOfPersons || 0), 0);

                const accordion = document.createElement("div");
                accordion.className = "list-accordion";
                accordion.innerHTML = `<span class="timeLabel">${label}</span> — ${groups[q].length} reservering(en) — ${totalPersons} personen`;
                accordion.dataset.slot = q;

                const panel = document.createElement("div");
                panel.className = "list-panel";
                panel.style.display = "block";

                groups[q].forEach(res => {
                    const tables = timelineScheduler.getTableNamesByIds(timelineScheduler.reservations.filter(rr => rr.reservationId === res.reservationId).map(rrr => rrr.table).join(','));
                    const arrangement = timelineScheduler.arrangements.find(item => item.id === res.arrangement)?.abbreviation;
                    const row = document.createElement("div");
                    row.className = "list-reservation";
                    row.dataset.id = res.reservationId;
                    row.innerHTML = `
                        <span class="status-dot" style="background-color:${res.color}"></span>
                        <span class="customer-name">${res.name}</span>
                        <span class="returning-star">${res.numberOfVisits > 1 ? "⭐" : ""}</span>
                        <span class="persons">${res.numberOfPersons}p</span>
                        <span class="table">${tables}</span>
                        <span class="notes">${res.notes || ""}</span>
                        ${arrangement ? `<span class="arrangement-badge">${arrangement}</span>` : `<span></span>`}
                        ${res.warning ? `
                            <span class="warning-icon" title="${res.warning}">️</span>
                        ` : `<span></span>`}
                        <span class="status-badge${res.checkOut ? " checked-out" : res.checkIn ? " checked-in" : ""}">
                            ${res.checkOut ? "UITGECHECKT" : res.checkIn ? "INGECHECKT" : ""}
                        </span>
                        <button class="icon-btn">
                            <div class="check-in" title="Inchecken" style="display: ${!res.checkIn && !res.checkOut ? "block" : "none"};">📥</div>
                            <div class="check-out" title="Uitchecken" style="display: ${res.checkIn && !res.checkOut ? "block" : "none"};">📤</div>
                        </button>
                    `;

                    //<button className="icon-btn" title="Stuur bericht">
                    //    ${res.customerFullName !== "Walk-in" ? "✉️" : ""}
                    //</button>

                    // Hover highlight
                    row.addEventListener("mouseenter", () =>
                        row.classList.add("active-row")
                    );
                    row.addEventListener("mouseleave", () =>
                        row.classList.remove("active-row")
                    );

                    // Click → Show hover popup from timeline view
                    row.addEventListener("click", () =>
                        timelineScheduler.openReservationInCoder(res.reservationId, res.reservationIdEncrypted)
                    );

                    // Actions on check-in and check-out buttons                    
                    row.querySelectorAll(".icon-btn").forEach(btn => {
                        btn.addEventListener("click", (e) => {
                            e.stopPropagation(); // <<< voorkomt dat de rij-click mee vuurt

                            const target = e.target.closest(".check-in, .check-out");
                            if (!target) return;

                            if (target.classList.contains("check-in")) {
                                this.checkIn(res);
                            }
                            else if (target.classList.contains("check-out")) {
                                this.checkOut(res);
                            }
                        });
                    });

                    panel.appendChild(row);
                });

                accordion.addEventListener("click", () => {
                    panel.style.display = (panel.style.display === "block") ? "none" : "block";
                });

                listView.appendChild(accordion);
                listView.appendChild(panel);
            });
        }

        checkIn(res) {
            timelineScheduler.callApi(timelineScheduler.options.timelineSchedulerQueryCheckIn,'{"reservationId": "' + res.reservationId + '"}').then(response => {
                timelineScheduler.reservations.find(r => r.reservationId === res.reservationId).checkIn = true;
                
                // Timeline view bijwerken
                const elementsIn = document.querySelectorAll(`[data-id="${res.reservationId}"] .check-in`);
                elementsIn.forEach(el => {
                    el.style.display = 'none';
                });
                const elementsOut = document.querySelectorAll(`[data-id="${res.reservationId}"] .check-out`);
                elementsOut.forEach(el => {
                    el.style.display = 'inline-flex';
                });
                
                // List view bijwerken
                const row = document.querySelector(`.list-reservation[data-id="${res.reservationId}"]`);
                if (row) {
                    const badge = row.querySelector(".status-badge");
                    if (badge) {
                        badge.classList.remove("checked-out");
                        badge.classList.add("checked-in");
                        badge.innerText = "INGECHECKT";
                    }
                }
                
                timelineScheduler.showToast("Inchecken succesvol", { type: "success" });
            }).catch(error => {
                timelineScheduler.showToast("Inchecken mislukt", { type: "error" });
            });
        }
        
        checkOut(res) {
            timelineScheduler.callApi(timelineScheduler.options.timelineSchedulerQueryCheckOut,'{"reservationId": "' + res.reservationId + '"}').then(response => {            
                timelineScheduler.reservations.find(r => r.reservationId === res.reservationId).checkOut = true;
                
                // Timeline view bijwerken
                const elements = document.querySelectorAll(`[data-id="${res.reservationId}"] .check-out`);
                elements.forEach(el => {
                    el.style.display = 'none';
                });
                
                // List view bijwerken
                const row = document.querySelector(`.list-reservation[data-id="${res.reservationId}"]`);
                if (row) {
                    const badge = row.querySelector(".status-badge");
                    if (badge){
                        badge.classList.remove("checked-in");
                        badge.classList.add("checked-out");
                        badge.innerText = "UITGECHECKT";
                    }
                }
                
                timelineScheduler.showToast("Uitchecken succesvol", { type: "success" });
            }).catch(error => {
                timelineScheduler.showToast("Uitchecken mislukt", { type: "error" });
            });
        }

        async callApi(queryId, data, signal = null) {
            try {
                const queryResults = await Wiser.api({
                    method: "POST",
                    url: dynamicItems.settings.wiserApiRoot +
                        "items/" + encodeURIComponent("{itemIdEncrypted}") +
                        "/action-button/{propertyId}?queryId=" + encodeURIComponent(queryId || 0),
                    contentType: "application/json",
                    data: data
                });

                return queryResults.otherData;
            } catch (error) {
                console.error(error);                
            }
        }
    }

    // Inject custom Javascript code from the entity property's settings.
    {customScript}
})();