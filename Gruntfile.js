var jsLibFiles = [
  'node_modules/jquery/dist/jquery.min.js',
  'node_modules/jquery-ui-dist/jquery-ui.min.js',
  'node_modules/spectrum-colorpicker/spectrum.js',
  // This is a polyfill for the HTMLCanvasElement.toBlob method
  'node_modules/blueimp-canvas-to-blob/js/canvas-to-blob.min.js',
  'node_modules/file-saver/FileSaver.min.js',
  'node_modules/gl-matrix/dist/gl-matrix-min.js',
  'node_modules/objectid-js/src/main/javascript/Objectid.js'
];

var jsSrcFiles = [
  // Markup files
  'js/annotationLayer.js',
  'js/shape.js',
  'js/shapeGroup.js',
  'js/cutoutWidget.js',
  'js/text.js',
  'js/textWidget.js',
  'js/polyline.js',
  'js/polylineWidget.js',
  'js/pencilWidget.js',
  'js/fillWidget.js',
  'js/lassoWidget.js',
  'js/widgetPopup.js',
  'js/crossHairs.js',
  'js/arrow.js',
  'js/arrowWidget.js',
  'js/circle.js',
  'js/circleWidget.js',
  'js/rectWidget.js',
  'js/rectSetWidget.js',
  'js/gridWidget.js',
  'js/scaleWidget.js',
  'js/imageAnnotation.js',
  'js/dialog.js',
  'js/girderWidget.js',
  'js/groundTruth.js',
  'js/view.js',
  // Core files
  'js/cookies.js',
  'js/init.js',
  'js/viewEditMenu.js',
  'js/viewBrowser.js',
  'js/dualViewWidget.js',
  'js/tabbedDiv.js',
  'js/note.js',
  'js/notesWidget.js',
  'js/tab.js',
  'js/annotationWidget.js',
  'js/recorderWidget.js',
  'js/navigationWidget.js',
  'js/favoritesWidget.js',
  'js/favoritesBar.js',
  'js/mobileAnnotationWidget.js',
  'js/viewer-utils.js',
  'js/presentation.js',
  'js/loader.js',
  'js/camera.js',
  'js/cutout.js',
  'js/tile.js',
  'js/cache.js',
  'js/section.js',
  'js/tileView.js',
  'js/viewer.js',
  'js/pairTransformation.js',
  'js/stackSectionWidget.js',
  'js/layerView.js',
  'js/heatMap.js',
  'js/overlayView.js'
];

var cssSrcFiles = [
  'css/main.css',
  'node_modules/jquery-ui-dist/jquery-ui.min.css',
  'css/saViewer.css',
  'node_modules/spectrum-colorpicker/spectrum.css'
];

module.exports = function (grunt) {
  grunt.initConfig({
    pkg: grunt.file.readJSON('package.json'),

    concat: {
      options: {
        banner: '/*SlideAtlas*/'
      },
      base: {
        src: jsSrcFiles,
        dest: 'dist/sa.max.js'
      },
      lib: {
        src: jsLibFiles,
        dest: 'dist/sa-lib.js'
      },
      maxBundle: {
        src: [
          'dist/sa-lib.js',
          'dist/sa.max.js'
        ],
        dest: 'dist/sa-all.max.js'
      },
      minBundle: {
        src: [
          'dist/sa-lib.js',
          'dist/sa.min.js'
        ],
        dest: 'dist/sa-all.min.js'
      },
      css: {
        src: cssSrcFiles,
        dest: 'dist/sa.css'
      }
    },
    copy: {
      images: {
        src: 'img/**',
        dest: 'dist/'
      }
    },
    uglify: {
      options: {},
      base: {
        src: jsSrcFiles,
        dest: 'dist/sa.min.js'
      }
    }
  });

  grunt.loadNpmTasks('grunt-contrib-concat');
  grunt.loadNpmTasks('grunt-contrib-copy');
  grunt.loadNpmTasks('grunt-contrib-uglify');

  grunt.registerTask('default', [
    'concat:base',
    'uglify:base',
    'concat:lib',
    'concat:maxBundle',
    'concat:minBundle',
    'concat:css',
    'copy:images'
  ]);
};
