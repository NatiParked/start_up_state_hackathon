import { createApp } from 'vue'
import { createPinia } from 'pinia'
import OpenLayersMap from 'vue3-openlayers'
import 'vue3-openlayers/vue3-openlayers.css'

import App from './App.vue'
import router from './router'
import './styles/brand.css'

const app = createApp(App)

app.use(createPinia())
app.use(router)
app.use(OpenLayersMap)

app.mount('#app')
