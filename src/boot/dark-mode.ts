import { defineBoot } from '#q-app/wrappers';
import { Dark } from 'quasar';
import { useAppStore } from 'stores/app';

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
