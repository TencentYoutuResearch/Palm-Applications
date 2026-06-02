import { defineStore } from 'pinia';
import { ref, computed, watch } from 'vue';

export interface UserInfo {
  userId: string;
  userName: string;
  tenantName?: string;
  /** 服务端在刷掌登录成功时下发的身份 token；提交分数等计分接口使用 */
  token?: string;
}

const STORAGE_KEY = 'palmRacer_user';

interface PersistedUser {
  userId: string;
  userName: string;
  tenantName: string;
  token: string;
}

/** Load persisted user from localStorage. */
function loadUser(): PersistedUser {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      return {
        userId: parsed.userId ?? '',
        userName: parsed.userName ?? '',
        tenantName: parsed.tenantName ?? '',
        token: parsed.token ?? '',
      };
    }
  } catch { /* ignore */ }
  return { userId: '', userName: '', tenantName: '', token: '' };
}

export const useUserStore = defineStore('user', () => {
  const saved = loadUser();
  const userId = ref(saved.userId);
  const userName = ref(saved.userName);
  const tenantName = ref(saved.tenantName);
  /** 身份 token：刷掌登录成功后由服务端下发，用于计分相关接口的 Bearer 鉴权。 */
  const token = ref(saved.token);
  const cheatCount = ref(0);
  const isGuest = ref(false);

  const isLoggedIn = computed(() => !!userId.value || isGuest.value);

  // Persist to localStorage on change
  function persist(): void {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({
      userId: userId.value,
      userName: userName.value,
      tenantName: tenantName.value,
      token: token.value,
    }));
  }

  watch([userId, userName, tenantName, token], persist);

  function login(user: UserInfo): void {
    userId.value = user.userId;
    userName.value = user.userName;
    tenantName.value = user.tenantName ?? '';
    token.value = user.token ?? '';
    cheatCount.value = 0;
    isGuest.value = false;
  }

  /** 游客模式登录，不需要注册和刷掌（也不签发 token） */
  function guestLogin(): void {
    userId.value = '';
    userName.value = '游客';
    tenantName.value = '';
    token.value = '';
    cheatCount.value = 0;
    isGuest.value = true;
  }

  function logout(): void {
    userId.value = '';
    userName.value = '';
    tenantName.value = '';
    token.value = '';
    cheatCount.value = 0;
    isGuest.value = false;
    localStorage.removeItem(STORAGE_KEY);
  }

  function incrementCheat(): void {
    cheatCount.value++;
  }

  return {
    userId,
    userName,
    tenantName,
    token,
    cheatCount,
    isGuest,
    isLoggedIn,
    login,
    guestLogin,
    logout,
    incrementCheat,
  };
});
