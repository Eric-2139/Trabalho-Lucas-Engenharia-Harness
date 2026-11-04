import react from '@vitejs/plugin-react';
import { defineConfig, mergeConfig } from 'vite';
import { configuracaoComum } from '../../infra/vite/comum.ts';

export default mergeConfig(configuracaoComum(5174), defineConfig({ plugins: [react()] }));
