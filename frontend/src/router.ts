import { createRouter, createWebHashHistory } from 'vue-router'
import { features } from './features/registry'

export const router = createRouter({
  history: createWebHashHistory(),
  routes: [
    { path: '/', redirect: '/recon/portscan' },
    ...features.map((feature) => ({
      path: feature.route,
      name: feature.id,
      meta: { titleKey: feature.nameKey },
      component:
        feature.id === 'portscan'
          ? () => import('./views/PortScanView.vue')
          : () => import('./views/PlannedView.vue'),
    })),
    {
      path: '/settings',
      name: 'settings',
      component: () => import('./views/SettingsView.vue'),
      meta: { titleKey: 'app.settings' },
    },
    {
      path: '/jobs/:jobId',
      name: 'job-detail',
      component: () => import('./views/JobDetailView.vue'),
      meta: { titleKey: 'app.tasks' },
    },
    { path: '/:pathMatch(.*)*', redirect: '/recon/portscan' },
  ],
})
