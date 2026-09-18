export default {
    name: "wiser-dialog-action",

    props: {
        text: {type: String, default: "Button"},
        translationKey: {type: String, default: null},
        visible: {type: Boolean, default: true},
        primary: {type: Boolean, default: false},
        action: { type: Function },
        closeDialog: { type: Function, default: () => {} }
    },

    data() {
        return {
            mutableVisible: this.visible
        };
    },

    computed: {
    },

    components: {
    },

    methods: {
        async onClick(event) {
            event.preventDefault();

            let closeDialog = true;

            if (typeof this.action === "function") {
                const isAsync = this.action.constructor.name === "AsyncFunction";
                let actionResult;

                if (isAsync) {
                    actionResult = await this.action();
                } else {
                    actionResult = this.action();
                }

                closeDialog = actionResult !== false;
            }

            if (!closeDialog) {
                return;
            }

            this.closeDialog();
        }
    },

    template: `
      <button :class="{ 'btn': true, 'btn-primary': primary }" @click="onClick"
              :data-translation-value="translationKey">{{ text }}
      </button>
    `
};