import { terser } from 'rollup-plugin-terser';
import postcss from 'rollup-plugin-postcss';
import fs from 'fs';
import * as pkg from './package.json'

fs.rmSync('dist', { recursive: true, force: true });

export default {
    input: 'src/index.js',
    output: [
        {
            file: 'dist/index.js',
            format: 'esm',
            sourcemap: true,
            banner: `/*!
 * simple-object-viewer v${pkg.version}
 * Copyright (c) Siyu1017 ${new Date().getFullYear()}
 */`
        },
        {
            file: 'dist/index.umd.js',
            format: 'umd',
            name: 'ObjectViewer',
            sourcemap: true,
            banner: `/*!
 * simple-object-viewer v${pkg.version}
 * Copyright (c) Siyu1017 ${new Date().getFullYear()}
 */`
        }
    ],
    plugins: [
        postcss({
            modules: true,
            extract: false,
            minimize: true
        }),
        terser()
    ]
};
