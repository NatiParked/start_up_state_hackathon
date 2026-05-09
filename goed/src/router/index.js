import { createRouter, createWebHistory } from 'vue-router'
import { adminGuard } from './guards'

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
      component: () => import('@/views/SubmitView.vue'),
    },
    {
      path: '/admin/login',
      name: 'AdminLogin',
      component: () => import('@/views/admin/AdminLogin.vue'),
    },
    {
      path: '/admin',
      redirect: '/admin/dashboard',
    },
    {
      path: '/admin/dashboard',
      name: 'AdminDashboard',
      component: () => import('@/views/admin/AdminDashboard.vue'),
      beforeEnter: adminGuard,
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
