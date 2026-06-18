<template>
  <div class="countdown-overlay" v-if="visible">
    <div class="countdown-text" :class="textClass" :key="display">
      {{ display }}
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue';

const emit = defineEmits<{ complete: [] }>();

const visible = ref(true);
const display = ref('3');
const textClass = ref('');

onMounted(() => {
  // Show 3 immediately (already set)
  let count = 3;

  const tick = () => {
    count--;
    if (count > 0) {
      display.value = String(count);
      textClass.value = '';
      setTimeout(tick, 800);
    } else if (count === 0) {
      display.value = 'GO!';
      textClass.value = 'go';
      setTimeout(() => {
        visible.value = false;
        emit('complete');
      }, 600);
    }
  };

  setTimeout(tick, 800);
});
</script>

<style scoped lang="scss">
@use '@/assets/styles/variables' as *;

.countdown-overlay {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(0, 0, 0, 0.5);
  z-index: 200;
}

.countdown-text {
  font-size: 96px;
  font-weight: 900;
  color: $color-primary;
  text-shadow: 0 0 40px rgba($color-primary, 0.8);
  animation: countPulse 0.5s ease-out;

  &.go {
    color: #00ff88;
    text-shadow: 0 0 60px rgba(0, 255, 136, 0.6);
  }
}

@keyframes countPulse {
  0% { transform: scale(2); opacity: 0; }
  60% { transform: scale(1); opacity: 1; }
  100% { transform: scale(0.95); opacity: 1; }
}
</style>
