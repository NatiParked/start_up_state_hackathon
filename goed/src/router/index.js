import { createRouter, createWebHistory } from 'vue-router'

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [
    {
      path: '/',
      name: 'Map',
      component: () => import('@/views/MapView.vue'),
    },
    {
      path: '/navigator',
      name: 'Navigator',
      component: () => import('@/views/NavigatorView.vue'),
    },
    {
      path: '/submit',
      name: 'Submit',
      component: () => import('@/views/PlaceholderView.vue'),
      props: { title: 'Submit a Company' },
    },
    {
      path: '/admin',
      name: 'Admin',
      component: () => import('@/views/PlaceholderView.vue'),
      props: { title: 'Admin' },
    },
    {
      path: '/roadmap',
      name: 'Roadmap',
      component: () => import('@/views/PlaceholderView.vue'),
      props: { title: 'Roadmap' },
    },
    {
      path: '/subscribe',
      name: 'Subscribe',
      component: () => import('@/views/PlaceholderView.vue'),
      props: { title: 'Subscribe' },
    },
  ],
})

export default router
