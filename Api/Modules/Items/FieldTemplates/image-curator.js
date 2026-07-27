(async () => {
	let options = {options};

	const container = $('#container_{propertyIdWithSuffix}');
	const readonly = {readonly};

	const hiddenInput = $('#field_{propertyIdWithSuffix}');
	const poolContainer = $('#pool_{propertyIdWithSuffix}');
	const activeContainer = $('#active_{propertyIdWithSuffix}');

	const poolTitle = container.find('.curator-title-pool');
	const activeTitle = container.find('.curator-title-active');
	poolTitle.text(options.poolTitle);
	activeTitle.text(options.activeTitle);
	
	let poolFiles = {poolFiles};
	let activeFiles = {activeFiles};
	
	const normalizeFiles = (files) => {
		if(!files || !files.length)
			return;
		
		for (let i = 0; i < files.length; i++) {
			files[i].readonly = readonly;
			files[i].entityType = '{entityType}';
		}
	}
	
	normalizeFiles(poolFiles);
	normalizeFiles(activeFiles);

	const state = {
		poolFiles: {poolFiles} || [],
		activeFiles: {activeFiles} || []
	};

	const template = kendo.template($("#imageCuratorTemplate").html());

	render();
	initSortable();
	bindEvents();
	
	{customScript}

	function render() {
		poolContainer.html(kendo.render(template, state.poolFiles));
		activeContainer.html(kendo.render(template, state.activeFiles));
		updateHiddenInput();
	}

	function updateHiddenInput() {
		hiddenInput.val(JSON.stringify(
			state.activeFiles.map((file, index) => ({
				fileId: file.fileId,
				ordering: index + 1
			}))
		));
	}

	function bindEvents() {
		poolContainer
			.off('click.imageCurator')
			.on('click.imageCurator', '.imgAdd', addImage);

		activeContainer
			.off('click.imageCurator')
			.on('click.imageCurator', '.imgRemove', removeImage);
	}

	function addImage() {
		const fileId = $(this).closest('.product').data('imageId');
		
		const file = state.poolFiles.find(f => f.fileId === fileId);
		
		if (!file)
			return;
		
		const fileClone = { ...file };
		fileClone.listType = 'active';
		
		state.activeFiles.push(fileClone);
		
		render();
		save();
	}

	function removeImage() {
		const fileId = $(this).closest('.product').data('imageId');
		state.activeFiles = state.activeFiles.filter(file => file.fileId !== fileId);
		render();
		save();
	}

	function initSortable() {
		activeContainer.kendoSortable({
			cursor: 'move',
			hint: event => event.clone(),
			placeholder: event => event.clone().addClass('k-state-hover').css('opacity', 0.65),
			change: event => {
				const moved = state.activeFiles.splice(event.oldIndex, 1)[0];
				state.activeFiles.splice(event.newIndex, 0, moved);
				updateHiddenInput();
				save();
			}
		});
	}

	async function save() {
		await Wiser.api({
			url: `${dynamicItems.settings.wiserApiRoot}items/${encodeURIComponent('{itemIdEncrypted}')}/image-curator/{propertyId}`,
			dataType: 'json',
			method: 'PUT',
			contentType: 'application/json',
			data: JSON.stringify({
				files: JSON.parse(hiddenInput.val())
			})
		})
	}
})();