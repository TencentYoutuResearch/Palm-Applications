import { createRouter, createWebHashHistory } from 'vue-router';
import type { RouteRecordRaw } from 'vue-router';
import { useUserStore } from '@/stores/user';
import { getI18nT } from '@/main';

const routes: RouteRecordRaw[] = [
  {
    path: '/',
    redirect: '/login',
  },
  {
    path: '/login',
    name: 'Login',
    component: () => import('@/features/login/LoginPage.vue'),
    meta: { titleKey: 'route.login', guest: true },
  },
  {
    path: '/menu',
    name: 'Menu',
    component: () => import('@/features/menu/MenuPage.vue'),
    meta: { titleKey: 'route.menu', requiresAuth: true },
  },
  {
    path: '/game',
    name: 'Game',
    component: () => import('@/features/game/GamePage.vue'),
    meta: { titleKey: 'route.game', requiresAuth: true },
  },
  {
    path: '/gameover',
    name: 'GameOver',
    component: () => import('@/features/gameover/GameOverPage.vue'),
    meta: { titleKey: 'route.gameover', requiresAuth: true },
  },
  {
    path: '/leaderboard',
    name: 'Leaderboard',
    component: () => import('@/features/leaderboard/LeaderboardPage.vue'),
    meta: { titleKey: 'route.leaderboard' },
  },
  {
    path: '/settings',
    name: 'Settings',
    component: () => import('@/features/settings/SettingsPage.vue'),
    meta: { titleKey: 'route.settings' },
  },
  {
    path: '/register',
    name: 'Register',
    component: () => import('@/features/register/RegisterPage.vue'),
    meta: { titleKey: 'route.register', guest: true },
  },
  // APK 下载页面暂时屏蔽，待 COS/CDN 托管方案就绪后恢复
  // {
  //   path: '/download',
  //   name: 'Download',
  //   component: () => import('@/features/download/DownloadPage.vue'),
  //   meta: { titleKey: 'route.download', guest: true },
  // },
];

const router = createRouter({
  history: createWebHashHistory(),
  routes,
});

router.beforeEach((to) => {
  const userStore = useUserStore();

  // Logged-in user visiting login page → redirect to menu
  if (to.meta.guest && userStore.isLoggedIn) {
    return '/menu';
  }

  // Protected pages require login
  if (to.meta.requiresAuth && !userStore.isLoggedIn) {
    return '/login';
  }
});

router.afterEach((to) => {
  const titleKey = to.meta.titleKey as string | undefined;
  if (titleKey) {
    document.title = `${getI18nT()(titleKey)} - PalmRacer`;
  }
});

export default router;
