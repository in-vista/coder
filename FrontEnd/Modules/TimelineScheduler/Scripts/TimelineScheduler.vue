<template>
  <div>
    <LocalizationProvider :language="'nl-NL'">
      <IntlProvider :locale="'nl'">
        <Scheduler
            v-if="resources.length"
            ref="schedulerRef"
            :style="{ height: '100%' }"
            :data-items="dataItems"
            :default-date="displayDate"
            :view="view"
            :views="views"
            :group="group"
            :resources="resources"
            :key="resources[0]?.data?.length"
            :editable="true"
            @datachange="handleDataChange"
        />
      </IntlProvider>
    </LocalizationProvider>
  </div>
</template>

<script setup>
//import UsersService from "../../../Core/Scripts/shared/users.service";
//import ModulesService from "../../../Core/Scripts/shared/modules.service";
//import TenantsService from "../../../Core/Scripts/shared/tenants.service";
//import ItemsService from "../../../Core/Scripts/shared/items.service";
//import axios from "axios";
//import {AUTH_LOGOUT, AUTH_REQUEST} from "../../../Core/Scripts/store/mutation-types";
//import store from "../../../Core/Scripts/store";
import {Wiser} from "../../Base/Scripts/Utils.js";
import { ref, onMounted, nextTick, inject } from 'vue';
import { Scheduler } from '@progress/kendo-vue-scheduler';
import {
  IntlProvider,
  load,
  LocalizationProvider,
  loadMessages,
} from '@progress/kendo-vue-intl';
import likelySubtags from 'cldr-core/supplemental/likelySubtags.json';
import currencyData from 'cldr-core/supplemental/currencyData.json';
import weekData from 'cldr-core/supplemental/weekData.json';
import numbers from 'cldr-numbers-full/main/nl/numbers.json';
import currencies from 'cldr-numbers-full/main/nl/currencies.json';
import caGregorian from 'cldr-dates-full/main/nl/ca-gregorian.json';
import dateFields from 'cldr-dates-full/main/nl/dateFields.json';
import timeZoneNames from 'cldr-dates-full/main/nl/timeZoneNames.json';
import nlMessages from './nl.json';

load(
    likelySubtags,
    currencyData,
    weekData,
    numbers,
    currencies,
    caGregorian,
    dateFields,
    timeZoneNames
);
loadMessages(nlMessages, 'nl-NL');

const appSettings = inject('appSettings');
const schedulerRef = ref(null);
const displayDate = new Date();
const dataItems = ref([]);
const view = ref('timeline');
const views = ref([
  {
    name: 'timeline',
    title: 'Dag',
    columnWidth: 25,
    slotDuration: 60,
    slotDivisions: 4,
    numberOfDays: 1,
    workDayStart: '11:00',
    workDayEnd: '20:30',
    startTime: '00:00',
    endTime: '00:00',
    showWorkHours: false    
  }
]);

const group = ref({
  resources: ['Tables'],
  orientation: 'vertical',
});
const resources = ref([]);

onMounted(async () => {
  // Haal resources op  
  await Wiser.api({
    url: appSettings.apiRoot + "items/" + encodeURIComponent(appSettings.zeroEncrypted) + "/action-button/0?queryId=" + encodeURIComponent(appSettings.resourcesQueryId),
    contentType: "application/json",
    dataType: "json",
    method: "POST",
    data: '{"start_date": "","end_date": ""}'
  }).then((result) => {
    resources.value = [
      {
        name: 'Tables',
        field: 'tableId',
        valueField: 'value',
        textField: 'text',
        colorField: 'color',
        data: result.otherData
      }
    ];
  }).catch((result) => {
    console.log('Error bij ophalen resources voor timeline scheduler:', result);
  });
 
  const test = new Date();
  dataItems.value = [
    {
      id: 1,
      start: new Date(test.getFullYear(), test.getMonth(), test.getDate(), 9, 0, 0),
      end: new Date(test.getFullYear(), test.getMonth(), test.getDate(), 11, 0, 0),
      title: 'John Doe',
      tableId: 14372
    },
    {
      id: 1,
      start: new Date(test.getFullYear(), test.getMonth(), test.getDate(), 14, 0, 0),
      end: new Date(test.getFullYear(), test.getMonth(), test.getDate(), 17, 0, 0),
      title: 'Test persoon',
      tableId: 14701
    }
  ];
  
  // Wacht tot de DOM helemaal klaar is
  await nextTick();

  const schedulerEl = schedulerRef.value?.$el;
  if (!schedulerEl) {
    console.error('Scheduler DOM niet gevonden');
    return;
  }

  // Dubbel klik op slots
  const slots = schedulerEl.querySelectorAll('.k-slot-cell');

  if (slots.length === 0) {
    console.warn('Geen slots gevonden in scheduler');
    return;
  }

  slots.forEach(slot => {
    slot.addEventListener('dblclick', e => {
      e.stopPropagation();
      alert(`Dubbelklik op een slot, start ${slot.dataset.slotStart}, end ${slot.dataset.slotEnd}, rowindex ${slot.dataset.slotGroup}`);
    });
  });

  console.log(`${slots.length} slot(s) gevonden en dblclick-listener toegevoegd`);
});

function handleDataChange({ created, updated, deleted }) {
  /*const newData = [...dataItems.value]
      .filter(
          (item) =>
              deleted.find((current) => current.id === item.id) === undefined
      )
      .map(
          (item) =>
              updated.find((current) => current.id === item.id) || item
      )
      .concat(
          created.map((item) =>
              Object.assign({}, item, {
                id: guid(),
              })
          )
      );

  sampleData.value = newData;*/
  alert('Todo: Handle data change function');
}

</script>

<style>
body {
  font-family: Arial, sans-serif;
  margin: 0;
  padding: 0;
}
.app {
  padding: 20px;
}
</style>