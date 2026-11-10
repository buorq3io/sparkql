import { defineConfig } from 'tsdown';

export default defineConfig({
  entry: {
    index: 'src/index.ts',
    arq: 'src/arq/index.ts',
    stardog: 'src/stardog/index.ts',
  },
  format: ['cjs', 'esm'],
  unbundle: true,
  platform: 'node',
  target: 'node20',
  tsconfig: 'tsconfig.build.json',
  sourcemap: true,
  dts: true,
  clean: true,
  fixedExtension: true,
});
