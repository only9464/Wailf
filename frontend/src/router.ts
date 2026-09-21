import { createRouter, createWebHashHistory } from 'vue-router'
import { features } from './features/registry'

export const router = createRouter({
  history: createWebHashHistory(),
  routes: [
    { path: '/', redirect: '/settings' },
    ...features.map((feature) => ({
      path: feature.route,
      name: feature.id,
      meta: { titleKey: feature.nameKey },
      component:
        feature.id === 'portscan'
          ? () => import('./views/recon/PortScanView.vue')
          : () => import('./views/shared/PlannedView.vue'),
    })),
    {
      path: '/settings',
      name: 'settings',
      component: () => import('./views/settings/SettingsView.vue'),
      meta: { titleKey: 'app.settings' },
    },
    {
      path: '/jobs/:jobId',
      name: 'job-detail',
      component: () => import('./views/jobs/JobDetailView.vue'),
      meta: { titleKey: 'app.tasks' },
    },
    { path: '/:pathMatch(.*)*', redirect: '/settings' },
  ],
})
