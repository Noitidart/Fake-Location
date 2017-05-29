import { deepAccessUsingString } from './all'
const TRUNK = typeof chrome !== 'undefined' && chrome.runtime ? chrome : browser;
// does not work in content script - window.chrome is undefined apparently in firefox - // const TRUNK = window.chrome && window.chrome.runtime ? window.chrome : window.browser;
// const TRUNK_NAME = window.chrome ? 'chrome' : 'browser'; // unused



window.extension = TRUNK;
// window.extension = function(dotpath) {
//     let basepath = dotpath.split('.');
//     basepath.pop();
//     basepath = basepath.join('.');
//     return deepAccessUsingString(TRUNK, dotpath).bind(deepAccessUsingString(TRUNK, basepath));
// }

// stands for extension_async
window.extensiona = function(dotpath, ...args) {
    let basepath = dotpath.split('.');
    basepath.pop();
    basepath = basepath.join('.');
    // return new Promise(resolve => deepAccessUsingString(TRUNK, dotpath).call(deepAccessUsingString(TRUNK, basepath), ...args, resolve));
    return new Promise(resolve => deepAccessUsingString(TRUNK, dotpath)(...args, resolve));
    // (new Promise(resolve => extension.   (resolve))).then(val => console.log('val:', val))
};

// function promisifyLeaf(leaf, dotpath, ...args) {
//     // if last argument is "ASYNC" then it turns it into a promise
//     // console.log('polyfill\'s to dotpath:', dotpath, 'leaf:', leaf);
//     if (args[args.length-1] === 'ASYNC') {
//         args.pop();
//         return new Promise(resolve => leaf(...args, resolve));
//     } else {
//         console.log('args:', args);
//         return leaf(...args);
//     }
// }

// window.extension = new Proxy({}, {
//     get: function(target, name) {
//         console.log('name:', name, 'target:', target);
//         // let leaf = TRUNK[name]; // unused
//         // let dotpath = [TRUNK_NAME, name].join('.'); // unused
//         let branch = TRUNK;
//         if (name === 'branch') return branch;
//         if (!(name in target)) {
//             target[name] = new Proxy({}, {
//                 get: function(subtarget, subname) {
//                     console.log('subname:', subname, 'subtarget:', subtarget);
//                     let dotpath = [TRUNK_NAME, name, 'subname'].join('.');
//                     let leaf = TRUNK[name][subname];
//                     let branch = TRUNK[name]
//                     if (subname === 'branch') return branch;
//                     if (!(subname in subtarget)) {
//                         if (subname.startsWith('on')) {
//                             // on*** have another level deep on them
//                             subtarget[subname] = new Proxy({}, {
//                                 get: function(subsubtarget, subsubname) {
//                                     console.log('subsubname:', subsubname, 'subsubtarget:', subsubtarget);
//                                     let dotpath = [TRUNK_NAME, name, subname, subsubname].join('.');
//                                     let leaf = TRUNK[name][subname][subsubname];
//                                     let branch = TRUNK[name][subname];
//                                     if (subsubname === 'branch') return branch;
//                                     if (!(subsubname in subsubtarget)) {
//                                         subsubtarget[subsubname] = promisifyLeaf.bind(null, leaf.bind(branch), dotpath);
//                                     }
//                                     return subsubtarget[subsubname];
//                                 }
//                             });
//                         } else {
//                             subtarget[subname] = promisifyLeaf.bind(null, leaf.bind(branch), dotpath);
//                         }
//                     }
//                     return subtarget[subname];
//                 }
//             });
//         }
//         return target[name];
//     }
// });