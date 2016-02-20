var gulp = require('gulp'),
	gutil = require('gulp-util'),
	sync = require('browser-sync'),
	compass = require('gulp-compass'),
	imagemin = require('gulp-imagemin'),
	minify = require('gulp-minify-css'),
	responsive = require('gulp-responsive'),
	critical = require('critical').generate,
	closure = require('gulp-closure-compiler-service');

var jsSources = 'assets/js/*.js',
	scssFile = 'assets/sass/main.scss',
	scssSources = 'assets/sass',
	htmlSources = '_site/**/*.html',
	imgSources = 'assets/images/blog/*.+(jpg|jpeg|gif|png|svg)';

gulp.task('serve', function() {
    sync.init({
        server: {
            baseDir: '_site/'
        },
        port: 4000
    });
});

gulp.task('compass', function() {
	gulp.src(scssFile)
		.pipe(compass({
			sass: scssSources,
			image: '_site/assets/images',
			css: '_site/assets',
			require: ['bourbon', 'neat']
		}))
		.pipe(minify())
		.on('error', gutil.log)
		.pipe(gulp.dest('_site/assets'))
		.pipe(sync.reload({stream:true}));
});

gulp.task('js', function() {
    gulp.src(jsSources)
		.pipe(closure())
		.on('error', gutil.log)
    	.pipe(gulp.dest('_site/assets/js'))
	    .pipe(sync.reload({stream:true}));
});

gulp.task('img', function() {
    gulp.src(imgSources)
    	.pipe(imagemin({
			optimizationLevel: 3,
			progressive: true,
			interlaced: true
        }))
		.pipe(responsive({
			'*': [{
				width: 300,
				withoutEnlargement: false,
				rename: {
					suffix: '@1x',
					extname: '.jpg'
				}
			}, {
				width: 300 * 2,
				withoutEnlargement: false,
				rename: {
					suffix: '@2x',
					extname: '.jpg'
				}
			}, {
				width: 300 * 3,
				withoutEnlargement: false,
				rename: {
					suffix: '@3x',
					extname: '.jpg'
				}
			}]
		}))
		.on('error', gutil.log)
    	.pipe(gulp.dest('_site/assets/images'))
	    .pipe(sync.reload({stream:true}));
});

gulp.task('critical', function() {
	critical({
		inline: true,
		base: '_site',
		src: 'stories/orchestrate-docker-containers-with-tutum/index.html',
		css: '_site/assets/main.css',
		dest: '_includes/critical.html',
		width: 480,
		minify: true
	});
});

gulp.task('default', ['serve'], function() {
	gulp.watch(jsSources, ['js']);
	gulp.watch(scssSources+'/*.scss', ['compass']);
	gulp.watch(imgSources, ['img']);
	gulp.watch(htmlSources, sync.reload);
});