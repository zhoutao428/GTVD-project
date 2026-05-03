const routes = [
  {
    path: '/',
    name: 'Home',
    component: () => import('@/views/Home.vue')
  },
  {
    path: '/video/:id?',
    name: 'Video',
    component: () => import('@/views/Video.vue')
  },
  {
    path: '/topics',
    name: 'Topics',
    component: () => import('@/views/Topics.vue')
  },
  {
    path: '/about',
    name: 'About',
    component: () => import('@/views/About.vue')
  }
]

export default routes
