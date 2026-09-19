// @ts-check
import withNuxt from './.nuxt/eslint.config.mjs'

export default withNuxt(
  // Reglas de casa: el motor es un artefacto auditado y debe seguir
  // legible como prosa; nada de líneas de 300 caracteres ni imports
  // desnivelados. El resto, lo que @nuxt/eslint trae.
  {
    rules: {
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
      'vue/max-attributes-per-line': 'off',
      'vue/singleline-html-element-content-newline': 'off',
    },
  },
  {
    ignores: ['**/.output/**', '**/.nuxt/**', '**/.data/**', 'motor.js', 'docs/auditoria/**'],
  },
)
