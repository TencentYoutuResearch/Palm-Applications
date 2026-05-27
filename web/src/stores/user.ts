import { defineStore } from 'pinia';
import { ref, computed, watch } from 'vue';

export interface UserInfo {
  userId: string;
  userName: string;
  tenantName?: string;
}

const STORAGE_KEY = 'palmRacer_user';

/** Load persisted user from localStorage. */
function loadUser(): { userId: string; userName: string; tenantName: string } {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return JSON.parse(raw);
  } catch { /* ignore */ }
  return { userId: '', userName: '', tenantName: '' };
}

export const useUserStore = defineStore('user', () => {
  const saved = loadUser();
  const userId = ref(saved.userId);
  const userName = ref(saved.userName);
  const tenantName = ref(saved.tenantName);
  const cheatCount = ref(0);

  const isLoggedIn = computed(() => !!userId.value);

  // Persist to localStorage on change
  function persist(): void {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({
      userId: userId.value,
      userName: userName.value,
      tenantName: tenantName.value,
    }));
  }

  watch([userId, userName, tenantName], persist);

  function login(user: UserInfo): void {
    userId.value = user.userId;
    userName.value = user.userName;
    tenantName.value = user.tenantName ?? '';
    cheatCount.value = 0;
  }

  function logout(): void {
    userId.value = '';
    userName.value = '';
    tenantName.value = '';
    cheatCount.value = 0;
    localStorage.removeItem(STORAGE_KEY);
  }

  function incrementCheat(): void {
    cheatCount.value++;
  }

  return {
    userId,
    userName,
    tenantName,
    cheatCount,
    isLoggedIn,
    login,
    logout,
    incrementCheat,
  };
});
