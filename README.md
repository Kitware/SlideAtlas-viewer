# SlideAtlas-viewer

[![Travis](https://img.shields.io/travis/SlideAtlas/SlideAtlas-viewer/master.svg)](https://travis-ci.org/SlideAtlas/SlideAtlas-viewer)
[![npm](https://img.shields.io/npm/v/slideatlas-viewer.svg)](https://www.npmjs.com/package/slideatlas-viewer)
[![GitHub license](https://img.shields.io/badge/license-Apache%202-blue.svg)](https://raw.githubusercontent.com/SlideAtlas/SlideAtlas-viewer/master/LICENSE)
[![David](https://img.shields.io/david/SlideAtlas/SlideAtlas-viewer.svg)](https://github.com/SlideAtlas/SlideAtlas-viewer/blob/master/package.json)
[![David](https://img.shields.io/david/dev/SlideAtlas/SlideAtlas-viewer.svg)](https://github.com/SlideAtlas/SlideAtlas-viewer/blob/master/package.json)

A multiresolution image viewer, optimized for whole slide images.

## Prerequisites
The development environment requires Node Package Manager to be installed. See the
[Node.js documentation](https://docs.npmjs.com/getting-started/installing-node) for details on how to install it.

## Building
To fetch dependencies necessary for building, run:

`npm install`

To build the full distributable web code, then run:

`npm run build`

This will cause the following files to be built under the `dist` directory:
* `sa.max.js`, with the concatenated relevant SlideAtlas Javascript files 
* `sa.min.js`, with the minified relevant SlideAtlas Javascript files
* `sa-lib.js`, with the concatenated third-party libraries
* `sa-all.max.js`, with the concatenation of `sa-lib.js` and `sa.max.js`
* `sa-all.min.js`, with the concatenation of `sa-lib.js` and `sa.min.js`
* `sa.css`, with the concatenated relevant SlideAtlas CSS files

## Testing
To run style checks, run:

`npm test`

## Releasing
To generate a new release:
* Ensure that the local machine is configured to push to NPM:

  `npm whoami`

  * If this command returns an error, configure the machine with:

    `npm adduser`

    using your credentials [for NPM](https://www.npmjs.com/).

* Ensure that the local repository is on the latest version of the master branch, with no outstanding changes:

  `git stash && git checkout master && git pull`

* Bump the package version, using either:
  * `npm version minor`, for new features
  * `npm version patch`, for pure bug fixes

  Note, the `npm version` command will automatically install, build, and test the
  package.

  More importantly, it will create a new Git branch, named `bump-version`, containing a Git commit and tag for the new
  version. This branch will be automatically pushed to GitHub, but a PR must be created manually to merge this new
  branch.

* Push the release to NPM:

  `npm publish`

* [Create and merge a PR on GitHub](https://github.com/SlideAtlas/SlideAtlas-viewer/compare/bump-version?expand=1) for
  the new `bump-version` branch.

## Development Environment Tips
### Vim Style Checking
To run style checks while editing in code Vim, check out [this tutorial](http://usevim.com/2016/03/07/linting/).

### Emacs Style Checking
To run style checks with editing code in Emacs, use Flycheck.
[The Flycheck manual](http://flycheck.readthedocs.io/en/latest/user/installation.html) and
[portions of this tutorial](http://codewinds.com/blog/2015-04-02-emacs-flycheck-eslint-jsx.html) provide more details
on installation, but to get started quickly:
  * Append the following code to your `~/.emacs.d/init.el` file:
    ```
    ;; Enable the package manager
    (require 'package)
    (add-to-list 'package-archives
                 '("MELPA Stable" . "https://stable.melpa.org/packages/") t)
    (package-initialize)
    ```

  * In Emacs, enter

    `M-x package-install RET flycheck`

    to install Flycheck (`RET` is the return character).

  * Append the following additional code to your `~/.emacs.d/init.el` file:
    ```
    ;; http://www.flycheck.org/manual/latest/index.html
    (require 'flycheck)

    ;; turn on flychecking globally
    (add-hook 'after-init-hook #'global-flycheck-mode)

    ;; disable jshint since we prefer eslint checking
    (setq-default flycheck-disabled-checkers
      (append flycheck-disabled-checkers
        '(javascript-jshint)))

    ;; use local eslint from node_modules before global
    ;; http://emacs.stackexchange.com/questions/21205/flycheck-with-file-relative-eslint-executable
    (defun my/use-eslint-from-node-modules ()
      (let* ((root (locate-dominating-file
                    (or (buffer-file-name) default-directory)
                    "node_modules"))
             (eslint (and root
                          (expand-file-name "node_modules/eslint/bin/eslint.js"
                                            root))))
        (when (and eslint (file-executable-p eslint))
          (setq-local flycheck-javascript-eslint-executable eslint))))
    (add-hook 'flycheck-mode-hook #'my/use-eslint-from-node-modules)
    ```

  * Use the following basic commands in Emacs to interact with Flycheck:
    * `C-c ! l` to see full list of errors in a buffer
    * `C-c ! n` to go to the next error
    * `C-c ! p` to go to the previous error

    and see [the Flycheck documentation](http://flycheck.readthedocs.io/en/latest/user/error-list.html) for more
    information on usage.

### Automatic Code Rebuilding
To automatically rebuild the `dist/sa.max.js`, `dist/sa-all.max.js`, and `dist/sa.css` whenever one of the constituent
Javascript (excluding libraries) or CSS files is modified, run:

  `npm run watch`

### Automatic Code Reloading
To automatically reload a web browser whenever one of the constituent Javascript (excluding libraries) or CSS files is
modified:
  * Directly source the `dist/sa.max.js` and `dist/sa.css` files in your HTML page

  * Enable LiveReload for the page by either:
    * Adding the script tag

      `<script src="//localhost:35729/livereload.js"></script>`

      before the closing `</body>` tag of your HTML page
    * Installing the [LiveReload browser extension](http://livereload.com/extensions/).

  * Run

    `npm run watch`

    and then load your HTML page in a local browser.

 Note, Javascript changes will cause the page to refresh, whereas CSS changes will cause an in-place update.

 The `examples/viewer.html` file is already set up to support automatic reloading.
