/* README
 * gulp - this will create release version, with regex replaced version in install.rdf
 * gulp --beta - this will not parseFloat the version in install.rdf
 */

// Include gulp
var gulp = require('gulp');

// Include Our Plugins
var babel = require('gulp-babel');
var clean = require('gulp-clean');
var fs = require('fs');
var gulpif = require('gulp-if');
var gulp_src_ordered = require('gulp-src-ordered-globs'); // http://stackoverflow.com/a/40206149/1828637
var jshint = require('gulp-jshint');
var replace = require('gulp-replace');
var zip = require('gulp-zip');

// Command line options
var options  = { // defaults
	production: false, // production
		// clarg == --prod
		// strips the console messages // production/release
	txtype: 'fxhyb' // transpile type
		// clarg == --txtype BLAH
		// values:
			// fxhyb == firefox-webextension-hybrid
			// fxext == firefox-webextension
			// web == web
		// affects taskcopy-3rdjs - where to copy the babel-polyfill too
};

var clargs = process.argv.slice(2);
var clargs = clargs.map(el => el.toLowerCase().trim());

console.log('clargs:', clargs);
// production?
if (clargs.indexOf('--prod') > -1) {
	options.production = true;
}

// txtype?
var ix_txtype = clargs.indexOf('--txtype');
if (ix_txtype > -1) {
	options.type = clargs[++ix_txtype];
}

// start async-proc9939
gulp.task('clean', function() {
	return gulp.src('dist', { read:false })
		.pipe(clean());
});

gulp.task('copy', ['clean'], function() {
	// copy all files but js
    return gulp_src_ordered([
            'src/**/*',
			'!src/.*',			// no hidden files/dirs in src
			'!src/.*/**/*',		// no files/dirs in hidden dirs in src
			'!src/**/*.js',		// no js files from src
			'src/**/3rd/*.js'	// make sure to get 3rd party js files though
        ])
        .pipe(gulp.dest('dist'));
});

gulp.task('import-3rdjs', ['copy'], function() {
	// bring in babel-polyfill to 3rd party directory - determined by clarg txtype

	var dest;
	// switch (options.txtype) {
	// 	case 'fxhyb':
	// 			dest = 'dist/webextension/scripts/3rd';
	// 		break;
	// 	case 'web':
	// 	case 'fxext':
	// 			dest = 'dist/scripts/3rd';
	// 		break;
	// }
	if (fs.existsSync('dist/webextension/scripts/3rd')) {
		// options.txtype == fxhyb
		dest = 'dist/webextension/scripts/3rd';
	} else if (fs.existsSync('dist/scripts/3rd')) {
		// options.txtype == web || fxext
		dest = 'dist/scripts/3rd';
	} else {
		throw new Error('dont know where to import 3rd party scripts too!');
	}
	console.log('dest:', dest);

    return gulp.src([
			'node_modules/babel-polyfill/dist/polyfill.min.js'
        ])
        .pipe(gulp.dest(dest));
});

gulp.task('initial-tx-js', ['import-3rdjs'], function() {
	return gulp.start('tx-then-xpi');
});
// end async-proc9939

// start - standalone3888 - is standalone because so `gulp watch` can trigger this without triggering the clean and copy stuff from above
gulp.task('tx-js', function() {
	// tx-js stands for transform-javascripts
	return gulp.src(['src/**/*.js', '!src/**/3rd/*'])
		.pipe(gulpif(options.production, replace(/^.*?console\.(warn|info|log|error|exception|time|timeEnd|jsm).*?$/mg, '')))
		.pipe(babel())
		.pipe(gulp.dest('dist'));
});

gulp.task('tx-then-xpi', ['tx-js'], function() {
	return gulp.src('dist/**/*')
        .pipe(zip('dist.xpi', { compress:false }))
        .pipe(gulp.dest('./'));
});

gulp.task('xpi', function() {
	return gulp.src('dist/**/*')
        .pipe(zip('dist.xpi', { compress:false }))
        .pipe(gulp.dest('./'));
});
// end - standalone3888


gulp.task('default', ['initial-tx-js']); // copy-3rdjs triggers tx-js
gulp.task('watch', ['default'], function() {
	console.log('NOTE: wait for tx-then-xpi to finish, or it may have already finished. as that does the initial js copy');
	var watcher = gulp.watch('src/**/*.js', ['tx-then-xpi']);
	watcher.on('change', function(event) {
		console.log('JS file at path "' + event.path + '" was ' + event.type + ', running tx-js...');
	});
});
