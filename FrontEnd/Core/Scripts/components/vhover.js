export default {
	name: 'Hover',
	data() {
		return {
			isHovering: false
		};
	},
	methods: {
		enter() {
			this.isHovering = true;
		},
		leave() {
			this.isHovering = false;
		}
	},
	render() {
		const slot = this.$slots.default?.({
			isHovering: this.isHovering,
			onMouseenter: this.enter,
			onMouseleave: this.leave
		});

		if (!slot || !slot.length)
			return null;

		const firstChild = slot[0];
		firstChild.props = {
			...(firstChild.props || {}),
			onMouseenter: this.enter,
			onMouseleave: this.leave
		};

		return firstChild;
	}
};