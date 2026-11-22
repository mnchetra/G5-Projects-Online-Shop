<script setup lang="ts">
import { api } from '../services/api';

type Evidence = {
  id: string;
  stage: 'CUSTOMER' | 'ADMIN' | 'SUPER_ADMIN';
  originalName: string;
  mimeType: string;
  fileSize: number;
  createdAt: string;
  uploader: { name: string };
};

const props = defineProps<{ orderNumber: string; evidence: Evidence[]; locale: string }>();

function fileUrl(id: string) {
  const baseUrl = (api.defaults.baseURL || '').replace(/\/$/, '');
  return `${baseUrl}/escrow/${encodeURIComponent(props.orderNumber)}/evidence/${encodeURIComponent(id)}`;
}

function stageLabel(stage: Evidence['stage']) {
  if (props.locale === 'km') {
    if (stage === 'CUSTOMER') return 'អតិថិជន';
    if (stage === 'ADMIN') return 'Admin';
    return 'Super Admin';
  }
  if (stage === 'CUSTOMER') return 'Customer';
  if (stage === 'ADMIN') return 'Store Admin';
  return 'Super Admin';
}

function isVideo(type: string) {
  return type.startsWith('video/');
}
</script>

<template>
  <section class="evidence-gallery" aria-label="Case evidence">
    <h4>{{ locale === 'km' ? 'ភស្តុតាងភ្ជាប់' : 'Case evidence' }}</h4>
    <div class="evidence-grid">
      <article v-for="item in evidence" :key="item.id" class="evidence-item">
        <a :href="fileUrl(item.id)" target="_blank" rel="noopener noreferrer" :title="item.originalName">
          <video v-if="isVideo(item.mimeType)" :crossorigin="'use-credentials'" controls preload="metadata">
            <source :src="fileUrl(item.id)" :type="item.mimeType" />
          </video>
          <img v-else :src="fileUrl(item.id)" :alt="item.originalName" :crossorigin="'use-credentials'" loading="lazy" />
        </a>
        <div class="evidence-caption">
          <strong>{{ item.originalName }}</strong>
          <small>{{ stageLabel(item.stage) }} · {{ item.uploader.name }} · {{ new Date(item.createdAt).toLocaleString() }}</small>
        </div>
      </article>
    </div>
  </section>
</template>

<style scoped>
.evidence-gallery { margin: 14px 0; }
.evidence-gallery h4 { margin: 0 0 9px; }
.evidence-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(150px, 1fr)); gap: 10px; }
.evidence-item { min-width: 0; border: 1px solid rgba(120, 120, 120, .25); border-radius: 8px; overflow: hidden; }
.evidence-item > a { display: block; background: #111; }
.evidence-item img, .evidence-item video { display: block; width: 100%; max-height: 180px; object-fit: contain; }
.evidence-caption { display: grid; gap: 3px; padding: 7px; overflow-wrap: anywhere; }
.evidence-caption strong { font-size: 12px; }
.evidence-caption small { font-size: 10px; opacity: .75; }
</style>
