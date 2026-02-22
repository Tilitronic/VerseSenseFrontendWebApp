import { defineBoot } from '#q-app/wrappers';
import { install as installVueCodemirror } from 'vue-codemirror';

export default defineBoot(({ app }) => {
  app.use(installVueCodemirror, {
    // Global defaults — overridden per-instance via props/extensions
    extensions: [],
  });
});
