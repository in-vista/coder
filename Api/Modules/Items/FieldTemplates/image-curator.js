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

	const uploadButton = container.find(".uploadButton");
	const uploadInput = container.find(".uploadInput");

	const template = kendo.template($("#imageCuratorTemplate").html());
	
	let poolFiles = {poolFiles};
	let activeFiles = {activeFiles};

	const state = {
		poolFiles: {poolFiles} || [],
		activeFiles: {activeFiles} || []
	};

	normalizeFiles(state.poolFiles);
	normalizeFiles(state.activeFiles);
	
	render();
	initSortable();
	
	if(options.allowUpload)
		initUpload();
	else
		uploadButton.remove();
	
	bindEvents();
	
	{customScript}
	
	function normalizeFiles(files) {
		if(!files || !files.length)
			return;

		for (let i = 0; i < files.length; i++) {
			files[i].readonly = readonly;
			files[i].entityType = '{entityType}';
		}
	}
	
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
	
	function initUpload() {
		const uploadComponent = uploadInput.kendoUpload({
			async: {
				saveUrl: `${window.dynamicItems.settings.wiserApiRoot}items/{itemIdEncrypted}/upload?propertyName=${encodeURIComponent(options.activePropertyName)}&itemLinkId={itemLinkId}&entityType=${encodeURIComponent(options.entityType)}`,
				withCredentials: false
			},
			multiple: true,
			showFileList: false,
			upload: event => {
				const xhr = event.XMLHttpRequest;
				if (xhr) {
					xhr.addEventListener('readystatechange', () => {
						if (xhr.readyState === 1) {
							xhr.setRequestHeader(
								'authorization',
								`Bearer ${localStorage.getItem('accessToken')}`
							);
						}
					});
				}
			},
			success: async event => {
				const uploadedFiles = event.response;

				normalizeFiles(uploadedFiles);
				
				for (const file of uploadedFiles) {
					state.activeFiles.push({
						...file,
						listType: 'active'
					});
				}

				render();
				await save();
			},
			error: window.dynamicItems.fields.onFileUploadError.bind(window.dynamicItems.fields)
		}).data('kendoUpload');
		
		uploadInput.closest('.k-upload').hide();
		
		uploadButton.on('click', () => {
			uploadComponent.wrapper.find(".k-upload-button").trigger("click");
		});
	}

	async function save() {
		try {
			state.activeFiles = await Wiser.api({
				url: `${dynamicItems.settings.wiserApiRoot}items/${encodeURIComponent('{itemIdEncrypted}')}/image-curator/{propertyId}`,
				dataType: 'json',
				method: 'PUT',
				contentType: 'application/json',
				data: JSON.stringify({
					files: JSON.parse(hiddenInput.val())
				})
			});

			render();
		} catch(exception) {
			console.error(exception);
			kendo.alert(`Niet in staat om de aanpassing op te slaan. Probeer later opnieuw.`);
		}
	}
})();