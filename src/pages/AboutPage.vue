<template>
  <q-page class="about-page q-pa-lg">
    <div class="about-wrap">
      <!-- ── Hero ──────────────────────────────────────────────────── -->
      <div class="about-hero q-mb-xl">
        <div class="about-wordmark">VerseSense</div>
        <p class="about-tagline">{{ $t('about.tagline') }}</p>
        <p class="about-intro">{{ $t('about.intro') }}</p>
      </div>

      <!-- ── Demo notice ─────────────────────────────────────────────── -->
      <q-banner class="demo-notice q-mb-xl" rounded>
        <template #avatar>
          <q-icon name="science" size="28px" color="amber-4" />
        </template>
        <div class="demo-notice__title">{{ $t('about.demoTitle') }}</div>
        <div class="demo-notice__body">{{ $t('about.demoText') }}</div>
      </q-banner>

      <!-- ── Features ──────────────────────────────────────────────── -->
      <q-card class="about-card q-mb-lg" flat bordered>
        <q-card-section>
          <div class="text-h6 q-mb-md">{{ $t('about.featuresTitle') }}</div>
          <q-list separator>
            <q-item class="q-py-sm">
              <q-item-section side top
                ><q-icon name="check_circle" color="positive"
              /></q-item-section>
              <q-item-section>{{ $t('about.feat1') }}</q-item-section>
            </q-item>
            <q-item class="q-py-sm">
              <q-item-section side top
                ><q-icon name="check_circle" color="positive"
              /></q-item-section>
              <q-item-section>{{ $t('about.feat2') }}</q-item-section>
            </q-item>
            <q-item class="q-py-sm">
              <q-item-section side top
                ><q-icon name="check_circle" color="positive"
              /></q-item-section>
              <q-item-section>{{ $t('about.feat3') }}</q-item-section>
            </q-item>
            <q-item class="q-py-sm">
              <q-item-section side top
                ><q-icon name="check_circle" color="positive"
              /></q-item-section>
              <q-item-section>{{ $t('about.feat4') }}</q-item-section>
            </q-item>
            <q-item class="q-py-sm">
              <q-item-section side top
                ><q-icon name="check_circle" color="positive"
              /></q-item-section>
              <q-item-section>{{ $t('about.feat5') }}</q-item-section>
            </q-item>
            <q-item class="q-py-sm">
              <q-item-section side top
                ><q-icon name="check_circle" color="positive"
              /></q-item-section>
              <q-item-section>{{ $t('about.feat6') }}</q-item-section>
            </q-item>
            <q-item class="q-py-sm">
              <q-item-section side top
                ><q-icon name="check_circle" color="positive"
              /></q-item-section>
              <q-item-section>{{ $t('about.feat7') }}</q-item-section>
            </q-item>
            <q-item class="q-py-sm">
              <q-item-section side top
                ><q-icon name="check_circle" color="positive"
              /></q-item-section>
              <q-item-section>{{ $t('about.feat8') }}</q-item-section>
            </q-item>
          </q-list>
        </q-card-section>
      </q-card>

      <!-- ── Tech stack ─────────────────────────────────────────────── -->
      <q-card class="about-card q-mb-lg" flat bordered>
        <q-card-section>
          <div class="text-h6 q-mb-md">{{ $t('about.techTitle') }}</div>
          <div class="tech-row">
            <q-chip color="teal-9" text-color="white" icon="widgets" label="Vue 3" />
            <q-chip color="primary" text-color="white" icon="layers" label="Quasar Framework" />
            <q-chip color="blue-8" text-color="white" icon="code" label="TypeScript" />
            <q-chip color="deep-purple-9" text-color="white" icon="bolt" label="Vite" />
            <q-chip color="amber-8" text-color="white" icon="store" label="Pinia" />
            <q-chip color="blue-grey-7" text-color="white" icon="edit_note" label="CodeMirror 6" />
            <q-chip color="orange-9" text-color="white" icon="memory" label="ONNX Runtime Web" />
            <q-chip color="green-9" text-color="white" icon="book" label="ua-word-stress" />
            <q-chip color="blue-9" text-color="white" icon="psychology" label="Luscinia ML" />
            <q-chip color="indigo-8" text-color="white" icon="translate" label="vue-i18n" />
            <q-chip color="teal-8" text-color="white" icon="cloud" label="Netlify" />
          </div>
        </q-card-section>
      </q-card>

      <!-- ── ua-stress-engine subproject ───────────────────────────── -->
      <q-card class="about-card about-card--accent q-mb-lg" flat bordered>
        <q-card-section>
          <div class="text-h6 q-mb-sm">{{ $t('about.stressTitle') }}</div>
          <p class="text-body2 about-source-text">
            {{ $t('about.stressText', { mlModel: mlModelId }) }}
          </p>
          <q-btn
            flat
            no-caps
            color="amber-6"
            icon="open_in_new"
            :label="$t('about.stressLink')"
            href="https://github.com/Tilitronic/ua-stress-engine"
            target="_blank"
            rel="noopener noreferrer"
            type="a"
          />
        </q-card-section>
      </q-card>

      <!-- ── Open source ─────────────────────────────────────────────── -->
      <q-card class="about-card q-mb-xl" flat bordered>
        <q-card-section>
          <div class="text-h6 q-mb-sm">{{ $t('about.sourceTitle') }}</div>
          <p class="text-body2 about-source-text">{{ $t('about.sourceText') }}</p>
          <q-btn
            flat
            no-caps
            color="primary"
            icon="open_in_new"
            :label="$t('about.sourceLink')"
            href="https://github.com/Tilitronic/VerseSenseFrontendWebApp"
            target="_blank"
            rel="noopener noreferrer"
            type="a"
          />
        </q-card-section>
      </q-card>

      <!-- ── Back ─────────────────────────────────────────────────────── -->
      <q-btn
        color="primary"
        icon="arrow_back"
        :label="$t('about.backBtn')"
        @click="$router.push('/')"
      />
    </div>
  </q-page>
