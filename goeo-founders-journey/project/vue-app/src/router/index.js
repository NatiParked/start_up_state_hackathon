import { createRouter, createWebHistory } from 'vue-router'
import Landing from '../views/Landing.vue'
import Quiz from '../views/Quiz.vue'
import Results from '../views/Results.vue'
import ResourceDetail from '../views/ResourceDetail.vue'
import Submit from '../views/Submit.vue'

const routes = [
  { path: '/', name: 'landing', component: Landing },
  { path: '/quiz', name: 'quiz', component: Quiz },
  { path: '/results', name: 'results', component: Results },
  { path: '/resource/:id', name: 'detail', component: ResourceDetail, props: true },
  { path: '/submit', name: 'submit', component: Submit },
]

export default createRouter({
  history: createWebHistory(),
  routes,
  scrollBehavior() { return { top: 0 } },
})
