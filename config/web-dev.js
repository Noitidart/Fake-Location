const CopyWebpackPlugin = require('copy-webpack-plugin');
const path = require('path');
const webpack = require('webpack');

module.exports = function (env) {
    return {
        devtool: 'eval',
        entry: ['./src/web/index.js'],
        output: {
            path: path.join(__dirname, '../dist/web'),
            filename: 'index.bundle.js',
            publicPath: '/static/'
        },
        resolve: {
            extensions: ['.js']
        },
        module: {
            loaders: [
                { test:/\.js$/, exclude:/node_modules/, loader:'eslint-loader', enforce:'pre' },
                { test:/\.css$/, exclude:/node_modules/, use:['style-loader', 'css-loader'] },
                { test:/\.js$/, exclude:/node_modules/, loader:'babel-loader' }
            ]
        },
        plugins: [
            new CopyWebpackPlugin([
                { from:'./src/web' }
            ], {
                ignore: ['*.js']
            })
        ]
    }
}