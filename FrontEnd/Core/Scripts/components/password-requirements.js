const template = `
<div class="password-requirements-container">
	<slot/>
</div>
`;

export default {
	name: 'password-requirements',
	template: template,
	props: {
		modelValue: {
			type: Boolean,
			default: false
		}
	},
	computed: {
		requirements() {
			return this.$slots.default()
				.map(node => node.props?.accepted)
				.filter(value => value !== undefined);
		},
		valid() {
			return this.requirements.length > 0 && this.requirements.every(value => value);
		}
	},
	watch: {
		valid: {
			immediate: true,
			handler(value) {
				this.$emit("update:modelValue", value);
			}
		}
	}
};