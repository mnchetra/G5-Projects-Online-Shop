<script setup lang="ts">
import { ref } from 'vue';
import { X } from 'lucide-vue-next';

const props = defineProps<{ modelValue: File[]; locale: string }>();
const emit = defineEmits<{ (event: 'update:modelValue', files: File[]): void }>();
const error = ref('');
const maxFiles = 3;
const maxFileSize = 10 * 1024 * 1024;
const allowedTypes = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/gif',
  'video/mp4',
  'video/webm',
  'video/quicktime'
]);

function addFiles(event: Event) {
  const input = event.target as HTMLInputElement;
  const incoming = Array.from(input.files || []);
  const files = [...props.modelValue, ...incoming];
  error.value = '';
  input.value = '';

  if (files.length > maxFiles) {
    error.value = props.locale === 'km' ? 'អាចភ្ជាប់ឯកសារបានច្រើនបំផុត ៣។' : 'Attach up to 3 files.';
    return;
  }
  if (files.some((file) => file.size > maxFileSize)) {
    error.value = props.locale === 'km' ? 'ឯកសារនីមួយៗមិនអាចលើស ១០ MB។' : 'Each file must be 10 MB or less.';
    return;
  }
  if (files.some((file) => file.type && !allowedTypes.has(file.type))) {
    error.value = props.locale === 'km' ? 'ជ្រើសរើសតែរូបភាព ឬវីដេអូដែលគាំទ្រ។' : 'Choose a supported image or video file.';
    return;
  }
  emit('update:modelValue', files);
}

function removeFile(index: number) {
  emit('update:modelValue', props.modelValue.filter((_file, fileIndex) => fileIndex !== index));
  error.value = '';
}
</script>

<template>
  <div class="evidence-uploader">
    <label class="form-field">
      <span>{{ locale === 'km' ? 'ភ្ជាប់រូបភាព ឬវីដេអូជាភស្តុតាង (ស្រេចចិត្ត)' : 'Attach image or video evidence (optional)' }}</span>
      <input
        type="file"
        accept="image/jpeg,image/png,image/webp,image/gif,video/mp4,video/webm,video/quicktime"
        multiple
        @change="addFiles"
      />
      <small>{{ locale === 'km' ? 'រហូតដល់ ៣ ឯកសារ; មួយឯកសារមិនលើស ១០ MB។' : 'Up to 3 files; 10 MB maximum each.' }}</small>
    </label>
    <p v-if="error" class="evidence-upload-error" role="alert">{{ error }}</p>
    <ul v-if="modelValue.length" class="evidence-selected">
      <li v-for="(file, index) in modelValue" :key="`${file.name}-${file.lastModified}-${index}`">
        <span>{{ file.name }} ({{ (file.size / (1024 * 1024)).toFixed(1) }} MB)</span>
        <button type="button" :aria-label="locale === 'km' ? 'ដកឯកសារ' : 'Remove file'" @click="removeFile(index)">
          <X :size="14" />
        </button>
      </li>
    </ul>
  </div>
</template>

<style scoped>
.evidence-selected { display: grid; gap: 5px; margin: 8px 0 0; padding: 0; list-style: none; }
.evidence-selected li { display: flex; align-items: center; justify-content: space-between; gap: 8px; overflow-wrap: anywhere; font-size: 12px; }
.evidence-selected button { display: inline-flex; flex: 0 0 auto; align-items: center; justify-content: center; border: 0; background: transparent; cursor: pointer; }
.evidence-upload-error { margin: 5px 0 0; color: #b92b27; font-size: 12px; }
</style>
