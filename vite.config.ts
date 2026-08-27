import { defineConfig } from 'vite';
import { configDefaults } from 'vitest/config';

export default defineConfig({
  base: '/play/character-tactics/',
  build: {
    outDir: 'out/play/character-tactics',
    emptyOutDir: true,
  },
  test: {
    globals: true,
    environment: 'node',
    // .claude/ に古い worktree が残っていると、その中の src/**/*.test.ts まで
    // 拾って二重にテストが実行されてしまうため明示的に除外する
    exclude: [...configDefaults.exclude, '.claude/**'],
  },
});
