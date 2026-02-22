import { defineBoot } from '#q-app/wrappers';
import { Dark } from 'quasar';
import { useAppStore } from 'stores/app';

/**
 * Boot file for initializing app state from localStorage
 * Restores all persisted configurations on app startup
 */
export default defineBoot(() => {
  const appStore = useAppStore();

  // Apply the dark mode setting from store (which was initialized from localStorage)
  const darkModeSetting = appStore.darkMode;
  if (darkModeSetting === 'auto') {
    Dark.set('auto');
  } else if (darkModeSetting === 'on') {
    Dark.set(true);
  } else {
    Dark.set(false);
  }
});
