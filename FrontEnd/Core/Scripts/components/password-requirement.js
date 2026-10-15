const template = `
	<div class="password-requirement" :style="'color: ' + color">
		<span class="password-requirement-check mdi" :class="[ 'mdi-' + icon ]"></span>
		<span class="password-requirement-text">
			<slot/>
		</span>
	</div>
`;

export default {
	name: 'password-requirement',
	template: template,
	props: {
		accepted: {
			type: Boolean,
			default: false
		}
	},
	data: () => ({
		stateMap: new Map([
			[ true, {
				icon: 'check',
				color: '#2ECC71'
			} ],
			[ false, {
				icon: 'close',
				color: '#8c8c8c'
			}]
		])
	}),
	computed: {
		icon() {
			return this.stateMap.get(this.accepted).icon;
		},
		color() {
			return this.stateMap.get(this.accepted).color;
		}
	}
}