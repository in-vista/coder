import { defineConfig } from 'vite';
import { resolve } from 'path';
import manifestSRI from 'vite-plugin-manifest-sri';
import { createHtmlPlugin } from 'vite-plugin-html';
import nodePolyfills from 'rollup-plugin-polyfill-node';

export default defineConfig({
    root: './Core/Scripts',
    build: {
        outDir: '../../wwwroot/scripts',
        emptyOutDir: true,
        rollupOptions: {
            input: {
                main: resolve(__dirname, 'Core/Scripts/main.js'),
                Utils: resolve(__dirname, 'Modules/Base/Scripts/Utils.js'),
                Processing: resolve(__dirname, 'Modules/Base/Scripts/Processing.js'),
                DynamicItems: resolve(__dirname, 'Modules/DynamicItems/Scripts/DynamicItems.js'),
                Fields: resolve(__dirname, 'Modules/DynamicItems/Scripts/Fields.js'),
                Dialogs: resolve(__dirname, 'Modules/DynamicItems/Scripts/Dialogs.js'),
                Windows: resolve(__dirname, 'Modules/DynamicItems/Scripts/Windows.js'),
                Grids: resolve(__dirname, 'Modules/DynamicItems/Scripts/Grids.js'),
                DragAndDrop: resolve(__dirname, 'Modules/DynamicItems/Scripts/DragAndDrop.js'),
                Search: resolve(__dirname, 'Modules/Search/Scripts/Search.js'),
                Import: resolve(__dirname, 'Modules/ImportExport/Scripts/Import.js'),
                Export: resolve(__dirname, 'Modules/ImportExport/Scripts/Export.js'),
                ImportExport: resolve(__dirname, 'Modules/ImportExport/Scripts/ImportExport.js'),
                RemoveItems: resolve(__dirname, 'Modules/ImportExport/Scripts/RemoveItems.js'),
                RemoveConnections: resolve(__dirname, 'Modules/ImportExport/Scripts/RemoveConnections.js'),
                TaskAlerts: resolve(__dirname, 'Modules/TaskAlerts/Scripts/TaskAlerts.js'),
                TaskHistory: resolve(__dirname, 'Modules/TaskAlerts/Scripts/TaskHistory.js'),
                DataSelector: resolve(__dirname, 'Modules/DataSelector/Scripts/DataSelector.js'),
                DataSelectorDataLoad: resolve(__dirname, 'Modules/DataSelector/Scripts/DataLoad.js'),
                DataSelectorConnection: resolve(__dirname, 'Modules/DataSelector/Scripts/Connection.js'),
                ContentBuilder: resolve(__dirname, 'Modules/ContentBuilder/Scripts/main.js'),
                ContentBox: resolve(__dirname, 'Modules/ContentBox/Scripts/main.js'),
                WtsConfiguration: resolve(__dirname, 'Modules/Templates/Scripts/WtsConfiguration.js'),
                Templates: resolve(__dirname, 'Modules/Templates/Scripts/Templates.js'),
                DynamicContent: resolve(__dirname, 'Modules/Templates/Scripts/DynamicContent.js'),
                Admin: resolve(__dirname, 'Modules/Admin/Scripts/Admin.js'),
                Dashboard: resolve(__dirname, 'Modules/Dashboard/Scripts/Dashboard.js'),
                Base: resolve(__dirname, 'Modules/Base/Scripts/Base.js'),
                VersionControl: resolve(__dirname, 'Modules/VersionControl/Scripts/VersionControl.js'),
                CommunicationIndex: resolve(__dirname, 'Modules/Communication/Scripts/Index.js'),
                CommunicationSettings: resolve(__dirname, 'Modules/Communication/Scripts/Settings.js'),
                FileManager: resolve(__dirname, 'Modules/FileManager/Scripts/FileManager.js'),
                Configuration: resolve(__dirname, 'Modules/Configuration/Scripts/Configuration.js')
            },
            output: {
                entryFileNames: '[name].[hash].min.js',
                chunkFileNames: '[name].[hash].min.js',
                assetFileNames: '[name].[hash][extname]'
            }
        },
        manifest: true
    },
    resolve: {
        alias: {
            '@progress/kendo-ui': resolve(__dirname, 'node_modules/@progress/kendo-ui')
        }
    },
    css: {
        preprocessorOptions: {
            scss: { }
        }
    },
    plugins: [
        manifestSRI(),
        createHtmlPlugin(),
        nodePolyfills()
    ]
});