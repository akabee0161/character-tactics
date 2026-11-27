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
    // 遅いテスト（*.slow.test.ts。ステージ全部を遊ばせる。約 20 分）は `npm test` では流さず、`npm run test:full`（FULL=1）と本番反映の CI が流す
    exclude: [...configDefaults.exclude, '.claude/**', ...(process.env.FULL ? [] : ['**/*.slow.test.ts'])],
  },
});
