export default {
    name: "task-alerts",
    props: ["subDomain"],
    data() {
        return {
            unreadMessage: false,
            taskCount: null,
            isOpened: false
        };
    },
    async created() {
        window.addEventListener("message", this.onReceiveMessage.bind(this));


    },
    computed: {
    },
    components: {
    },
    methods: {
        addAlert() {
            if (this.unreadMessage) {
                return;
            }

            this.unreadMessage = true;

            //play audio, this will only play if the user had interaction with the page. This is a browser setting.
            const audio = new Audio("/sounds/message.mp3");
            audio.play();
        },

        removeAlert() {
            this.unreadMessage = false;
        },

        updateTaskCount(count) {
            if (count === 0) {
                this.removeAlert();
            }

            this.taskCount = count;
        },

        onReceiveMessage(event) {
            const myOrigin = window.location.origin || window.location.protocol + "//" + window.location.host;
            if (event.origin !== myOrigin) {
                return;
            }

            if (!event.data.hasOwnProperty("action")) {
                return;
            }

            switch (event.data.action) {
            case "NewMessageReceived":
                this.addAlert();
                break;

            case "UpdateTaskCount":
                this.updateTaskCount(event.data.taskCount);
                break;
            }
        },

        toggleOpen() {
            this.isOpened = !this.isOpened;
            if (this.isOpened) {
                this.removeAlert();
            }
            
            const taskFrameElement = document.getElementById("taskFrame");
            
            const coderTabStrip = document.getElementById('coder-tab-strip');
            const coderTabStripBounds = coderTabStrip.getBoundingClientRect();
            const containerHeight = window.innerHeight - coderTabStripBounds.height;
            
            taskFrameElement.style.height = `${containerHeight}px`;
            
            const taskButton = document.getElementById("task");
            
            const taskButtonBounds = taskButton.getBoundingClientRect();
            const taskFrameBounds = taskFrameElement.getBoundingClientRect();
            
            const containerX = -(taskFrameBounds.width / 2);
            const containerY = (taskButtonBounds.height + taskFrameBounds.height) / 2;

            taskFrameElement.style.transform = `translate(${containerX}px, ${containerY}px)`;
        }
    },
    template: `
        <div class="tab-strip-button" id="task" :class="{ alert: unreadMessage, open: isOpened }" :data-alert="taskCount" @click="toggleOpen()">
            <ins class="mdi mdi-size-2 mdi-message-text-outline"></ins>
            <div class="taskAlert"><ins class="icon-bell"></ins><span>Open recente meldingen</span></div>
            <iframe src="/Modules/TaskAlerts" id="taskFrame"></iframe>
        </div>`
};