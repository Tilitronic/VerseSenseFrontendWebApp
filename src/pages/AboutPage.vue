<template>
  <q-page class="row items-center justify-center">
    <div class="about-container">
      <h1>About VerseSense</h1>
      <p>
        VerseSense is a sophisticated poetry analysis engine designed to help you understand and
        explore the depths of poetic expression.
      </p>
      <h2>Features</h2>
      <ul>
        <li>Advanced verse analysis</li>
        <li>Meter and rhyme detection</li>
        <li>Semantic analysis</li>
        <li>Historical context</li>
      </ul>
      <q-btn label="Back to Main" color="primary" @click="navigateTo('/')" />
    </div>
  </q-page>
</template>

<script setup lang="ts">
import { useRouter } from 'vue-router';

const router = useRouter();

function navigateTo(path: string) {
  void router.push(path);
}
</script>

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
