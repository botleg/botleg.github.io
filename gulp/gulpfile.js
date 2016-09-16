var gulp = require('gulp'),
	path = require('path'),
	gutil = require('gulp-util'),
	sync = require('browser-sync'),
	compass = require('gulp-compass'),
	imagemin = require('gulp-imagemin'),
	minify = require('gulp-clean-css'),
	rename = require('gulp-rename'),
	resize = require('gulp-image-resize'),
	changed = require('gulp-changed'),
	// critical = require('critical').generate,
	closure = require('gulp-closure-compiler-service');

var jsSources = '../jekyll/assets/js/*.js',
	scssFile = '../jekyll/assets/sass/main.scss',
	scssSources = path.resolve('../jekyll/assets/sass'),
	htmlSources = '../site/**/*.html',
	imgSources = '../jekyll/assets/images/blog/*.+(jpg|jpeg|gif|png|svg)';

gulp.task('serve', function() {
    sync.init({
        server: {
            baseDir: '../site'
        },
        port: 4000
    });
});

gulp.task('compass', function() {
	gulp.src(scssFile)
		.pipe(compass({
			sass: scssSources,
			image: '../site/assets/images',
			css: '../site/assets',
			require: ['bourbon', 'neat']
		}))
		.on('error', gutil.log)
		.pipe(minify())
		.pipe(gulp.dest('../site/assets'))
		.pipe(sync.reload({stream:true}));
});

gulp.task('js', function() {
    gulp.src(jsSources)
    	.pipe(changed('../site/assets/js'))
		.pipe(closure())
		.on('error', gutil.log)
    	.pipe(gulp.dest('../site/assets/js'))
	    .pipe(sync.reload({stream:true}));
});

gulp.task('img', function() {
    gulp.src(imgSources)
		.pipe(rename({
			suffix: "@3x",
			extname: ".jpg"
		}))
		.pipe(changed('../site/assets/images'))
    	.pipe(imagemin({
			optimizationLevel: 3,
			progressive: true,
			interlaced: true
    	}))
		.pipe(resize({
			width : 900,
			crop : false,
			upscale : true,
			format: 'jpg',
			imageMagick: true
		}))
		.on('error', gutil.log)
    	.pipe(gulp.dest('../site/assets/images'))
	    .pipe(sync.reload({stream:true}));

	gulp.src(imgSources)
		.pipe(rename({
			suffix: "@2x",
			extname: ".jpg"
		}))
		.pipe(changed('../site/assets/images'))
    	.pipe(imagemin({
			optimizationLevel: 3,
			progressive: true,
			interlaced: true
    	}))
		.pipe(resize({
			width : 600,
			crop : false,
			upscale : true,
			format: 'jpg',
			imageMagick: true
		}))
		.on('error', gutil.log)
    	.pipe(gulp.dest('../site/assets/images'))
	    .pipe(sync.reload({stream:true}));

	gulp.src(imgSources)
		.pipe(rename({
			suffix: "@1x",
			extname: ".jpg"
		}))
		.pipe(changed('../site/assets/images'))
    	.pipe(imagemin({
			optimizationLevel: 3,
			progressive: true,
			interlaced: true
    	}))
		.pipe(resize({
			width : 300,
			crop : false,
			upscale : true,
			format: 'jpg',
			imageMagick: true
		}))
		.on('error', gutil.log)
    	.pipe(gulp.dest('../site/assets/images'))
	    .pipe(sync.reload({stream:true}));
});

// gulp.task('critical', function() {
// 	critical({
// 		inline: true,
// 		base: '../site',
// 		src: 'stories/orchestrate-docker-containers-with-tutum/index.html',
// 		css: '../site/assets/main.css',
// 		dest: '_includes/critical.html',
// 		width: 480,
// 		minify: true
// 	});
// });

gulp.task('default', ['serve'], function() {
	gulp.watch(jsSources, ['js']);
	gulp.watch(scssSources+'/*.scss', ['compass']);
	gulp.watch(imgSources, ['img']);
	gulp.watch(htmlSources, sync.reload);
});