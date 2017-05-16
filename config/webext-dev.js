const CopyWebpackPlugin = require('copy-webpack-plugin');
const fs = require('fs');
const path = require('path');
const webpack = require('webpack');

const PROPS = JSON.parse(fs.readFileSync('config/props.json', 'utf8')).webext;

deleteFolderRecursive('./dist/webext');

// copy browser-polyfill to src!! not to dist! as otherwise it `import '../common/browser-polyfill'` will fail
// fs.createReadStream('node_modules/webextension-polyfill/dist/browser-polyfill.js').pipe(fs.createWriteStream('src/webext/vendor/browser-polyfill.js');

module.exports = function (env) {
    return {
        devtool: 'cheap-module-source-map',
        entry: {
            background: './src/webext/background/index.js',
            app: './src/webext/app/index.js',
            contentscript: './src/webext/contentscript/index.js'
        },
        output: {
            path: path.join(__dirname, '../dist/webext'),
            filename: '[name]/index.bundle.js'
        },
        resolve: {
            extensions: ['.js']
        },
        module: {
            loaders: [
                { test:/\.js$/, exclude:/node_modules/, loader:'string-replace-loader', query:{ multiple:Object.entries(PROPS.replace).map(([search, replace]) => ({search, replace})) }, enforce:'pre' },
                { test:/\.js$/, exclude:/node_modules/, loader:'eslint-loader', enforce:'pre' },
                { test:/\.css$/, exclude:/node_modules/, use:['style-loader', 'css-loader'] },
                { test:/\.js$/, exclude:/node_modules/, loader:'babel-loader' }
            ]
        },
        plugins: [
            new CopyWebpackPlugin([
                { from: './src/webext', ignore: ['*.js', '*.css'], transform: (content, path) => /(svg|png|jpeg|jpg|gif)$/i.test(path) ? content : content.toString().replace(new RegExp('(?:' + Object.keys(PROPS.replace).join('|') + ')', 'g'), match => PROPS.replace[match]) },
                { from: './src/webext/vendor', to: 'vendor/' }
            ])
        ]
    }
}

// http://stackoverflow.com/a/32197381/1828637
function deleteFolderRecursive(path) {
  if( fs.existsSync(path) ) {
    fs.readdirSync(path).forEach(function(file,index){
      var curPath = path + "/" + file;
      if(fs.lstatSync(curPath).isDirectory()) { // recurse
        deleteFolderRecursive(curPath);
      } else { // delete file
        fs.unlinkSync(curPath);
      }
    });
    fs.rmdirSync(path);
  }
};