</template>

<script setup lang="ts">
import { ML_MODEL_ID as mlModelId } from 'src/constants/stressEngineInfo';
// $t is globally available via vue-i18n globalInjection: true
// $router is globally available via vue-router
</script>

<style scoped lang="scss">
.about-page {
  min-height: 100%;
  background: #12121c;
  color: #e0e0e0;
}

.about-wrap {
  max-width: 720px;
  margin: 0 auto;
  padding: 2rem 1rem 4rem;
}

// ── Hero ─────────────────────────────────────────────────────────────────────
.about-wordmark {
  font-size: 2.6rem;
  font-weight: 800;
  letter-spacing: -0.02em;
  color: #fff;
  margin-bottom: 0.3rem;
}

.about-tagline {
  font-size: 1.05rem;
  color: var(--q-primary);
  font-weight: 500;
  margin-bottom: 1rem;
}

.about-intro {
  font-size: 0.9rem;
  color: rgba(255, 255, 255, 0.58);
  line-height: 1.65;
  margin: 0;
}

// ── Cards ─────────────────────────────────────────────────────────────────────
.about-card {
  background: rgba(255, 255, 255, 0.03);
  border-color: rgba(255, 255, 255, 0.08) !important;
}

// ── Demo notice ───────────────────────────────────────────────────────────────
.demo-notice {
  background: rgba(255, 180, 0, 0.08);
  border: 1px solid rgba(255, 180, 0, 0.3);
  color: #e0e0e0;

  &__title {
    font-size: 1rem;
    font-weight: 700;
    color: #ffd740;
    margin-bottom: 6px;
  }

  &__body {
    font-size: 0.85rem;
    line-height: 1.65;
    color: rgba(255, 255, 255, 0.65);
  }
}

.about-source-text {
  color: rgba(255, 255, 255, 0.55);
  margin-bottom: 12px;
}

// ── Tech chip row ─────────────────────────────────────────────────────────────
.tech-row {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}
</style>

<style scoped>
.about-container {
  max-width: 600px;
  padding: 2rem;
  text-align: center;
}

h1 {
  font-size: 2.5rem;
  margin-bottom: 1rem;
  color: #1976d2;
}

h2 {
  font-size: 1.5rem;
  margin-top: 1.5rem;
  margin-bottom: 1rem;
  color: #333;
}

p {
  font-size: 1rem;
  color: #666;
  line-height: 1.6;
  margin-bottom: 1.5rem;
}

ul {
  text-align: left;
  display: inline-block;
  margin-bottom: 2rem;
}

li {
  margin: 0.5rem 0;
  color: #555;
}
</style>
